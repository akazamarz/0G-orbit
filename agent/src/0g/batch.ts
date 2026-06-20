import { randomUUID } from "node:crypto";
import { loadConfig, type Alert, type AlertDigest, type PendingAttestation } from "@orbit/shared";
import { listUnattestedAlerts } from "../alerts/repository.js";
import { logger } from "../utils/logger.js";
import { StorageError } from "../utils/errors.js";
import {
  createPendingAttestation,
  expireLegacySingleAlertPending,
  getActivePendingBatch,
  isAttestationEnabled,
} from "./attestation.js";
import { hashPayload } from "./persist.js";
import { uploadJson } from "./storage.js";

const BATCH_SCHEMA_VERSION = 1;
const MAX_BATCH_ALERTS = 100;

export interface AlertBatchManifest {
  schemaVersion: number;
  type: "alert_batch";
  id: string;
  wallet: string;
  alerts: Array<{
    id: string;
    orbitId: string;
    storageRoot: string;
    summary: string;
    score: number;
    createdAt: number;
  }>;
  createdAt: number;
}

function buildBatchBriefing(alerts: Alert[]): string {
  const n = alerts.length;
  if (n === 0) return "Alert batch";
  if (n === 1) return alerts[0]!.summary;
  const preview = alerts[0]!.summary;
  const trimmed = preview.length > 120 ? `${preview.slice(0, 117)}…` : preview;
  return `${n} alerts · ${trimmed}`;
}

export async function createAttestationBatch(wallet: string): Promise<PendingAttestation> {
  if (!isAttestationEnabled()) {
    throw new StorageError("attestation contract not configured");
  }

  expireLegacySingleAlertPending(wallet);

  const existing = getActivePendingBatch(wallet);
  if (existing) return existing;

  const alerts = listUnattestedAlerts(wallet);
  if (alerts.length === 0) {
    throw new StorageError("no alerts ready for attestation");
  }

  const batchAlerts = alerts.slice(0, MAX_BATCH_ALERTS);
  if (batchAlerts.length < alerts.length) {
    logger.warn(
      { wallet, total: alerts.length, batched: batchAlerts.length },
      "attestation batch truncated to max size",
    );
  }

  const batchId = randomUUID();
  const now = Date.now();

  const manifest: AlertBatchManifest = {
    schemaVersion: BATCH_SCHEMA_VERSION,
    type: "alert_batch",
    id: batchId,
    wallet,
    alerts: batchAlerts.map((a) => ({
      id: a.id,
      orbitId: a.orbitId,
      storageRoot: a.storageRoot!,
      summary: a.summary,
      score: a.score,
      createdAt: a.createdAt,
    })),
    createdAt: now,
  };

  const contentHash = hashPayload(manifest);
  logger.info({ wallet, batchId, alertCount: batchAlerts.length }, "uploading attestation batch manifest");
  const { storageRoot } = await uploadJson(manifest, `alert-batch-${batchId}`);

  const digest: AlertDigest = {
    id: batchId,
    orbitId: batchAlerts[0]!.orbitId,
    wallet,
    alerts: batchAlerts.map((a) => ({ ...a, storageRoot: a.storageRoot! })),
    briefing: buildBatchBriefing(batchAlerts),
    storageRoot,
    createdAt: now,
  };

  const deadline = now + loadConfig().ATTESTATION_SIGN_DEADLINE_MS;
  createPendingAttestation(wallet, digest, contentHash, storageRoot, deadline);

  const pending = getActivePendingBatch(wallet);
  if (!pending) throw new StorageError("failed to create attestation batch");

  logger.info(
    { wallet, batchId, alertCount: batchAlerts.length, storageRoot, contentHash },
    "attestation batch ready for signature",
  );
  return pending;
}
