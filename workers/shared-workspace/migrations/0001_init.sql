CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_sub TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  workspace_id TEXT NOT NULL,
  user_sub TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_picture TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner', 'member')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, user_sub),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS memberships_one_active_workspace_per_user
ON memberships(user_sub)
WHERE is_active = 1;

CREATE TABLE IF NOT EXISTS workspace_data (
  workspace_id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by_sub TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);
