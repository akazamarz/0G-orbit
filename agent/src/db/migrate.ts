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
}
