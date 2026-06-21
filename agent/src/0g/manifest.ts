import type Database from "better-sqlite3";
import type { WalletManifest } from "@orbit/shared";
import { WALLET_MANIFEST_SCHEMA_VERSION } from "@orbit/shared";
import { getDb } from "../db/client.js";
import { logger } from "../utils/logger.js";
import { uploadJson } from "./storage.js";
import { getWalletCache, upsertWalletCache } from "./wallet-cache.js";

const MANIFEST_DEBOUNCE_MS = 5_000;
const pendingManifestTimers = new Map<string, ReturnType<typeof setTimeout>>();

function hasStorageRoot(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Build manifest snapshot from SQLite rows that already have storage_root. */
export function buildWalletManifestFromDb(
  db: Database.Database,
  wallet: string,
  sequence: number,
  prevManifestRoot?: string,
): WalletManifest {
  const orbitRows = db
    .prepare(
      `SELECT id, storage_root, updated_at FROM orbits
       WHERE wallet = ? AND storage_root IS NOT NULL AND storage_root != ''
       ORDER BY updated_at ASC, id ASC`,
    )
    .all(wallet) as Record<string, unknown>[];

  const alertRows = db
    .prepare(
      `SELECT id, orbit_id, storage_root, created_at FROM alerts
       WHERE wallet = ? AND storage_root IS NOT NULL AND storage_root != ''
       ORDER BY created_at ASC, id ASC`,
    )
    .all(wallet) as Record<string, unknown>[];

  return {
    schemaVersion: WALLET_MANIFEST_SCHEMA_VERSION,
    type: "wallet_manifest",
    wallet,
    sequence,
    prevManifestRoot,
    orbits: orbitRows.map((row) => ({
      id: String(row.id),
      storageRoot: String(row.storage_root),
      updatedAt: Number(row.updated_at),
    })),
    alerts: alertRows.map((row) => ({
      id: String(row.id),
      orbitId: String(row.orbit_id),
      storageRoot: String(row.storage_root),
      createdAt: Number(row.created_at),
    })),
    updatedAt: Date.now(),
  };
}

export function parseWalletManifest(raw: unknown, expectedWallet?: string): WalletManifest {
  if (!raw || typeof raw !== "object") {
    throw new Error("manifest payload is not an object");
  }
  const obj = raw as Record<string, unknown>;
  if (obj.type !== "wallet_manifest") {
    throw new Error(`unexpected manifest type: ${String(obj.type)}`);
  }
  if (Number(obj.schemaVersion) !== WALLET_MANIFEST_SCHEMA_VERSION) {
    throw new Error(`unsupported manifest schema version: ${String(obj.schemaVersion)}`);
  }
  const wallet = String(obj.wallet);
  if (expectedWallet && wallet.toLowerCase() !== expectedWallet.toLowerCase()) {
    throw new Error(`manifest wallet mismatch: expected ${expectedWallet}, got ${wallet}`);
  }
  if (!Array.isArray(obj.orbits) || !Array.isArray(obj.alerts)) {
    throw new Error("manifest missing orbits or alerts arrays");
  }

  return {
    schemaVersion: WALLET_MANIFEST_SCHEMA_VERSION,
    type: "wallet_manifest",
    wallet,
    sequence: Number(obj.sequence),
    prevManifestRoot: obj.prevManifestRoot != null ? String(obj.prevManifestRoot) : undefined,
    orbits: obj.orbits.map((entry) => {
      const e = entry as Record<string, unknown>;
      return {
        id: String(e.id),
        storageRoot: String(e.storageRoot),
        updatedAt: Number(e.updatedAt),
      };
    }),
    alerts: obj.alerts.map((entry) => {
      const e = entry as Record<string, unknown>;
      return {
        id: String(e.id),
        orbitId: String(e.orbitId),
        storageRoot: String(e.storageRoot),
        createdAt: Number(e.createdAt),
      };
    }),
    updatedAt: Number(obj.updatedAt),
  };
}

/** Upload wallet manifest to 0G and update wallet_cache. */
export async function uploadWalletManifest(wallet: string): Promise<{
  manifestRoot: string;
  sequence: number;
}> {
  const db = getDb();
  const cached = getWalletCache(wallet);
  const sequence = (cached?.manifestSequence ?? 0) + 1;
  const manifest = buildWalletManifestFromDb(db, wallet, sequence, cached?.manifestRoot);
  const label = `wallet-manifest-${wallet.slice(2, 10)}-${sequence}`;
  const { storageRoot } = await uploadJson(manifest, label);
  upsertWalletCache(wallet, storageRoot, sequence, cached?.manifestRoot);
  logger.info(
    {
      wallet,
      manifestRoot: storageRoot,
      sequence,
      orbits: manifest.orbits.length,
      alerts: manifest.alerts.length,
    },
    "wallet manifest uploaded to 0g",
  );
  return { manifestRoot: storageRoot, sequence };
}

async function runManifestUpload(wallet: string): Promise<void> {
  try {
    await uploadWalletManifest(wallet);
  } catch (err) {
    logger.error({ err, wallet }, "wallet manifest upload failed");
  }
}

/** Debounced manifest refresh after entity uploads complete. */
export function scheduleWalletManifestUpdate(wallet: string): void {
  const existing = pendingManifestTimers.get(wallet);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    pendingManifestTimers.delete(wallet);
    void runManifestUpload(wallet);
  }, MANIFEST_DEBOUNCE_MS);
  pendingManifestTimers.set(wallet, timer);
}

/** Cancel a pending debounced manifest upload without uploading. */
export function cancelWalletManifestUpdate(wallet: string): void {
  const existing = pendingManifestTimers.get(wallet);
  if (existing) {
    clearTimeout(existing);
    pendingManifestTimers.delete(wallet);
  }
}

/** Flush pending debounced manifest upload immediately (for CLI/tests). */
export async function flushWalletManifestUpdate(wallet: string): Promise<void> {
  const existing = pendingManifestTimers.get(wallet);
  if (existing) {
    clearTimeout(existing);
    pendingManifestTimers.delete(wallet);
  }
  await runManifestUpload(wallet);
}

export function isValidManifestEntry(entry: { storageRoot?: unknown }): boolean {
  return hasStorageRoot(entry.storageRoot);
}
