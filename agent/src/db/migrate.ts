import type Database from "better-sqlite3";

function columnNames(db: Database.Database): Set<string> {
  const rows = db.prepare("PRAGMA table_info(subscriptions)").all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

/** Upgrade legacy intent/watch_type/mode rows to source/title/criteria/notify_telegram. */
export function migrateSubscriptionsTable(db: Database.Database): void {
  const cols = columnNames(db);
  if (cols.size === 0) return;

  if (!cols.has("title")) {
    db.exec(`ALTER TABLE subscriptions ADD COLUMN source TEXT NOT NULL DEFAULT 'custom'`);
    db.exec(`ALTER TABLE subscriptions ADD COLUMN title TEXT NOT NULL DEFAULT ''`);
    db.exec(`ALTER TABLE subscriptions ADD COLUMN criteria TEXT NOT NULL DEFAULT ''`);
    db.exec(`ALTER TABLE subscriptions ADD COLUMN list_id TEXT`);
    db.exec(`ALTER TABLE subscriptions ADD COLUMN notify_telegram INTEGER NOT NULL DEFAULT 0`);
  }

  if (cols.has("intent")) {
    db.exec(`
      UPDATE subscriptions
      SET
        title = CASE WHEN title = '' OR title IS NULL THEN intent ELSE title END,
        criteria = CASE WHEN criteria = '' OR criteria IS NULL THEN intent ELSE criteria END,
        source = CASE
          WHEN source IS NOT NULL AND source != '' THEN source
          WHEN watch_type = 'lists' THEN 'list'
          ELSE 'custom'
        END,
        notify_telegram = CASE
          WHEN notify_telegram IS NOT NULL THEN notify_telegram
          WHEN mode = 'live' THEN 1
          ELSE 0
        END
      WHERE intent IS NOT NULL
    `);
  }

  dropLegacySubscriptionColumns(db);
}

/** Remove pre-overhaul columns (intent, watch_type, mode) after data backfill. */
export function dropLegacySubscriptionColumns(db: Database.Database): void {
  for (const legacy of ["watch_type", "mode", "intent"] as const) {
    const cols = columnNames(db);
    if (!cols.has(legacy)) continue;
    db.exec(`ALTER TABLE subscriptions DROP COLUMN ${legacy}`);
  }
}

export function subscriptionColumnNames(db: Database.Database): Set<string> {
  return columnNames(db);
}

/** Add topic column for custom orbits (search subject separate from display title). */
export function migrateSubscriptionTopic(db: Database.Database): void {
  const cols = columnNames(db);
  if (cols.size === 0) return;
  if (!cols.has("topic")) {
    db.exec(`ALTER TABLE subscriptions ADD COLUMN topic TEXT`);
    db.exec(`
      UPDATE subscriptions
      SET topic = title
      WHERE source = 'custom' AND (topic IS NULL OR topic = '')
    `);
  }
}

/** Add upgraded_criteria and last_polled_at for poll pipeline. */
export function migrateSubscriptionPolling(db: Database.Database): void {
  const cols = columnNames(db);
  if (cols.size === 0) return;
  if (!cols.has("upgraded_criteria")) {
    db.exec(`ALTER TABLE subscriptions ADD COLUMN upgraded_criteria TEXT`);
    db.exec(`
      UPDATE subscriptions
      SET upgraded_criteria = CASE
        WHEN criteria IS NOT NULL AND criteria != '' THEN
          'Orbit: ' || title || CASE WHEN topic IS NOT NULL AND topic != '' THEN '. Topic: ' || topic ELSE '' END || '. ' || criteria
        ELSE title
      END
      WHERE upgraded_criteria IS NULL OR upgraded_criteria = ''
    `);
  }
  if (!cols.has("last_polled_at")) {
    db.exec(`ALTER TABLE subscriptions ADD COLUMN last_polled_at INTEGER`);
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_subscriptions_active_poll ON subscriptions(paused, last_polled_at)`);
}

/** Create wallet_telegram and backfill from legacy subscriptions.telegram_chat_id. */
export function migrateWalletTelegram(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallet_telegram (
      wallet TEXT PRIMARY KEY,
      chat_id INTEGER NOT NULL UNIQUE,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      alerts_enabled INTEGER NOT NULL DEFAULT 1,
      linked_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_wallet_telegram_chat ON wallet_telegram(chat_id);
    CREATE INDEX IF NOT EXISTS idx_telegram_links_wallet ON telegram_links(wallet);
  `);

  db.exec(`
    INSERT OR IGNORE INTO wallet_telegram (wallet, chat_id, alerts_enabled, linked_at, updated_at)
    SELECT s.wallet, s.telegram_chat_id, 1, s.updated_at, s.updated_at
    FROM subscriptions s
    INNER JOIN (
      SELECT wallet, MAX(updated_at) AS max_updated
      FROM subscriptions
      WHERE telegram_chat_id IS NOT NULL
      GROUP BY wallet
    ) latest ON s.wallet = latest.wallet AND s.updated_at = latest.max_updated
    WHERE s.telegram_chat_id IS NOT NULL
  `);
}

/** Composite indexes for cursor-paginated alert feeds. */
export function migrateAlertFeedIndexes(db: Database.Database): void {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_alerts_wallet_created ON alerts(wallet, created_at);
    CREATE INDEX IF NOT EXISTS idx_alerts_sub_created ON alerts(subscription_id, created_at);
  `);
}
