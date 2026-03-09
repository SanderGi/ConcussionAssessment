import type { Context } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";

type Env = {
  Bindings: {
    DB: D1Database;
    ADMIN_DASHBOARD_PASSWORD: string;
    ADMIN_SESSION_SECRET: string;
    ANALYTICS_HMAC_SECRET: string;
  };
  Variables: {
    user: User;
  };
};

type User = {
  sub: string;
  email: string;
  name: string;
  picture: string;
};

type Workspace = {
  id: string;
  name: string;
  role: "owner" | "member";
  ownerSub: string;
  inviteCode?: string;
};

const app = new Hono<Env>();
const ADMIN_COOKIE_NAME = "scat6_admin_session";
const HLL_P = 10;
const HLL_REGISTERS = 1 << HLL_P;

function utcDayString(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(input: string) {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hllEmpty() {
  return new Uint8Array(HLL_REGISTERS);
}

function hllEstimate(registers: Uint8Array) {
  const m = registers.length;
  let sum = 0;
  let zeros = 0;
  for (const r of registers) {
    sum += 2 ** -r;
    if (r === 0) zeros += 1;
  }
  const alpha =
    m === 16
      ? 0.673
      : m === 32
      ? 0.697
      : m === 64
      ? 0.709
      : 0.7213 / (1 + 1.079 / m);
  let estimate = alpha * m * m * (1 / sum);
  if (estimate <= 2.5 * m && zeros > 0) {
    estimate = m * Math.log(m / zeros);
  }
  return Math.round(estimate);
}

function hllMerge(a: Uint8Array, b: Uint8Array) {
  const merged = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i += 1) {
    merged[i] = Math.max(a[i], b[i]);
  }
  return merged;
}

function leadingZeros64(x: bigint) {
  let n = 0;
  for (let i = 63; i >= 0; i -= 1) {
    if (((x >> BigInt(i)) & 1n) === 1n) break;
    n += 1;
  }
  return n;
}

function hllAddHash(registers: Uint8Array, hash64: bigint) {
  const idx = Number(hash64 >> BigInt(64 - HLL_P));
  const wMask = (1n << BigInt(64 - HLL_P)) - 1n;
  const w = hash64 & wMask;
  const lz = leadingZeros64(w) - HLL_P + 1;
  const rho = Math.max(1, Math.min(64 - HLL_P + 1, lz));
  if (rho > registers[idx]) registers[idx] = rho;
}

async function hmacBytes(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return new Uint8Array(sig);
}

function bytesToBigInt64(bytes: Uint8Array) {
  let out = 0n;
  for (let i = 0; i < 8; i += 1) {
    out = (out << 8n) | BigInt(bytes[i] ?? 0);
  }
  return out;
}

async function hllUpsert(
  db: D1Database,
  key: string,
  metric: string,
  day: string | null,
  country: string | null,
  hash64: bigint
) {
  const existing = await db
    .prepare("SELECT registers FROM analytics_hll WHERE key = ? LIMIT 1")
    .bind(key)
    .first<{ registers: string }>();
  const registers = existing?.registers ? fromBase64(existing.registers) : hllEmpty();
  hllAddHash(registers, hash64);
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO analytics_hll (key, metric, day, country, registers, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         registers = excluded.registers,
         updated_at = excluded.updated_at`
    )
    .bind(key, metric, day, country, toBase64(registers), now)
    .run();
}

async function incrementCountryRequests(db: D1Database, country: string) {
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO analytics_country_requests (country, request_count, updated_at)
       VALUES (?, 1, ?)
       ON CONFLICT(country) DO UPDATE SET
         request_count = request_count + 1,
         updated_at = excluded.updated_at`
    )
    .bind(country, now)
    .run();
}

async function incrementEventCounter(
  db: D1Database,
  metric: string,
  incrementBy = 1
) {
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO analytics_event_counters (metric, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(metric) DO UPDATE SET
         value = value + excluded.value,
         updated_at = excluded.updated_at`
    )
    .bind(metric, incrementBy, now)
    .run();
}

async function insertEventDedupeKey(db: D1Database, dedupeKey: string) {
  const now = Date.now();
  const result = await db
    .prepare(
      `INSERT INTO analytics_event_dedupe (event_key, created_at)
       VALUES (?, ?)
       ON CONFLICT(event_key) DO NOTHING`
    )
    .bind(dedupeKey, now)
    .run();
  return Number(result.meta.changes ?? 0) > 0;
}

async function trackAnalytics(c: Context<Env>) {
  try {
    const path = c.req.path;
    if (!path.startsWith("/api/") || c.req.method === "OPTIONS" || path === "/api/health") {
      return;
    }
    const ip = c.req.header("cf-connecting-ip") ?? "";
    const ua = c.req.header("user-agent") ?? "";
    if (!ip || !ua) return;

    const day = utcDayString();
    const cf = (c.req.raw as Request & { cf?: { country?: string } }).cf;
    const country = (cf?.country || "ZZ").toUpperCase();
    const raw = `${ip}|${ua}`;

    const dailySaltBytes = await hmacBytes(c.env.ANALYTICS_HMAC_SECRET, `day:${day}`);
    const dailySalt = toBase64(dailySaltBytes);
    const dailyHash = bytesToBigInt64(await hmacBytes(dailySalt, raw));
    const stableHash = bytesToBigInt64(
      await hmacBytes(c.env.ANALYTICS_HMAC_SECRET, `stable:${raw}`)
    );

    await Promise.all([
      hllUpsert(c.env.DB, `daily_users:${day}`, "daily_users", day, null, dailyHash),
      hllUpsert(c.env.DB, "total_users", "total_users", null, null, stableHash),
      hllUpsert(
        c.env.DB,
        `country_users:${country}`,
        "country_users",
        null,
        country,
        stableHash
      ),
      incrementCountryRequests(c.env.DB, country),
    ]);
  } catch (err) {
    console.error("Analytics tracking failed:", err);
  }
}

async function getStableRequestHash64(c: Context<Env>) {
  const ip = c.req.header("cf-connecting-ip") ?? "";
  const ua = c.req.header("user-agent") ?? "";
  if (!ip || !ua) return null;
  const raw = `${ip}|${ua}`;
  const stableHash = bytesToBigInt64(
    await hmacBytes(c.env.ANALYTICS_HMAC_SECRET, `stable:${raw}`)
  );
  return stableHash;
}

async function hashEventIdTo64(c: Context<Env>, eventId: string) {
  const bytes = await hmacBytes(c.env.ANALYTICS_HMAC_SECRET, `event:${eventId}`);
  return bytesToBigInt64(bytes);
}

function parseCookieMap(rawCookie: string | undefined) {
  const out: Record<string, string> = {};
  if (!rawCookie) return out;
  for (const part of rawCookie.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") || "");
  }
  return out;
}

async function signSession(sessionSecret: string, payload: string) {
  const bytes = await hmacBytes(sessionSecret, payload);
  return toBase64(bytes);
}

async function verifyAdminSession(c: Context<Env>) {
  const cookies = parseCookieMap(c.req.header("Cookie"));
  const token = cookies[ADMIN_COOKIE_NAME];
  if (!token) return false;
  const [expRaw, sig] = token.split(".");
  if (!expRaw || !sig) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = await signSession(c.env.ADMIN_SESSION_SECRET, expRaw);
  return timingSafeEqual(sig, expected);
}

function timingSafeEqual(a: string, b: string) {
  const aa = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i += 1) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

function htmlResponse(html: string) {
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

app.onError((err, c) => {
  console.error("Worker error:", err);
  const msg = String(err?.message ?? "");
  if (/no such table/i.test(msg)) {
    return c.json(
      {
        error:
          "Database schema is missing. Apply D1 migrations to the remote database.",
      },
      500
    );
  }
  if (/Cannot read properties of undefined|DB/i.test(msg)) {
    return c.json(
      {
        error:
          "Database binding is unavailable. Check wrangler d1 binding configuration.",
      },
      500
    );
  }
  return c.json({ error: "Internal server error." }, 500);
});

app.use(
  "/api/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
  })
);

app.use("/api/*", async (c, next) => {
  if (c.executionCtx) {
    c.executionCtx.waitUntil(trackAnalytics(c));
  } else {
    void trackAnalytics(c);
  }
  await next();
});

app.use("/api/*", async (c, next) => {
  if (
    c.req.method === "OPTIONS" ||
    c.req.path === "/api/health" ||
    c.req.path === "/api/analytics/event"
  ) {
    await next();
    return;
  }

  const auth = c.req.header("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    return c.json({ error: "Missing bearer token." }, 401);
  }

  const user = await verifyGoogleIdToken(token);
  if (!user) {
    return c.json({ error: "Invalid Google ID token." }, 401);
  }

  c.set("user", user);
  await next();
});

app.get("/api/health", async (c) => {
  try {
    await c.env.DB.prepare("SELECT 1").first();
    return c.json({ ok: true, db: "ok" });
  } catch (err) {
    console.error("Health DB check failed:", err);
    return c.json({ ok: false, db: "error" }, 500);
  }
});

app.post("/api/analytics/event", async (c) => {
  const body = await c.req.json<{
    eventType?: string;
    eventId?: string;
    storage?: string;
    mode?: string;
  }>();

  const eventType = String(body?.eventType ?? "").trim();
  const eventId = String(body?.eventId ?? "").trim().toLowerCase();
  const storage = String(body?.storage ?? "").trim();
  const mode = String(body?.mode ?? "").trim();

  if (storage !== "non_workspace" && storage !== "local_only") {
    return c.json({ ok: true, skipped: true });
  }

  if (!/^[a-f0-9]{64}$/.test(eventId)) {
    return c.json({ error: "Invalid eventId." }, 400);
  }

  if (eventType === "test_completed") {
    const stableHash = await getStableRequestHash64(c);
    if (stableHash !== null) {
      await hllUpsert(
        c.env.DB,
        "non_workspace_users",
        "non_workspace_users",
        null,
        null,
        stableHash
      );
    }
    const dedupeKey = `test_completed:${eventId}`;
    const inserted = await insertEventDedupeKey(c.env.DB, dedupeKey);
    if (!inserted) return c.json({ ok: true, duplicate: true });
    await incrementEventCounter(c.env.DB, "local_tests_completed", 1);
    return c.json({ ok: true });
  }

  if (eventType === "athlete_profile_seen") {
    const eventHash = await hashEventIdTo64(c, eventId);
    await hllUpsert(
      c.env.DB,
      "non_workspace_athletes",
      "non_workspace_athletes",
      null,
      null,
      eventHash
    );
    return c.json({ ok: true });
  }

  if (eventType === "bess_completed") {
    if (mode !== "manual" && mode !== "automated") {
      return c.json({ error: "Invalid mode for bess_completed." }, 400);
    }
    const dedupeKey = `bess_completed:${mode}:${eventId}`;
    const inserted = await insertEventDedupeKey(c.env.DB, dedupeKey);
    if (!inserted) return c.json({ ok: true, duplicate: true });
    await incrementEventCounter(
      c.env.DB,
      mode === "automated"
        ? "local_bess_automated_completed"
        : "local_bess_manual_completed",
      1
    );
    return c.json({ ok: true });
  }

  return c.json({ error: "Unsupported eventType." }, 400);
});

app.get("/", async (c) => {
  if (await verifyAdminSession(c)) {
    return htmlResponse(renderDashboardHtml());
  }
  return htmlResponse(renderLoginHtml());
});

app.post("/admin/login", async (c) => {
  const form = await c.req.formData();
  const password = String(form.get("password") ?? "");
  if (!timingSafeEqual(password, c.env.ADMIN_DASHBOARD_PASSWORD)) {
    return htmlResponse(renderLoginHtml("Invalid password."));
  }

  const exp = Date.now() + 1000 * 60 * 60 * 12;
  const expRaw = String(exp);
  const sig = await signSession(c.env.ADMIN_SESSION_SECRET, expRaw);
  const cookie = `${ADMIN_COOKIE_NAME}=${encodeURIComponent(
    `${expRaw}.${sig}`
  )}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${60 * 60 * 12}`;

  return new Response(null, {
    status: 302,
    headers: {
      location: "/",
      "set-cookie": cookie,
      "cache-control": "no-store",
    },
  });
});

app.post("/admin/logout", async () => {
  return new Response(null, {
    status: 302,
    headers: {
      location: "/",
      "set-cookie": `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
      "cache-control": "no-store",
    },
  });
});

