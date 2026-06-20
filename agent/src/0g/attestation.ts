import { randomUUID } from "node:crypto";
import { ethers } from "ethers";
import {
  loadConfig,
  ATTESTATION_EIP712,
  ZG_CHAIN,
  type AttestationData,
  type AttestationStatusResponse,
  type EIP712Domain,
  type PendingAttestation,
  type AlertDigest,
} from "@orbit/shared";
import { getServerWallet } from "./chain.js";
import { ORBIT_ATTESTATION_ABI } from "./attestation-abi.js";
import { getDb } from "../db/client.js";
import { countUnattestedAlerts } from "../alerts/repository.js";
import { logger } from "../utils/logger.js";
import { StorageError } from "../utils/errors.js";
import { retry } from "../utils/retry.js";

type AttestationContract = ethers.Contract & {
  attestWithSignature(contentHash: string, storageRoot: string, deadline: bigint, signature: string): Promise<ethers.ContractTransactionResponse>;
  isAttested(contentHash: string): Promise<boolean>;
  getDomainSeparator(): Promise<string>;
};

let contract: AttestationContract | null = null;
let attestationDisabledLogged = false;

export function isAttestationEnabled(): boolean {
  return Boolean(loadConfig().ORBIT_ATTESTATION_ADDRESS);
}

export function getAttestationContract(): AttestationContract | null {
  const config = loadConfig();
  if (!config.ORBIT_ATTESTATION_ADDRESS) {
    if (!attestationDisabledLogged) {
      logger.info("ORBIT_ATTESTATION_ADDRESS not set - on-chain attestation disabled");
      attestationDisabledLogged = true;
    }
    return null;
  }
  if (contract) return contract;
  const wallet = getServerWallet();
  contract = new ethers.Contract(
    config.ORBIT_ATTESTATION_ADDRESS,
    ORBIT_ATTESTATION_ABI,
    wallet,
  ) as AttestationContract;
  return contract;
}

export function getEIP712Domain(): EIP712Domain | null {
  const config = loadConfig();
  if (!config.ORBIT_ATTESTATION_ADDRESS) return null;
  return {
    name: ATTESTATION_EIP712.name,
    version: ATTESTATION_EIP712.version,
    chainId: ZG_CHAIN.chainId,
    verifyingContract: config.ORBIT_ATTESTATION_ADDRESS,
  };
}

function rowToPendingAttestation(r: Record<string, unknown>): PendingAttestation {
  const deadline = Number(r.deadline);
  const now = Date.now();
  let status: PendingAttestation["status"] = "pending";
  if (r.status === "attested") {
    status = "attested";
  } else if (r.status === "expired" || deadline < now) {
    status = "expired";
  }

  const digest = JSON.parse(String(r.digest_json)) as AlertDigest;
  const summaries = digest.alerts?.map((a) => a.summary) ?? [];
  return {
    id: String(r.id),
    wallet: String(r.wallet),
    contentHash: String(r.content_hash),
    storageRoot: String(r.storage_root),
    digestId: String(r.digest_id),
    briefing: digest.briefing,
    alertCount: digest.alerts?.length ?? 1,
    alertSummaries: summaries.length > 0 ? summaries : undefined,
    deadline,
    status,
    txHash: (r.tx_hash as string) ?? undefined,
    createdAt: Number(r.created_at),
    attestedAt: r.attested_at ? Number(r.attested_at) : undefined,
  };
}

/** Drop per-alert pending rows from the old flow so batch UX stays clean. */
export function expireLegacySingleAlertPending(wallet: string): void {
  const rows = getDb()
    .prepare("SELECT id, digest_json FROM pending_attestations WHERE wallet = ? AND status = 'pending'")
    .all(wallet) as Record<string, unknown>[];

  for (const row of rows) {
    const digest = JSON.parse(String(row.digest_json)) as AlertDigest;
    if ((digest.alerts?.length ?? 1) <= 1) {
      getDb()
        .prepare("UPDATE pending_attestations SET status = 'expired' WHERE id = ?")
        .run(String(row.id));
    }
  }
}

