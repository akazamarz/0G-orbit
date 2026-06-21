import type Database from "better-sqlite3";
import type { AlertStoragePayload, OrbitStoragePayload } from "./persist.js";
import type { WalletManifest } from "@orbit/shared";
import { getDb } from "../db/client.js";
import { logger } from "../utils/logger.js";
import { downloadJson } from "./storage.js";
import { getWalletCache, upsertWalletCache } from "./wallet-cache.js";
import { parseWalletManifest } from "./manifest.js";
import { orbitColumnNames } from "../db/migrate.js";

export interface HydrateResult {
  wallet: string;
  manifestRoot: string;
  orbitsRestored: number;
  alertsRestored: number;
}

function isOrbitPayload(raw: unknown): raw is OrbitStoragePayload {
  return !!raw && typeof raw === "object" && (raw as OrbitStoragePayload).type === "orbit";
}

function isAlertPayload(raw: unknown): raw is AlertStoragePayload {
  return !!raw && typeof raw === "object" && (raw as AlertStoragePayload).type === "alert";
}

/** Upsert orbit row from a 0G orbit snapshot. */
export function upsertOrbitFromStoragePayload(
  db: Database.Database,
  payload: OrbitStoragePayload,
  storageRoot: string,
): void {
  const cols = orbitColumnNames(db);
  const data: Record<string, unknown> = {
    id: payload.id,
    wallet: payload.wallet,
    source: payload.source,
    title: payload.title,
    topic: payload.topic ?? null,
    criteria: payload.criteria,
    upgraded_criteria: payload.upgradedCriteria ?? null,
    list_id: payload.listId ?? null,
    notify_telegram: payload.notifyTelegram ? 1 : 0,
    generated_query: payload.generatedQuery,
    query_version: payload.queryVersion,
    poll_interval_ms: payload.pollIntervalMs,
    paused: payload.paused ? 1 : 0,
    storage_root: storageRoot,
    created_at: payload.createdAt,
    updated_at: payload.updatedAt,
  };

  if (cols.has("intent")) data.intent = payload.topic ?? payload.title;
  if (cols.has("watch_type")) data.watch_type = payload.source === "list" ? "lists" : "search";
  if (cols.has("mode")) data.mode = payload.notifyTelegram ? "live" : "digest";

  const keys = Object.keys(data).filter((key) => cols.has(key));
  const placeholders = keys.map(() => "?").join(", ");
  const updates = keys.filter((k) => k !== "id").map((k) => `${k} = excluded.${k}`);

  db.prepare(
    `INSERT INTO orbits (${keys.join(", ")}) VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET ${updates.join(", ")}`,
  ).run(...keys.map((k) => data[k]));
}

/** Upsert alert row from a 0G alert snapshot. */
export function upsertAlertFromStoragePayload(
  db: Database.Database,
  payload: AlertStoragePayload,
  storageRoot: string,
): void {
  db.prepare(
    `INSERT INTO alerts (id, orbit_id, wallet, tweet_id, tweet_json, summary, score, storage_root, sent_to_telegram, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       orbit_id = excluded.orbit_id,
       wallet = excluded.wallet,
       tweet_id = excluded.tweet_id,
       tweet_json = excluded.tweet_json,
       summary = excluded.summary,
       score = excluded.score,
       storage_root = excluded.storage_root,
       sent_to_telegram = excluded.sent_to_telegram,
       created_at = excluded.created_at`,
  ).run(
    payload.id,
    payload.orbitId,
    payload.wallet,
    payload.tweet.id,
    JSON.stringify(payload.tweet),
    payload.summary,
    payload.score,
    storageRoot,
    payload.sentToTelegram ? 1 : 0,
    payload.createdAt,
  );
}

async function downloadEntity<T>(
  storageRoot: string,
  label: string,
  guard: (raw: unknown) => raw is T,
): Promise<T | null> {
  try {
    const raw = await downloadJson(storageRoot);
    if (!guard(raw)) {
      logger.warn({ label, storageRoot }, "0g entity payload type mismatch");
      return null;
    }
    return raw;
  } catch (err) {
    logger.error({ err, label, storageRoot }, "0g entity download failed during hydrate");
    return null;
  }
}

/** Restore SQLite from a wallet manifest and entity snapshots on 0G. */
export async function hydrateWallet(
  wallet: string,
  manifestRoot?: string,
): Promise<HydrateResult> {
  const normalized = wallet.toLowerCase();
  const root =
    manifestRoot ??
    getWalletCache(wallet)?.manifestRoot ??
    getWalletCache(normalized)?.manifestRoot;

  if (!root) {
    throw new Error(`no manifest_root for wallet ${wallet}; pass manifest root or run backfill first`);
  }

  const rawManifest = await downloadJson(root);
  const manifest = parseWalletManifest(rawManifest, wallet);
  const db = getDb();
  let orbitsRestored = 0;
  let alertsRestored = 0;

  for (const entry of manifest.orbits) {
    const payload = await downloadEntity(entry.storageRoot, `orbit-${entry.id}`, isOrbitPayload);
    if (!payload) continue;
    upsertOrbitFromStoragePayload(db, payload, entry.storageRoot);
    orbitsRestored += 1;
  }

  for (const entry of manifest.alerts) {
    const payload = await downloadEntity(entry.storageRoot, `alert-${entry.id}`, isAlertPayload);
    if (!payload) continue;
    upsertAlertFromStoragePayload(db, payload, entry.storageRoot);
    alertsRestored += 1;
  }

  upsertWalletCache(manifest.wallet, root, manifest.sequence, manifest.prevManifestRoot);

  logger.info(
    { wallet: manifest.wallet, manifestRoot: root, orbitsRestored, alertsRestored },
    "wallet hydrated from 0g",
  );

  return {
    wallet: manifest.wallet,
    manifestRoot: root,
    orbitsRestored,
    alertsRestored,
  };
}

/** Apply an in-memory manifest + entity map (for tests). */
export function applyWalletManifestLocally(
  db: Database.Database,
  manifest: WalletManifest,
  entities: Map<string, unknown>,
): { orbitsRestored: number; alertsRestored: number } {
  let orbitsRestored = 0;
  let alertsRestored = 0;

  for (const entry of manifest.orbits) {
    const raw = entities.get(entry.storageRoot);
    if (!isOrbitPayload(raw)) continue;
    upsertOrbitFromStoragePayload(db, raw, entry.storageRoot);
    orbitsRestored += 1;
  }

  for (const entry of manifest.alerts) {
    const raw = entities.get(entry.storageRoot);
    if (!isAlertPayload(raw)) continue;
    upsertAlertFromStoragePayload(db, raw, entry.storageRoot);
    alertsRestored += 1;
  }

  return { orbitsRestored, alertsRestored };
}
