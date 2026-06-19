export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  intent TEXT NOT NULL,
  watch_type TEXT NOT NULL,
  mode TEXT NOT NULL,
  generated_query TEXT NOT NULL,
  query_version INTEGER NOT NULL DEFAULT 1,
  poll_interval_ms INTEGER NOT NULL,
  paused INTEGER NOT NULL DEFAULT 0,
  storage_root TEXT,
  telegram_chat_id INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS seen_tweets (
  subscription_id TEXT NOT NULL,
  tweet_id TEXT NOT NULL,
  seen_at INTEGER NOT NULL,
  PRIMARY KEY (subscription_id, tweet_id)
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  wallet TEXT NOT NULL,
  tweet_id TEXT NOT NULL,
  tweet_json TEXT NOT NULL,
  summary TEXT NOT NULL,
  score REAL NOT NULL,
  storage_root TEXT,
  attestation_tx_hash TEXT,
  sent_to_telegram INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL,
  wallet TEXT NOT NULL,
  rating TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS telegram_links (
  nonce TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  chat_id INTEGER,
  linked_at INTEGER,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_attestations (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  content_hash TEXT NOT NULL UNIQUE,
  storage_root TEXT NOT NULL,
  digest_id TEXT NOT NULL,
  digest_json TEXT NOT NULL,
  deadline INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tx_hash TEXT,
  created_at INTEGER NOT NULL,
  attested_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_wallet ON subscriptions(wallet);
CREATE INDEX IF NOT EXISTS idx_alerts_wallet ON alerts(wallet);
CREATE INDEX IF NOT EXISTS idx_alerts_subscription ON alerts(subscription_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_alert ON feedback(alert_id);
CREATE INDEX IF NOT EXISTS idx_pending_wallet ON pending_attestations(wallet);
CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_attestations(status);
`;
