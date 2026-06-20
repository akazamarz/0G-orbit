import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadConfig } from "@orbit/shared";
import { SCHEMA_SQL } from "./schema.js";
import { migrateSubscriptionsTable, migrateSubscriptionTopic, migrateWalletTelegram } from "./migrate.js";
import { logger } from "../utils/logger.js";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const config = loadConfig();
  mkdirSync(dirname(config.DB_PATH), { recursive: true });
  db = new Database(config.DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  migrateSubscriptionsTable(db);
  migrateSubscriptionTopic(db);
  migrateWalletTelegram(db);
  logger.info({ path: config.DB_PATH }, "sqlite initialized");
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
