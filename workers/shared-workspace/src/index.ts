import type { Context } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";

type Env = {
  Bindings: {
    DB: D1Database;
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
  if (c.req.method === "OPTIONS" || c.req.path === "/api/health") {
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
