export const WALLET_MANIFEST_SCHEMA_VERSION = 1;

export interface WalletManifestOrbitEntry {
  id: string;
  storageRoot: string;
  updatedAt: number;
}

export interface WalletManifestAlertEntry {
  id: string;
  orbitId: string;
  storageRoot: string;
  createdAt: number;
}

/** Plaintext wallet index on 0G Storage — pointers to orbit/alert snapshots. */
export interface WalletManifest {
  schemaVersion: number;
  type: "wallet_manifest";
  wallet: string;
  sequence: number;
  prevManifestRoot?: string;
  orbits: WalletManifestOrbitEntry[];
  alerts: WalletManifestAlertEntry[];
  updatedAt: number;
}

export interface WalletCacheRow {
  wallet: string;
  manifestRoot?: string;
  manifestSequence: number;
  prevManifestRoot?: string;
  updatedAt: number;
}
