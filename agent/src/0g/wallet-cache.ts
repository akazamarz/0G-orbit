import type { WalletCacheRow } from "@orbit/shared";
import { getDb } from "../db/client.js";

function rowToWalletCache(row: Record<string, unknown>): WalletCacheRow {
  return {
    wallet: String(row.wallet),
    manifestRoot: (row.manifest_root as string) ?? undefined,
    manifestSequence: Number(row.manifest_sequence),
    prevManifestRoot: (row.prev_manifest_root as string) ?? undefined,
    updatedAt: Number(row.updated_at),
  };
}

export function getWalletCache(wallet: string): WalletCacheRow | null {
  const row = getDb().prepare("SELECT * FROM wallet_cache WHERE wallet = ?").get(wallet) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToWalletCache(row) : null;
}

export function upsertWalletCache(
  wallet: string,
  manifestRoot: string,
  manifestSequence: number,
  prevManifestRoot?: string,
): void {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO wallet_cache (wallet, manifest_root, manifest_sequence, prev_manifest_root, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(wallet) DO UPDATE SET
         manifest_root = excluded.manifest_root,
         manifest_sequence = excluded.manifest_sequence,
         prev_manifest_root = excluded.prev_manifest_root,
         updated_at = excluded.updated_at`,
    )
    .run(wallet, manifestRoot, manifestSequence, prevManifestRoot ?? null, now);
}

export function listWalletsWithManifest(): string[] {
  const rows = getDb()
    .prepare(
      `SELECT wallet FROM wallet_cache
       WHERE manifest_root IS NOT NULL AND manifest_root != ''
       ORDER BY updated_at DESC`,
    )
    .all() as { wallet: string }[];
  return rows.map((r) => r.wallet);
}