app.get("/admin/api/stats", async (c) => {
  if (!(await verifyAdminSession(c))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const days = Math.min(120, Math.max(7, Number(c.req.query("days") ?? 30)));
  const stats = await collectDashboardStats(c.env.DB, days);
  return c.json(stats);
});

app.get("/api/workspaces/me", async (c) => {
  const user = c.get("user");
  const workspace = await getActiveWorkspace(c.env.DB, user.sub);
  return c.json({ workspace });
});

app.post("/api/workspaces/create", async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{ name?: string }>();
  const name = (body?.name || "").trim();

  if (!name) {
    return c.json({ error: "Workspace name is required." }, 400);
  }

  const existing = await getActiveWorkspace(c.env.DB, user.sub);
  if (existing) {
    return c.json(
      {
        error: "This Google account already has an active workspace.",
        workspace: existing,
      },
      409
    );
  }

  const workspaceId = crypto.randomUUID();
  const now = Date.now();

  let inviteCode = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    inviteCode = generateInviteCode();
    try {
      await c.env.DB.prepare(
        "INSERT INTO workspaces (id, name, owner_sub, invite_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
        .bind(workspaceId, name, user.sub, inviteCode, now, now)
        .run();
      break;
    } catch (err) {
      if (attempt === 4) {
        console.error(err);
        return c.json(
          { error: "Failed to create workspace. Please retry." },
          500
        );
      }
    }
  }

  await c.env.DB.prepare(
    `INSERT INTO memberships (
      workspace_id, user_sub, user_email, user_name, user_picture, role, is_active, joined_at
    ) VALUES (?, ?, ?, ?, ?, 'owner', 1, ?)`
  )
    .bind(workspaceId, user.sub, user.email, user.name, user.picture, now)
    .run();

  await c.env.DB.prepare(
    "INSERT INTO workspace_data (workspace_id, data_json, updated_at, updated_by_sub) VALUES (?, ?, ?, ?)"
  )
    .bind(workspaceId, "{}", now, user.sub)
    .run();

  return c.json({
    workspace: {
      id: workspaceId,
      name,
      role: "owner",
      ownerSub: user.sub,
      inviteCode,
      inviteLink: buildInviteLink(c, inviteCode),
    },
  });
});

