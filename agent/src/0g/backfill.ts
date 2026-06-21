import { getDb } from "../db/client.js";
import { logger } from "../utils/logger.js";
import type { Alert, Orbit } from "@orbit/shared";
import { getOrbit } from "../orbits/repository.js";
import { rowToAlert } from "../alerts/repository.js";
import { persistAlertToStorage, persistOrbitToStorage } from "./persist.js";
import { uploadWalletManifest, cancelWalletManifestUpdate } from "./manifest.js";

function rowToOrbit(row: Record<string, unknown>): Orbit {
  return {
    id: String(row.id),
    wallet: String(row.wallet),
    source: String(row.source ?? "custom") as Orbit["source"],
    title: String(row.title ?? ""),
    topic: (row.topic as string) ?? undefined,
    criteria: String(row.criteria ?? ""),
    upgradedCriteria: (row.upgraded_criteria as string) ?? undefined,
    listId: (row.list_id as string) ?? undefined,
    notifyTelegram: Boolean(row.notify_telegram),
    generatedQuery: String(row.generated_query ?? ""),
    queryVersion: Number(row.query_version),
    pollIntervalMs: Number(row.poll_interval_ms),
    lastPolledAt: row.last_polled_at != null ? Number(row.last_polled_at) : undefined,
    paused: Boolean(row.paused),
    storageRoot: (row.storage_root as string) ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export interface BackfillResult {
  wallet: string;
  orbitsUploaded: number;
  alertsUploaded: number;
  manifestRoot: string;
  manifestSequence: number;
}

/** Upload missing entity snapshots then publish wallet manifest. */
export async function backfillWalletStorage(wallet: string): Promise<BackfillResult> {
  const db = getDb();
  const orbitRows = db
    .prepare(
      `SELECT * FROM orbits
       WHERE wallet = ? AND (storage_root IS NULL OR storage_root = '')
       ORDER BY created_at ASC`,
    )
    .all(wallet) as Record<string, unknown>[];

  const alertRows = db
    .prepare(
      `SELECT * FROM alerts
       WHERE wallet = ? AND (storage_root IS NULL OR storage_root = '')
       ORDER BY created_at ASC`,
    )
    .all(wallet) as Record<string, unknown>[];

  let orbitsUploaded = 0;
  let alertsUploaded = 0;

  for (const row of orbitRows) {
    const orbit = getOrbit(String(row.id)) ?? rowToOrbit(row);
    try {
      await persistOrbitToStorage(orbit, { skipManifest: true });
      orbitsUploaded += 1;
    } catch (err) {
      logger.error({ err, orbitId: orbit.id }, "backfill orbit upload failed");
    }
  }

  for (const row of alertRows) {
    const alert = rowToAlert(row);
    try {
      await persistAlertToStorage(alert, { skipManifest: true });
      alertsUploaded += 1;
    } catch (err) {
      logger.error({ err, alertId: alert.id }, "backfill alert upload failed");
    }
  }

  cancelWalletManifestUpdate(wallet);
  const { manifestRoot, sequence } = await uploadWalletManifest(wallet);
  logger.info(
    { wallet, orbitsUploaded, alertsUploaded, manifestRoot, sequence },
    "wallet storage backfill complete",
  );

  return {
    wallet,
    orbitsUploaded,
    alertsUploaded,
    manifestRoot,
    manifestSequence: sequence,
  };
}
