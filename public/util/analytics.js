import { getCachedWorkspaceState } from "./workspace.js";

const ANALYTICS_SENT_EVENTS = "analyticsSentEvents";

function workspaceApiBase() {
  return (window.__SCAT6_WORKSPACE_API_BASE || "").replace(/\/$/, "");
}

function eventEndpoint() {
  return `${workspaceApiBase()}/api/analytics/event`;
}

async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getSentEvents() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ANALYTICS_SENT_EVENTS) ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {}
  return {};
}

function hasSentEvent(cacheKey) {
  return getSentEvents()[cacheKey] === true;
}

function markEventSent(cacheKey) {
  const sent = getSentEvents();
  sent[cacheKey] = true;
  localStorage.setItem(ANALYTICS_SENT_EVENTS, JSON.stringify(sent));
}

function isNonWorkspaceStorageMode() {
  if (localStorage.getItem("synced") !== "true") {
    return true;
  }
  const { workspace, checkedAt } = getCachedWorkspaceState();
  if (checkedAt === 0) {
    return true;
  }
  return !workspace;
}

async function postAnalyticsEvent(payload) {
  const url = eventEndpoint();
  if (
    !(
      url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("/")
    )
  ) {
    return false;
  }
  try {
    const isCrossOriginAbsolute =
      (url.startsWith("http://") || url.startsWith("https://")) &&
      new URL(url).origin !== window.location.origin;

    // sendBeacon uses credentialed mode for cross-origin requests, which conflicts
    // with wildcard CORS responses. Skip beacon in that case.
    if (navigator.sendBeacon && !isCrossOriginAbsolute) {
      const blob = new Blob([JSON.stringify(payload)], {
        type: "application/json",
      });
      const queued = navigator.sendBeacon(url, blob);
      if (queued) return true;
    }

    const res = await fetch(url, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    return res.ok;
  } catch (err) {
    console.warn("Analytics event failed:", err?.message ?? err);
    return false;
  }
}

async function sendOnce(cacheKey, payloadBuilder) {
  if (hasSentEvent(cacheKey)) return;
  const payload = await payloadBuilder();
  const ok = await postAnalyticsEvent(payload);
  if (ok) {
    markEventSent(cacheKey);
  }
}

function hasBessData(test) {
  return (
    test.mBESS_total_errors !== undefined ||
    test.mBESS_foam_total_errors !== undefined ||
    test.mBESS_pose_error_photos !== undefined
  );
}

function bessMode(test) {
  if (
    test.mBESS_pose_error_photos &&
    typeof test.mBESS_pose_error_photos === "object"
  ) {
    return "automated";
  }
  return "manual";
}

export async function syncNonWorkspaceAnalyticsState(tests) {
  if (!isNonWorkspaceStorageMode()) return;

  await postAnalyticsEvent({
    eventType: "user_seen",
    eventId: await sha256Hex(
      `user_seen:${Date.now()}:${Math.random().toString(36).slice(2)}`
    ),
    storage: "non_workspace",
  });

  const athleteIds = new Set();
  for (const test of Object.values(tests ?? {})) {
    if (!test || typeof test !== "object") continue;
    if (!test.athlete_id || test.athlete_id === "deleted") continue;
    athleteIds.add(test.athlete_id);
  }

  for (const athleteId of athleteIds) {
    await sendOnce(`athlete_profile_seen:${athleteId}`, async () => ({
      eventType: "athlete_profile_seen",
      eventId: await sha256Hex(`athlete_profile_seen:${athleteId}`),
      storage: "non_workspace",
    }));
  }

  for (const test of Object.values(tests ?? {})) {
    if (!test || typeof test !== "object") continue;
    if (test.athlete_id === "deleted") continue;
    if (!test.test_type || test.test_type === "NO-TEST") continue;
    if (!test.test_id) continue;

    await sendOnce(`test_completed:${test.test_id}`, async () => ({
      eventType: "test_completed",
      eventId: await sha256Hex(`test_completed:${test.test_id}`),
      storage: "non_workspace",
    }));

    if (!hasBessData(test)) continue;
    const mode = bessMode(test);
    await sendOnce(`bess_completed:${mode}:${test.test_id}`, async () => ({
      eventType: "bess_completed",
      eventId: await sha256Hex(`bess_completed:${mode}:${test.test_id}`),
      mode,
      storage: "non_workspace",
    }));
  }
}