app.post("/api/workspaces/join", async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{ inviteCode?: string }>();
  const inviteCode = (body?.inviteCode || "").trim().toUpperCase();

  if (!inviteCode) {
    return c.json({ error: "Invite code is required." }, 400);
  }

  const workspaceRow = await c.env.DB.prepare(
    "SELECT id, name, owner_sub, invite_code FROM workspaces WHERE invite_code = ? LIMIT 1"
  )
    .bind(inviteCode)
    .first<{
      id: string;
      name: string;
      owner_sub: string;
      invite_code: string;
    }>();

  if (!workspaceRow) {
    return c.json({ error: "Invite code not found." }, 404);
  }

  const active = await getActiveWorkspace(c.env.DB, user.sub);
  if (active && active.id !== workspaceRow.id) {
    return c.json(
      {
        error: "This Google account already has an active workspace.",
        workspace: active,
      },
      409
    );
  }

  const now = Date.now();
  const role: "owner" | "member" =
    workspaceRow.owner_sub === user.sub ? "owner" : "member";

  await c.env.DB.prepare(
    `INSERT INTO memberships (
      workspace_id, user_sub, user_email, user_name, user_picture, role, is_active, joined_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(workspace_id, user_sub) DO UPDATE SET
      user_email = excluded.user_email,
      user_name = excluded.user_name,
      user_picture = excluded.user_picture,
      role = excluded.role,
      is_active = 1`
  )
    .bind(
      workspaceRow.id,
      user.sub,
      user.email,
      user.name,
      user.picture,
      role,
      now
    )
    .run();

  return c.json({
    workspace: {
      id: workspaceRow.id,
      name: workspaceRow.name,
      role,
      ownerSub: workspaceRow.owner_sub,
      inviteCode: role === "owner" ? workspaceRow.invite_code : undefined,
      inviteLink:
        role === "owner"
          ? buildInviteLink(c, workspaceRow.invite_code)
          : undefined,
    },
  });
});