export function getActivePendingBatch(wallet: string): PendingAttestation | null {
  const now = Date.now();
  const row = getDb()
    .prepare(
      `SELECT * FROM pending_attestations
       WHERE wallet = ? AND status = 'pending' AND deadline > ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(wallet, now) as Record<string, unknown> | undefined;

  if (!row) return null;
  const pending = rowToPendingAttestation(row);
  return pending.status === "pending" ? pending : null;
}

export function getAttestationStatus(wallet: string): AttestationStatusResponse {
  if (!isAttestationEnabled()) {
    return { enabled: false, domain: null, unattestedCount: 0, pendingBatch: null };
  }

  expireLegacySingleAlertPending(wallet);

  const pendingBatch = getActivePendingBatch(wallet);
  const unattestedCount = pendingBatch ? pendingBatch.alertCount : countUnattestedAlerts(wallet);

  return {
    enabled: true,
    domain: getEIP712Domain(),
    unattestedCount,
    pendingBatch,
  };
}

export async function attestWithSignature(
  walletAddress: string,
  contentHash: string,
  storageRoot: string,
  deadline: number,
  signature: string,
): Promise<AttestationData> {
  const c = getAttestationContract();
  if (!c) throw new StorageError("attestation contract not configured");

  logger.info({ walletAddress, contentHash, storageRoot, deadline }, "relaying user-signed attestation");

  try {
    const tx = await retry(
      async () => c.attestWithSignature(contentHash, storageRoot, BigInt(deadline), signature),
      { label: "attestation-relay" },
    );
    const receipt = await tx.wait();
    if (!receipt) throw new StorageError("attestation tx no receipt");
    logger.info({ txHash: receipt.hash }, "attestation confirmed on-chain");

    markAttestationComplete(contentHash, receipt.hash);

    return {
      wallet: walletAddress,
      contentHash,
      storageRoot,
      timestamp: Date.now(),
      txHash: receipt.hash,
    };
  } catch (err) {
    throw new StorageError("attestation relay failed", err);
  }
}

export async function isAttested(contentHash: string): Promise<boolean> {
  const c = getAttestationContract();
  if (!c) return false;
  return c.isAttested(contentHash);
}

export function createPendingAttestation(
  wallet: string,
  digest: AlertDigest,
  contentHash: string,
  storageRoot: string,
  deadline: number,
): void {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO pending_attestations (id, wallet, content_hash, storage_root, digest_id, digest_json, deadline, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    )
    .run(id, wallet, contentHash, storageRoot, digest.id, JSON.stringify(digest), deadline, Date.now());
  logger.info({ wallet, contentHash, storageRoot, deadline, alertCount: digest.alerts.length }, "pending attestation created");
}

export function listPendingAttestations(wallet: string): PendingAttestation[] {
  const rows = getDb()
    .prepare("SELECT * FROM pending_attestations WHERE wallet = ? ORDER BY created_at DESC")
    .all(wallet) as Record<string, unknown>[];
  return rows.map(rowToPendingAttestation);
}

export function markAttestationComplete(contentHash: string, txHash: string): void {
  const attestedAt = Date.now();
  const row = getDb()
    .prepare("SELECT digest_json FROM pending_attestations WHERE content_hash = ?")
    .get(contentHash) as { digest_json: string } | undefined;

  getDb()
    .prepare(
      "UPDATE pending_attestations SET status = 'attested', tx_hash = ?, attested_at = ? WHERE content_hash = ?",
    )
    .run(txHash, attestedAt, contentHash);

  if (!row) return;

  const digest = JSON.parse(row.digest_json) as AlertDigest;
  const update = getDb().prepare("UPDATE alerts SET attestation_tx_hash = ? WHERE id = ?");
  for (const alert of digest.alerts) {
    update.run(txHash, alert.id);
  }
}
