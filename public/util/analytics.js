import { getCachedWorkspaceState } from "./workspace.js";

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
  if (!(url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/"))) {
    return;
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
      if (queued) return;
    }
    await fetch(url, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (err) {
    console.warn("Analytics event failed:", err?.message ?? err);
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

export async function trackNonWorkspaceAthleteProfileSeen(athleteId) {
  if (!athleteId || typeof athleteId !== "string") return;
  if (athleteId === "deleted") return;
  if (!isNonWorkspaceStorageMode()) return;

  const eventId = await sha256Hex(`athlete_profile_seen:${athleteId}`);
  await postAnalyticsEvent({
    eventType: "athlete_profile_seen",
    eventId,
    storage: "non_workspace",
  });
}

export async function trackLocalCompletionEvents(test) {
  if (!test || typeof test !== "object") return;
  if (!isNonWorkspaceStorageMode()) return;
  if (test.athlete_id === "deleted") return;
  if (!test.test_type || test.test_type === "NO-TEST") return;
  if (!test.test_id) return;

  const testEventId = await sha256Hex(`test_completed:${test.test_id}`);
  await postAnalyticsEvent({
    eventType: "test_completed",
    eventId: testEventId,
    storage: "non_workspace",
  });

  if (!hasBessData(test)) return;
  const mode = bessMode(test);
  const bessEventId = await sha256Hex(`bess_completed:${mode}:${test.test_id}`);
  await postAnalyticsEvent({
    eventType: "bess_completed",
    eventId: bessEventId,
    mode,
    storage: "non_workspace",
  });
}