app.post("/api/workspaces/leave", async (c) => {
  const user = c.get("user");
  const active = await getActiveWorkspace(c.env.DB, user.sub);
  if (!active) {
    return c.json({ error: "No active workspace." }, 404);
  }

  if (active.role === "owner") {
    return c.json(
      { error: "Workspace owners cannot leave. Transfer ownership first." },
      400
    );
  }

  await c.env.DB.prepare(
    "UPDATE memberships SET is_active = 0 WHERE workspace_id = ? AND user_sub = ?"
  )
    .bind(active.id, user.sub)
    .run();

  return c.json({ ok: true });
});

app.post("/api/workspaces/:workspaceId/delete", async (c) => {
  const user = c.get("user");
  const { workspaceId } = c.req.param();

  const workspace = await c.env.DB
    .prepare("SELECT owner_sub FROM workspaces WHERE id = ? LIMIT 1")
    .bind(workspaceId)
    .first<{ owner_sub: string }>();
  if (!workspace) {
    return c.json({ error: "Workspace not found." }, 404);
  }
  if (workspace.owner_sub !== user.sub) {
    return c.json({ error: "Only workspace owner can delete workspace." }, 403);
  }

  await c.env.DB.prepare("DELETE FROM workspace_data WHERE workspace_id = ?")
    .bind(workspaceId)
    .run();
  await c.env.DB.prepare("DELETE FROM memberships WHERE workspace_id = ?")
    .bind(workspaceId)
    .run();
  await c.env.DB.prepare("DELETE FROM workspaces WHERE id = ?")
    .bind(workspaceId)
    .run();

  return c.json({ ok: true });
});

app.get("/api/workspaces/:workspaceId/invite", async (c) => {
  const user = c.get("user");
  const { workspaceId } = c.req.param();

  const membership = await c.env.DB.prepare(
    `SELECT m.role, w.invite_code, w.name, w.owner_sub
     FROM memberships m
     JOIN workspaces w ON w.id = m.workspace_id
     WHERE m.workspace_id = ? AND m.user_sub = ? AND m.is_active = 1
     LIMIT 1`
  )
    .bind(workspaceId, user.sub)
    .first<{
      role: "owner" | "member";
      invite_code: string;
      name: string;
      owner_sub: string;
    }>();

  if (!membership) {
    return c.json({ error: "Not a workspace member." }, 403);
  }

  if (membership.role !== "owner") {
    return c.json({ error: "Only owners can access invite details." }, 403);
  }

  return c.json({
    workspaceId,
    workspaceName: membership.name,
    inviteCode: membership.invite_code,
    inviteLink: buildInviteLink(c, membership.invite_code),
  });
});

app.get("/api/workspaces/:workspaceId/members", async (c) => {
  const user = c.get("user");
  const { workspaceId } = c.req.param();

  const membership = await c.env.DB
    .prepare(
      "SELECT role FROM memberships WHERE workspace_id = ? AND user_sub = ? AND is_active = 1 LIMIT 1"
    )
    .bind(workspaceId, user.sub)
    .first<{ role: "owner" | "member" }>();
  if (!membership) {
    return c.json({ error: "Not a workspace member." }, 403);
  }

  const members = await c.env.DB
    .prepare(
      `SELECT user_sub, user_name, user_email, user_picture, role
       FROM memberships
       WHERE workspace_id = ? AND is_active = 1
       ORDER BY role DESC, user_name ASC`
    )
    .bind(workspaceId)
    .all<{
      user_sub: string;
      user_name: string;
      user_email: string;
      user_picture: string;
      role: "owner" | "member";
    }>();

  return c.json({
    members: (members.results ?? []).map((m) => ({
      sub: m.user_sub,
      name: m.user_name,
      email: m.user_email,
      picture: m.user_picture,
      role: m.role,
    })),
  });
});

