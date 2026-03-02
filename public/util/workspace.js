const WORKSPACE_CACHE_MS = 30_000;
const HEALTH_CACHE_MS = 60_000;

let _cachedWorkspace = null;
let _cachedWorkspaceAt = 0;
let _healthOk = null;
let _healthCheckedAt = 0;

function workspaceApiBase() {
  return (window.__SCAT6_WORKSPACE_API_BASE || "").replace(/\/$/, "");
}

function apiUrl(path) {
  return `${workspaceApiBase()}${path}`;
}

async function parseError(res) {
  const fallback = `Request failed (${res.status})`;
  try {
    const data = await res.json();
    return data?.error || data?.message || fallback;
  } catch {
    return fallback;
  }
}

async function authFetch(path, idToken, options = {}) {
  const res = await fetch(apiUrl(path), {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function isWorkspaceApiAvailable({ force = false } = {}) {
  const now = Date.now();
  if (!force && _healthOk !== null && now - _healthCheckedAt < HEALTH_CACHE_MS) {
    return _healthOk;
  }

  try {
    const res = await fetch(apiUrl("/api/health"), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      _healthOk = false;
    } else {
      const data = await res.json().catch(() => null);
      _healthOk = data?.ok === true;
    }
  } catch {
    _healthOk = false;
  }
  _healthCheckedAt = now;
  return _healthOk;
}

export function clearWorkspaceCache() {
  _cachedWorkspace = null;
  _cachedWorkspaceAt = 0;
}

export async function getActiveWorkspaceState(idToken, { force = false } = {}) {
  const now = Date.now();
  if (!force && _cachedWorkspace && now - _cachedWorkspaceAt < WORKSPACE_CACHE_MS) {
    return _cachedWorkspace;
  }

  const data = await authFetch("/api/workspaces/me", idToken, {
    method: "GET",
  });
  _cachedWorkspace = data?.workspace ?? null;
  _cachedWorkspaceAt = now;
  return _cachedWorkspace;
}

export async function createSharedWorkspace(idToken, name) {
  const data = await authFetch("/api/workspaces/create", idToken, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  clearWorkspaceCache();
  return data.workspace;
}

export async function joinSharedWorkspace(idToken, inviteCode) {
  const data = await authFetch("/api/workspaces/join", idToken, {
    method: "POST",
    body: JSON.stringify({ inviteCode }),
  });
  clearWorkspaceCache();
  return data.workspace;
}

export async function leaveSharedWorkspace(idToken) {
  await authFetch("/api/workspaces/leave", idToken, {
    method: "POST",
    body: JSON.stringify({}),
  });
  clearWorkspaceCache();
}

export async function deleteSharedWorkspace(idToken, workspaceId) {
  await authFetch(`/api/workspaces/${workspaceId}/delete`, idToken, {
    method: "POST",
    body: JSON.stringify({}),
  });
  clearWorkspaceCache();
}

export async function getWorkspaceInvite(idToken, workspaceId) {
  const data = await authFetch(`/api/workspaces/${workspaceId}/invite`, idToken, {
    method: "GET",
  });
  return data;
}

export async function getWorkspaceMembers(idToken, workspaceId) {
  const data = await authFetch(`/api/workspaces/${workspaceId}/members`, idToken, {
    method: "GET",
  });
  return data?.members ?? [];
}

export async function removeWorkspaceMember(idToken, workspaceId, memberSub) {
  await authFetch(
    `/api/workspaces/${workspaceId}/members/${encodeURIComponent(memberSub)}/remove`,
    idToken,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
}

export async function getWorkspaceData(idToken, workspaceId) {
  const data = await authFetch(`/api/workspaces/${workspaceId}/data`, idToken, {
    method: "GET",
  });
  return data?.data ?? {};
}

export async function setWorkspaceData(idToken, workspaceId, tests) {
  await authFetch(`/api/workspaces/${workspaceId}/data`, idToken, {
    method: "PUT",
    body: JSON.stringify({ data: tests }),
  });
}
