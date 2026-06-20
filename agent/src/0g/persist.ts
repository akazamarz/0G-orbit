import { ethers } from "ethers";
import { loadConfig, type Alert, type AlertDigest, type Orbit } from "@orbit/shared";
import { getDb } from "../db/client.js";
import { logger } from "../utils/logger.js";
import { uploadJson } from "./storage.js";
import { createPendingAttestation, isAttestationEnabled } from "./attestation.js";

const STORAGE_SCHEMA_VERSION = 1;

export interface OrbitStoragePayload {
  schemaVersion: number;
  type: "orbit";
  id: string;
  wallet: string;
  source: Orbit["source"];
  title: string;
  topic?: string;
  criteria: string;
  upgradedCriteria?: string;
  listId?: string;
  notifyTelegram: boolean;
  generatedQuery: string;
  queryVersion: number;
  pollIntervalMs: number;
  paused: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AlertStoragePayload {
  schemaVersion: number;
  type: "alert";
  id: string;
  orbitId: string;
  wallet: string;
  tweet: Alert["tweet"];
  summary: string;
  score: number;
  sentToTelegram: boolean;
  createdAt: number;
}

export function hashPayload(payload: unknown): string {
  return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(payload)));
}

export function buildOrbitPayload(orbit: Orbit): OrbitStoragePayload {
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    type: "orbit",
    id: orbit.id,
    wallet: orbit.wallet,
    source: orbit.source,
    title: orbit.title,
    topic: orbit.topic,
    criteria: orbit.criteria,
    upgradedCriteria: orbit.upgradedCriteria,
    listId: orbit.listId,
    notifyTelegram: orbit.notifyTelegram,
    generatedQuery: orbit.generatedQuery,
    queryVersion: orbit.queryVersion,
    pollIntervalMs: orbit.pollIntervalMs,
    paused: orbit.paused,
    createdAt: orbit.createdAt,
    updatedAt: orbit.updatedAt,
  };
}

export function buildAlertPayload(alert: Alert): AlertStoragePayload {
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    type: "alert",
    id: alert.id,
    orbitId: alert.orbitId,
    wallet: alert.wallet,
    tweet: alert.tweet,
    summary: alert.summary,
    score: alert.score,
    sentToTelegram: alert.sentToTelegram,
    createdAt: alert.createdAt,
  };
}

function updateOrbitStorageRoot(orbitId: string, storageRoot: string): void {
  getDb()
    .prepare("UPDATE orbits SET storage_root = ?, updated_at = ? WHERE id = ?")
    .run(storageRoot, Date.now(), orbitId);
}

function updateAlertStorageRoot(alertId: string, storageRoot: string): void {
  getDb().prepare("UPDATE alerts SET storage_root = ? WHERE id = ?").run(storageRoot, alertId);
}

async function persistPayload(label: string, payload: unknown): Promise<{ storageRoot: string; contentHash: string }> {
  const contentHash = hashPayload(payload);
  const { storageRoot } = await uploadJson(payload, label);
  return { storageRoot, contentHash };
}

async function persistOrbitToStorage(orbit: Orbit): Promise<void> {
  const payload = buildOrbitPayload(orbit);
  const { storageRoot } = await persistPayload(`orbit-${orbit.id}`, payload);
  updateOrbitStorageRoot(orbit.id, storageRoot);
  logger.info({ orbitId: orbit.id, storageRoot }, "orbit stored on 0g");
}

async function persistAlertToStorage(alert: Alert): Promise<void> {
  const payload = buildAlertPayload(alert);
  const { storageRoot, contentHash } = await persistPayload(`alert-${alert.id}`, payload);
  updateAlertStorageRoot(alert.id, storageRoot);
  logger.info({ alertId: alert.id, storageRoot }, "alert stored on 0g");

  if (!isAttestationEnabled()) return;

  const digest: AlertDigest = {
    id: alert.id,
    orbitId: alert.orbitId,
    wallet: alert.wallet,
    alerts: [{ ...alert, storageRoot }],
    briefing: alert.summary,
    storageRoot,
    createdAt: alert.createdAt,
  };

  const deadline = Date.now() + loadConfig().ATTESTATION_SIGN_DEADLINE_MS;
  createPendingAttestation(alert.wallet, digest, contentHash, storageRoot, deadline);
  logger.info({ alertId: alert.id, contentHash }, "pending attestation queued");
}

/** Fire-and-forget: SQLite is already written; 0G upload runs in background. */
export function scheduleOrbitStorage(orbit: Orbit): void {
  void persistOrbitToStorage(orbit).catch((err) => {
    logger.error({ err, orbitId: orbit.id }, "background orbit 0g upload failed");
  });
}

/** Fire-and-forget: alert is already in SQLite and Telegram may already be sent. */
export function scheduleAlertStorage(alert: Alert): void {
  void persistAlertToStorage(alert).catch((err) => {
    logger.error({ err, alertId: alert.id }, "background alert 0g upload failed");
  });
}
