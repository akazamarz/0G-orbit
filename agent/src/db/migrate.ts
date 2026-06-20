import type Database from "better-sqlite3";

function orbitTableName(db: Database.Database): string {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('orbits', 'subscriptions')")
    .all() as { name: string }[];
  if (rows.some((r) => r.name === "orbits")) return "orbits";
  if (rows.some((r) => r.name === "subscriptions")) return "subscriptions";
  return "orbits";
}

function columnNames(db: Database.Database): Set<string> {
  const table = orbitTableName(db);
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

/** Upgrade legacy intent/watch_type/mode rows to source/title/criteria/notify_telegram. */
export function migrateSubscriptionsTable(db: Database.Database): void {
  const table = orbitTableName(db);
  const cols = columnNames(db);
  if (cols.size === 0) return;

  if (!cols.has("title")) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN source TEXT NOT NULL DEFAULT 'custom'`);
    db.exec(`ALTER TABLE ${table} ADD COLUMN title TEXT NOT NULL DEFAULT ''`);
    db.exec(`ALTER TABLE ${table} ADD COLUMN criteria TEXT NOT NULL DEFAULT ''`);
    db.exec(`ALTER TABLE ${table} ADD COLUMN list_id TEXT`);
    db.exec(`ALTER TABLE ${table} ADD COLUMN notify_telegram INTEGER NOT NULL DEFAULT 0`);
  }

  if (cols.has("intent")) {
    db.exec(`
      UPDATE ${table}
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

  dropLegacyOrbitColumns(db);
}

/** Remove pre-overhaul columns (intent, watch_type, mode) after data backfill. */
export function dropLegacyOrbitColumns(db: Database.Database): void {
  const table = orbitTableName(db);
  for (const legacy of ["watch_type", "mode", "intent"] as const) {
    const cols = columnNames(db);
    if (!cols.has(legacy)) continue;
    db.exec(`ALTER TABLE ${table} DROP COLUMN ${legacy}`);
  }
}

/** @deprecated use dropLegacyOrbitColumns */
export const dropLegacySubscriptionColumns = dropLegacyOrbitColumns;

export function orbitColumnNames(db: Database.Database): Set<string> {
  return columnNames(db);
}

/** @deprecated use orbitColumnNames */
export const subscriptionColumnNames = orbitColumnNames;

/** Add topic column for custom orbits (search subject separate from display title). */
export function migrateSubscriptionTopic(db: Database.Database): void {
  const table = orbitTableName(db);
  const cols = columnNames(db);
  if (cols.size === 0) return;
  if (!cols.has("topic")) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN topic TEXT`);
    db.exec(`
      UPDATE ${table}
      SET topic = title
      WHERE source = 'custom' AND (topic IS NULL OR topic = '')
    `);
  }
}

/** Add upgraded_criteria and last_polled_at for poll pipeline. */
export function migrateSubscriptionPolling(db: Database.Database): void {
  const table = orbitTableName(db);
  const cols = columnNames(db);
  if (cols.size === 0) return;
  if (!cols.has("upgraded_criteria")) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN upgraded_criteria TEXT`);
    db.exec(`
      UPDATE ${table}
      SET upgraded_criteria = CASE
        WHEN criteria IS NOT NULL AND criteria != '' THEN
          'Orbit: ' || title || CASE WHEN topic IS NOT NULL AND topic != '' THEN '. Topic: ' || topic ELSE '' END || '. ' || criteria
        ELSE title
      END
      WHERE upgraded_criteria IS NULL OR upgraded_criteria = ''
    `);
  }
  if (!cols.has("last_polled_at")) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN last_polled_at INTEGER`);
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_orbits_active_poll ON ${table}(paused, last_polled_at)`);
}

/** Create wallet_telegram and backfill from legacy orbits.telegram_chat_id. */
export function migrateWalletTelegram(db: Database.Database): void {
  const table = orbitTableName(db);
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
    FROM ${table} s
    INNER JOIN (
      SELECT wallet, MAX(updated_at) AS max_updated
      FROM ${table}
      WHERE telegram_chat_id IS NOT NULL
      GROUP BY wallet
    ) latest ON s.wallet = latest.wallet AND s.updated_at = latest.max_updated
    WHERE s.telegram_chat_id IS NOT NULL
  `);
}

/** Composite indexes for cursor-paginated alert feeds. */
export function migrateAlertFeedIndexes(db: Database.Database): void {
  const alertCols = db.prepare("PRAGMA table_info(alerts)").all() as { name: string }[];
  const orbitCol = alertCols.some((c) => c.name === "orbit_id") ? "orbit_id" : "subscription_id";
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_alerts_wallet_created ON alerts(wallet, created_at);
    CREATE INDEX IF NOT EXISTS idx_alerts_orbit_created ON alerts(${orbitCol}, created_at);
  `);
}

/** Rename legacy subscriptions table/columns before SCHEMA_SQL indexes run. */
export function renameLegacyOrbitSchema(db: Database.Database): void {
  const tables = new Set(
    (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(
      (r) => r.name,
    ),
  );

  if (tables.has("subscriptions") && tables.has("orbits")) {
    const orbitRows = (db.prepare("SELECT COUNT(*) AS c FROM orbits").get() as { c: number }).c;
    const subRows = (db.prepare("SELECT COUNT(*) AS c FROM subscriptions").get() as { c: number }).c;
    if (orbitRows === 0 && subRows > 0) {
      db.exec("DROP TABLE orbits");
      tables.delete("orbits");
    }
  }

  if (tables.has("subscriptions") && !tables.has("orbits")) {
    db.exec("ALTER TABLE subscriptions RENAME TO orbits");
  }

  if (tables.has("alerts")) {
    const alertCols = db.prepare("PRAGMA table_info(alerts)").all() as { name: string }[];
    if (alertCols.some((c) => c.name === "subscription_id")) {
      db.exec("ALTER TABLE alerts RENAME COLUMN subscription_id TO orbit_id");
    }
  }

  if (tables.has("seen_tweets")) {
    const seenCols = db.prepare("PRAGMA table_info(seen_tweets)").all() as { name: string }[];
    if (seenCols.some((c) => c.name === "subscription_id")) {
      db.exec("ALTER TABLE seen_tweets RENAME COLUMN subscription_id TO orbit_id");
    }
  }
}

/** Drop legacy indexes and ensure orbit_id indexes exist. */
export function ensureOrbitIndexes(db: Database.Database): void {
  db.exec(`
    DROP INDEX IF EXISTS idx_subscriptions_wallet;
    DROP INDEX IF EXISTS idx_subscriptions_active_poll;
    DROP INDEX IF EXISTS idx_alerts_subscription;
    DROP INDEX IF EXISTS idx_alerts_sub_created;
    CREATE INDEX IF NOT EXISTS idx_orbits_wallet ON orbits(wallet);
    CREATE INDEX IF NOT EXISTS idx_orbits_active_poll ON orbits(paused, last_polled_at);
    CREATE INDEX IF NOT EXISTS idx_alerts_orbit ON alerts(orbit_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_orbit_created ON alerts(orbit_id, created_at);
  `);
}

/** Rename subscriptions table/columns to orbits naming. */
export function migrateOrbitNaming(db: Database.Database): void {
  renameLegacyOrbitSchema(db);
  ensureOrbitIndexes(db);
}
