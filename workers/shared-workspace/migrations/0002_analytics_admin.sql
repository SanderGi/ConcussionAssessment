CREATE TABLE IF NOT EXISTS analytics_hll (
  key TEXT PRIMARY KEY,
  metric TEXT NOT NULL,
  day TEXT,
  country TEXT,
  registers TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS analytics_hll_metric_day_idx
ON analytics_hll(metric, day);

CREATE INDEX IF NOT EXISTS analytics_hll_metric_country_idx
ON analytics_hll(metric, country);

CREATE TABLE IF NOT EXISTS analytics_country_requests (
  country TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