app.post("/api/workspaces/:workspaceId/members/:memberSub/remove", async (c) => {
  const user = c.get("user");
  const { workspaceId, memberSub } = c.req.param();

  const ownerMembership = await c.env.DB
    .prepare(
      "SELECT role FROM memberships WHERE workspace_id = ? AND user_sub = ? AND is_active = 1 LIMIT 1"
    )
    .bind(workspaceId, user.sub)
    .first<{ role: "owner" | "member" }>();
  if (!ownerMembership || ownerMembership.role !== "owner") {
    return c.json({ error: "Only workspace owner can remove members." }, 403);
  }

  const target = await c.env.DB
    .prepare(
      "SELECT role FROM memberships WHERE workspace_id = ? AND user_sub = ? AND is_active = 1 LIMIT 1"
    )
    .bind(workspaceId, memberSub)
    .first<{ role: "owner" | "member" }>();
  if (!target) {
    return c.json({ error: "Member not found." }, 404);
  }
  if (target.role === "owner") {
    return c.json({ error: "Owner cannot be removed from workspace." }, 400);
  }

  await c.env.DB.prepare(
    "UPDATE memberships SET is_active = 0 WHERE workspace_id = ? AND user_sub = ?"
  )
    .bind(workspaceId, memberSub)
    .run();

  return c.json({ ok: true });
});

app.get("/api/workspaces/:workspaceId/data", async (c) => {
  const user = c.get("user");
  const { workspaceId } = c.req.param();

  const allowed = await hasActiveMembership(c.env.DB, workspaceId, user.sub);
  if (!allowed) {
    return c.json({ error: "Not a workspace member." }, 403);
  }

  const row = await c.env.DB.prepare(
    "SELECT data_json, updated_at, updated_by_sub FROM workspace_data WHERE workspace_id = ? LIMIT 1"
  )
    .bind(workspaceId)
    .first<{ data_json: string; updated_at: number; updated_by_sub: string }>();

  if (!row) {
    const now = Date.now();
    await c.env.DB.prepare(
      "INSERT INTO workspace_data (workspace_id, data_json, updated_at, updated_by_sub) VALUES (?, ?, ?, ?)"
    )
      .bind(workspaceId, "{}", now, user.sub)
      .run();
    return c.json({ data: {}, updatedAt: now, updatedBySub: user.sub });
  }

  return c.json({
    data: safeJsonParse(row.data_json),
    updatedAt: row.updated_at,
    updatedBySub: row.updated_by_sub,
  });
});

app.put("/api/workspaces/:workspaceId/data", async (c) => {
  const user = c.get("user");
  const { workspaceId } = c.req.param();

  const allowed = await hasActiveMembership(c.env.DB, workspaceId, user.sub);
  if (!allowed) {
    return c.json({ error: "Not a workspace member." }, 403);
  }

  const body = await c.req.json<{ data?: unknown }>();
  if (
    !body ||
    typeof body.data !== "object" ||
    body.data === null ||
    Array.isArray(body.data)
  ) {
    return c.json({ error: "Body must include a JSON object as data." }, 400);
  }
  const incomingData = body.data as Record<string, unknown>;

  const now = Date.now();
  const existing = await c.env.DB
    .prepare("SELECT data_json FROM workspace_data WHERE workspace_id = ? LIMIT 1")
    .bind(workspaceId)
    .first<{ data_json: string }>();
  const existingData = safeJsonParse(existing?.data_json ?? "{}");
  const mergedData = mergeTestsByUpdatedAt(existingData, incomingData);

  await c.env.DB.prepare(
    `INSERT INTO workspace_data (workspace_id, data_json, updated_at, updated_by_sub)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(workspace_id) DO UPDATE SET
       data_json = excluded.data_json,
       updated_at = excluded.updated_at,
       updated_by_sub = excluded.updated_by_sub`
  )
    .bind(workspaceId, JSON.stringify(mergedData), now, user.sub)
    .run();

  await c.env.DB.prepare("UPDATE workspaces SET updated_at = ? WHERE id = ?")
    .bind(now, workspaceId)
    .run();

  return c.json({ ok: true, updatedAt: now });
});

async function hasActiveMembership(
  db: D1Database,
  workspaceId: string,
  userSub: string
) {
  const row = await db
    .prepare(
      "SELECT 1 as ok FROM memberships WHERE workspace_id = ? AND user_sub = ? AND is_active = 1 LIMIT 1"
    )
    .bind(workspaceId, userSub)
    .first<{ ok: 1 }>();
  return Boolean(row?.ok);
}

