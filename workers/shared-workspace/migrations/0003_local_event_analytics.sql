CREATE TABLE IF NOT EXISTS analytics_event_dedupe (
  event_key TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_event_counters (
  metric TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
