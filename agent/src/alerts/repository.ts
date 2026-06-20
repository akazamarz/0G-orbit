import { getDb } from "../db/client.js";
import type { Alert, AlertCursor, AlertFeedResponse } from "@orbit/shared";

export interface ListAlertFeedParams {
  wallet: string;
  orbitId?: string;
  limit?: number;
  before?: AlertCursor;
  after?: AlertCursor;
}

const MAX_LIMIT = 50;

function rowToAlert(row: Record<string, unknown>): Alert {
  return {
    id: String(row.id),
    orbitId: String(row.orbit_id),
    wallet: String(row.wallet),
    tweet: JSON.parse(String(row.tweet_json)),
    summary: String(row.summary),
    score: Number(row.score),
    storageRoot: (row.storage_root as string) ?? undefined,
    attestationTxHash: (row.attestation_tx_hash as string) ?? undefined,
    sentToTelegram: Boolean(row.sent_to_telegram),
    createdAt: Number(row.created_at),
  };
}

export function parseAlertCursor(raw: string | undefined): AlertCursor | undefined {
  if (!raw) return undefined;
  const sep = raw.indexOf(":");
  if (sep <= 0) return undefined;
  const createdAt = Number(raw.slice(0, sep));
  const id = decodeURIComponent(raw.slice(sep + 1));
  if (!Number.isFinite(createdAt) || !id) return undefined;
  return { createdAt, id };
}

export function countAlerts(wallet: string, orbitId?: string): number {
  if (orbitId) {
    const row = getDb()
      .prepare("SELECT COUNT(*) AS c FROM alerts WHERE wallet = ? AND orbit_id = ?")
      .get(wallet, orbitId) as { c: number };
    return Number(row.c);
  }
  const row = getDb()
    .prepare("SELECT COUNT(*) AS c FROM alerts WHERE wallet = ?")
    .get(wallet) as { c: number };
  return Number(row.c);
}

export function listAlertFeed(params: ListAlertFeedParams): AlertFeedResponse {
  const limit = Math.min(Math.max(params.limit ?? 20, 1), MAX_LIMIT);
  const fetchLimit = limit + 1;

  const conditions: string[] = ["wallet = ?"];
  const bindings: unknown[] = [params.wallet];

  if (params.orbitId) {
    conditions.push("orbit_id = ?");
    bindings.push(params.orbitId);
  }

  if (params.before) {
    conditions.push("(created_at < ? OR (created_at = ? AND id < ?))");
    bindings.push(params.before.createdAt, params.before.createdAt, params.before.id);
  }

  if (params.after) {
    conditions.push("(created_at > ? OR (created_at = ? AND id > ?))");
    bindings.push(params.after.createdAt, params.after.createdAt, params.after.id);
  }

  const sql = `SELECT * FROM alerts WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC, id DESC LIMIT ?`;
  bindings.push(fetchLimit);

  const rows = getDb().prepare(sql).all(...bindings) as Record<string, unknown>[];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const items = page.map(rowToAlert);

  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last ? { createdAt: last.createdAt, id: last.id } : null;

  return {
    items,
    nextCursor,
    hasMore,
    total: countAlerts(params.wallet, params.orbitId),
  };
}

export function listUnattestedAlerts(wallet: string): Alert[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM alerts
       WHERE wallet = ?
         AND storage_root IS NOT NULL
         AND storage_root != ''
         AND (attestation_tx_hash IS NULL OR attestation_tx_hash = '')
       ORDER BY created_at ASC`,
    )
    .all(wallet) as Record<string, unknown>[];
  return rows.map(rowToAlert);
}

export function countUnattestedAlerts(wallet: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM alerts
       WHERE wallet = ?
         AND storage_root IS NOT NULL
         AND storage_root != ''
         AND (attestation_tx_hash IS NULL OR attestation_tx_hash = '')`,
    )
    .get(wallet) as { c: number };
  return Number(row.c);
}

export { rowToAlert };
