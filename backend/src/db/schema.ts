export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS offers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  url_template TEXT NOT NULL,
  payout      REAL NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clicks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  offer_id   INTEGER NOT NULL REFERENCES offers(id),
  ip         TEXT NOT NULL,
  user_agent TEXT,
  referer    TEXT,
  country    TEXT,
  sub1       TEXT,
  sub2       TEXT,
  sub3       TEXT,
  redirected INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_clicks_offer  ON clicks(offer_id);
CREATE INDEX IF NOT EXISTS idx_clicks_created ON clicks(created_at);
CREATE INDEX IF NOT EXISTS idx_clicks_sub1   ON clicks(sub1);
CREATE INDEX IF NOT EXISTS idx_clicks_ip     ON clicks(ip);

CREATE TABLE IF NOT EXISTS conversions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  click_id    INTEGER NOT NULL REFERENCES clicks(id),
  offer_id    INTEGER NOT NULL REFERENCES offers(id),
  payout      REAL NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending',
  external_id TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_conv_click   ON conversions(click_id);
CREATE INDEX IF NOT EXISTS idx_conv_offer   ON conversions(offer_id);
CREATE INDEX IF NOT EXISTS idx_conv_status  ON conversions(status);
CREATE INDEX IF NOT EXISTS idx_conv_created ON conversions(created_at);

CREATE TABLE IF NOT EXISTS blacklist (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type       TEXT NOT NULL CHECK (type IN ('ip','subnet')),
  value      TEXT NOT NULL,
  reason     TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_blacklist_value ON blacklist(value);

CREATE TABLE IF NOT EXISTS whitelist (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type       TEXT NOT NULL CHECK (type IN ('ip','subnet')),
  value      TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_whitelist_value ON whitelist(value);

CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS spends (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  offer_id   INTEGER REFERENCES offers(id),
  sub1       TEXT,
  amount     REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (offer_id, sub1)
);

CREATE INDEX IF NOT EXISTS idx_spends_offer ON spends(offer_id);
`;