async function getActiveWorkspace(
  db: D1Database,
  userSub: string
): Promise<Workspace | null> {
  const row = await db
    .prepare(
      `SELECT w.id, w.name, w.owner_sub, w.invite_code, m.role
       FROM memberships m
       JOIN workspaces w ON w.id = m.workspace_id
       WHERE m.user_sub = ? AND m.is_active = 1
       LIMIT 1`
    )
    .bind(userSub)
    .first<{
      id: string;
      name: string;
      owner_sub: string;
      invite_code: string;
      role: "owner" | "member";
    }>();

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    role: row.role,
    ownerSub: row.owner_sub,
    inviteCode: row.role === "owner" ? row.invite_code : undefined,
  };
}

function generateInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function buildInviteLink(c: Context<Env>, inviteCode: string) {
  const origin = c.req.header("Origin");
  const url = origin ? new URL(origin) : new URL(c.req.url);
  url.searchParams.set("workspaceInvite", inviteCode);
  return url.toString();
}

function safeJsonParse(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function mergeTestsByUpdatedAt(
  baseData: Record<string, unknown>,
  incomingData: Record<string, unknown>
) {
  const merged: Record<string, unknown> = { ...baseData };
  for (const [key, incomingValue] of Object.entries(incomingData)) {
    if (
      !incomingValue ||
      typeof incomingValue !== "object" ||
      Array.isArray(incomingValue)
    ) {
      continue;
    }
    const incomingUpdated = Number(
      (incomingValue as { test_updated_at?: unknown }).test_updated_at ?? 0
    );
    const existingValue = merged[key];
    const existingUpdated =
      existingValue &&
      typeof existingValue === "object" &&
      !Array.isArray(existingValue)
        ? Number(
            (existingValue as { test_updated_at?: unknown }).test_updated_at ??
              0
          )
        : 0;

    if (!existingValue || existingUpdated <= incomingUpdated) {
      merged[key] = incomingValue;
    }
  }
  return merged;
}

async function collectDashboardStats(db: D1Database, days: number) {
  const sinceDay = utcDayString(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);

  const dailyRows = await db
    .prepare(
      `SELECT day, registers
       FROM analytics_hll
       WHERE metric = 'daily_users' AND day >= ?
       ORDER BY day ASC`
    )
    .bind(sinceDay)
    .all<{ day: string; registers: string }>();
  const dailyUnique = (dailyRows.results ?? []).map((r) => ({
    day: r.day,
    users: hllEstimate(fromBase64(r.registers)),
  }));

  const totalRow = await db
    .prepare(
      "SELECT registers FROM analytics_hll WHERE key = 'total_users' LIMIT 1"
    )
    .first<{ registers: string }>();
  const totalUniqueUsersEstimatedByTraffic = totalRow?.registers
    ? hllEstimate(fromBase64(totalRow.registers))
    : 0;

  const nonWorkspaceRow = await db
    .prepare(
      "SELECT registers FROM analytics_hll WHERE key = 'non_workspace_users' LIMIT 1"
    )
    .first<{ registers: string }>();
  const nonWorkspaceUniqueUsers = nonWorkspaceRow?.registers
    ? hllEstimate(fromBase64(nonWorkspaceRow.registers))
    : 0;
  const nonWorkspaceAthletesRow = await db
    .prepare(
      "SELECT registers FROM analytics_hll WHERE key = 'non_workspace_athletes' LIMIT 1"
    )
    .first<{ registers: string }>();
  const nonWorkspaceAthleteProfilesEstimated = nonWorkspaceAthletesRow?.registers
    ? hllEstimate(fromBase64(nonWorkspaceAthletesRow.registers))
    : 0;

  const countryUserRows = await db
    .prepare(
      "SELECT country, registers FROM analytics_hll WHERE metric = 'country_users'"
    )
    .all<{ country: string; registers: string }>();
  const countryUsers = new Map<string, number>();
  for (const row of countryUserRows.results ?? []) {
    countryUsers.set(row.country, hllEstimate(fromBase64(row.registers)));
  }

  const countryRequestRows = await db
    .prepare(
      "SELECT country, request_count FROM analytics_country_requests ORDER BY request_count DESC"
    )
    .all<{ country: string; request_count: number }>();
  const countryBreakdown = (countryRequestRows.results ?? []).map((r) => ({
    country: r.country,
    requests: r.request_count,
    users: countryUsers.get(r.country) ?? 0,
  }));

  const workspaceCountRow = await db
    .prepare("SELECT COUNT(*) as cnt FROM workspaces")
    .first<{ cnt: number }>();
  const workspaces = Number(workspaceCountRow?.cnt ?? 0);

  const workspaceUsersRow = await db
    .prepare(
      "SELECT COUNT(DISTINCT user_sub) as cnt FROM memberships WHERE is_active = 1"
    )
    .first<{ cnt: number }>();
  const workspaceUsers = Number(workspaceUsersRow?.cnt ?? 0);

  const avgMembersRow = await db
    .prepare(
      `SELECT AVG(member_count) as avg_members
       FROM (
         SELECT w.id, COUNT(m.user_sub) as member_count
         FROM workspaces w
         LEFT JOIN memberships m
           ON m.workspace_id = w.id AND m.is_active = 1
         GROUP BY w.id
       )`
    )
    .first<{ avg_members: number | null }>();
  const avgMembersPerWorkspace = Number(avgMembersRow?.avg_members ?? 0);
  const totalUniqueUsers = workspaceUsers + nonWorkspaceUniqueUsers;

  const dataRows = await db
    .prepare("SELECT workspace_id, data_json FROM workspace_data")
    .all<{ workspace_id: string; data_json: string }>();
  let completedTests = 0;
  let automatedBess = 0;
  let manualBess = 0;
  const workspaceAthleteProfiles = new Set<string>();

  for (const row of dataRows.results ?? []) {
    const obj = safeJsonParse(row.data_json);
    for (const test of Object.values(obj)) {
      if (!test || typeof test !== "object" || Array.isArray(test)) continue;
      const t = test as Record<string, unknown>;
      if (t.athlete_id === "deleted") continue;
      const athleteId = String(t.athlete_id ?? "").trim();
      if (athleteId) {
        workspaceAthleteProfiles.add(`${row.workspace_id}:${athleteId}`);
      }
      const testType = String(t.test_type ?? "");
      if (!testType || testType === "NO-TEST") continue;
      completedTests += 1;

      const hasBess =
        t.mBESS_total_errors !== undefined ||
        t.mBESS_foam_total_errors !== undefined ||
        t.mBESS_pose_error_photos !== undefined;
      if (!hasBess) continue;

      const automated =
        t.mBESS_pose_error_photos !== undefined &&
        t.mBESS_pose_error_photos !== null;
      if (automated) automatedBess += 1;
      else manualBess += 1;
    }
  }

  const eventCountersRows = await db
    .prepare("SELECT metric, value FROM analytics_event_counters")
    .all<{ metric: string; value: number }>();
  const eventCounters = new Map<string, number>();
  for (const row of eventCountersRows.results ?? []) {
    eventCounters.set(row.metric, Number(row.value ?? 0));
  }

  completedTests += eventCounters.get("local_tests_completed") ?? 0;
  automatedBess += eventCounters.get("local_bess_automated_completed") ?? 0;
  manualBess += eventCounters.get("local_bess_manual_completed") ?? 0;
  const totalAthleteProfiles =
    workspaceAthleteProfiles.size + nonWorkspaceAthleteProfilesEstimated;

  return {
    generatedAt: new Date().toISOString(),
    dailyUnique,
    totalUniqueUsers,
    totalUniqueUsersEstimatedByTraffic,
    countryBreakdown,
    metrics: {
      completedTests,
      workspaces,
      workspaceUsers,
      nonWorkspaceUniqueUsersEstimated: nonWorkspaceUniqueUsers,
      totalAthleteProfiles,
      workspaceAthleteProfiles: workspaceAthleteProfiles.size,
      nonWorkspaceAthleteProfilesEstimated,
      avgMembersPerWorkspace,
      bessAutomated: automatedBess,
      bessManual: manualBess,
    },
  };
}

function renderLoginHtml(error = "") {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SCAT6 Admin Login</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background:#f5f7fb; }
    form { background:#fff; padding:24px; border-radius:12px; box-shadow:0 8px 30px rgba(0,0,0,.12); min-width:320px; }
    input { width:100%; padding:10px; margin:8px 0 12px; }
    button { width:100%; padding:10px; }
    .err { color:#b00020; margin-bottom:8px; }
  </style>
</head>
<body>
  <form method="post" action="/admin/login">
    <h2>SCAT6 Admin</h2>
    ${error ? `<div class="err">${error}</div>` : ""}
    <label>Password</label>
    <input type="password" name="password" autocomplete="current-password" required />
    <button type="submit">Sign In</button>
  </form>
</body>
</html>`;
}

function renderDashboardHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SCAT6 Admin Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; background:#f5f7fb; color:#111827; }
    header { padding: 16px 20px; background:#111827; color:#fff; display:flex; justify-content:space-between; align-items:center; }
    main { padding: 20px; display:grid; gap:16px; grid-template-columns: repeat(auto-fit,minmax(320px,1fr)); }
    .card { background:#fff; border-radius:12px; padding:16px; box-shadow:0 4px 20px rgba(0,0,0,.08); }
    .chart-wrap { position: relative; height: 280px; }
    .chart-wrap canvas { width: 100% !important; height: 100% !important; display:block; }
    .metrics { display:grid; grid-template-columns: repeat(2,minmax(120px,1fr)); gap:10px; }
    .metric { background:#f3f4f6; border-radius:8px; padding:10px; }
    table { width:100%; border-collapse:collapse; font-size:12px; }
    th, td { padding:6px; border-bottom:1px solid #e5e7eb; text-align:left; }
  </style>
</head>
<body>
  <header>
    <strong>SCAT6 Workspace Admin</strong>
    <form method="post" action="/admin/logout"><button type="submit">Logout</button></form>
  </header>
  <main>
    <section class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <h3 style="margin:0">Unique Users (Daily)</h3>
        <label style="font-size:12px;color:#6b7280">
          Range
          <select id="daysFilter" style="margin-left:6px">
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
            <option value="60" selected>60 days</option>
            <option value="90">90 days</option>
            <option value="120">120 days</option>
          </select>
        </label>
      </div>
      <div class="chart-wrap"><canvas id="dailyUsers"></canvas></div>
    </section>
    <section class="card">
      <h3>Totals</h3>
      <div class="metrics" id="metrics"></div>
    </section>
    <section class="card" style="grid-column:1/-1">
      <h3>Country Breakdown (Users + Requests)</h3>
      <table id="countryTable"><thead><tr><th>Country</th><th>Users (est.)</th><th>Requests</th></tr></thead><tbody></tbody></table>
    </section>
  </main>
  <script>
    function heatColor(v, max) {
      if (!max) return 'transparent';
      const p = Math.min(1, v / max);
      const a = 0.1 + p * 0.6;
      return 'rgba(59,130,246,' + a.toFixed(2) + ')';
    }
    let dailyUsersChart = null;

    function automatedBessPercent(metrics) {
      const automated = Number(metrics.bessAutomated || 0);
      const manual = Number(metrics.bessManual || 0);
      const total = automated + manual;
      if (!total) return '0%';
      return (100 * automated / total).toFixed(1) + '%';
    }

    function renderDashboard(data) {
      if (dailyUsersChart) {
        dailyUsersChart.destroy();
      }
      dailyUsersChart = new Chart(document.getElementById('dailyUsers').getContext('2d'), {
          type: 'line',
          data: {
            labels: data.dailyUnique.map(d => d.day),
            datasets: [{ label: 'Daily Unique Users (est.)', data: data.dailyUnique.map(d => d.users), borderColor: '#2563eb', tension: 0.2 }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  precision: 0
                }
              }
            }
          }
        });

        const m = data.metrics;
        const metrics = [
          ['Total Users (workspace exact + non-workspace est.)', data.totalUniqueUsers],
          ['Workspace Users (exact)', m.workspaceUsers],
          ['Non-Workspace Users (est.)', m.nonWorkspaceUniqueUsersEstimated],
          ['Workspaces', m.workspaces],
          ['Avg Members / Workspace', Number(m.avgMembersPerWorkspace || 0).toFixed(2)],
          ['Total Athlete Profiles', m.totalAthleteProfiles],
          ['Workspace Athlete Profiles (exact)', m.workspaceAthleteProfiles],
          ['Non-Workspace Athlete Profiles (est.)', m.nonWorkspaceAthleteProfilesEstimated],
          ['Completed Tests', m.completedTests],
          ['Automated BESS Rate', automatedBessPercent(m)],
        ];
        const metricsEl = document.getElementById('metrics');
        metricsEl.innerHTML = '';
        metrics.forEach(([k,v]) => {
          const d = document.createElement('div');
          d.className = 'metric';
          d.innerHTML = '<div style="font-size:12px;color:#6b7280">' + k + '</div><div style="font-size:20px;font-weight:700">' + v + '</div>';
          metricsEl.appendChild(d);
        });

        const rows = data.countryBreakdown || [];
        const maxUsers = Math.max(...rows.map(r => r.users), 0);
        const maxReq = Math.max(...rows.map(r => r.requests), 0);
        const tbody = document.querySelector('#countryTable tbody');
        rows.slice(0, 80).forEach(r => {
          const tr = document.createElement('tr');
          tr.innerHTML = '<td>' + r.country + '</td><td>' + r.users + '</td><td>' + r.requests + '</td>';
          tr.children[1].style.background = heatColor(r.users, maxUsers);
          tr.children[2].style.background = heatColor(r.requests, maxReq);
          tbody.appendChild(tr);
        });
    }

    function loadStats(days) {
      return fetch('/admin/api/stats?days=' + encodeURIComponent(days), { credentials: 'include' })
        .then(r => r.ok ? r.json() : Promise.reject(r))
        .then(renderDashboard)
        .catch(() => {
          alert('Failed to load dashboard data.');
        });
    }

    const daysFilter = document.getElementById('daysFilter');
    daysFilter.addEventListener('change', () => {
      loadStats(daysFilter.value);
    });
    loadStats(daysFilter.value);
  </script>
</body>
</html>`;
}

async function verifyGoogleIdToken(idToken: string): Promise<User | null> {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(
      idToken
    )}`
  );
  if (!res.ok) return null;

  const tokenInfo = (await res.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
    exp?: string;
  };

  if (!tokenInfo.sub || !tokenInfo.email) return null;
  if (
    !tokenInfo.exp ||
    Number(tokenInfo.exp) <= Math.floor(Date.now() / 1000)
  ) {
    return null;
  }

  return {
    sub: tokenInfo.sub,
    email: tokenInfo.email,
    name: tokenInfo.name || tokenInfo.email,
    picture: tokenInfo.picture || "",
  };
}

export default app;
