import { timingSafeEqual } from "node:crypto";
import { loadConfig } from "@orbit/shared";
import { getDb } from "../db/client.js";
import type {
  Feedback,
  Orbit,
  OrbitInput,
  OrbitUpdate,
  AttestationData,
  AttestationStatusResponse,
  PendingAttestationsResponse,
  PendingAttestation,
  SignAttestationRequest,
  UpdateWalletTelegramRequest,
  WalletTelegramStatus,
} from "@orbit/shared";
import {
  createOrbit,
  deleteOrbit,
  listOrbits,
  updateOrbit,
} from "../orbits/repository.js";
import { listAlertFeed } from "../alerts/repository.js";
import { pauseOrbit, resumeOrbit } from "../orbits/scheduler.js";
import { createLinkNonce } from "../telegram/notify.js";
import {
  getWalletTelegramStatus,
  isWalletTelegramLinked,
  setWalletTelegramAlertsEnabled,
  unlinkWalletTelegram,
} from "../telegram/wallet.js";
import {
  listPendingAttestations,
  attestWithSignature,
  getEIP712Domain,
  isAttestationEnabled,
  getAttestationStatus,
} from "../0g/index.js";
import { createAttestationBatch } from "../0g/batch.js";

export { listAlertFeed, countAlerts, parseAlertCursor } from "../alerts/repository.js";

export function recordFeedback(wallet: string, alertId: string, rating: "up" | "down"): Feedback {
  const id = crypto.randomUUID();
  getDb()
    .prepare("INSERT INTO feedback (id, alert_id, wallet, rating, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, alertId, wallet, rating, Date.now());
  return { id, alertId, wallet, rating, createdAt: Date.now() };
}

export function handleCreateOrbit(input: OrbitInput): Promise<Orbit> {
  return createOrbit(input);
}

export async function handleUpdateOrbit(
  id: string,
  update: OrbitUpdate,
): Promise<Orbit | null> {
  const updated = await updateOrbit(id, update);
  if (updated && update.paused === true) pauseOrbit(id);
  if (updated && update.paused === false) resumeOrbit(id);
  return updated;
}

export function handleDeleteOrbit(id: string): boolean {
  pauseOrbit(id);
  return deleteOrbit(id);
}

export function handleListOrbits(wallet: string): Orbit[] {
  return listOrbits(wallet);
}

export function handleCreateTelegramLink(wallet: string): { nonce: string; deeplink: string } {
  if (isWalletTelegramLinked(wallet)) {
    throw Object.assign(new Error("Telegram already linked"), { status: 409 });
  }
  const nonce = createLinkNonce(wallet);
  const config = loadConfig();
  const username = config.TELEGRAM_BOT_USERNAME.replace(/^@/, "");
  return {
    nonce,
    deeplink: `https://t.me/${username}?start=${nonce}`,
  };
}

export function handleGetWalletTelegram(wallet: string): WalletTelegramStatus {
  return getWalletTelegramStatus(wallet);
}

export function handleUpdateWalletTelegram(
  wallet: string,
  update: UpdateWalletTelegramRequest,
): WalletTelegramStatus | null {
  const row = setWalletTelegramAlertsEnabled(wallet, update.alertsEnabled);
  return row ? getWalletTelegramStatus(wallet) : null;
}

export function handleUnlinkWalletTelegram(wallet: string): boolean {
  return unlinkWalletTelegram(wallet);
}

export function handleListPendingAttestations(wallet: string): PendingAttestationsResponse {
  if (!isAttestationEnabled()) {
    return { enabled: false, pending: [], domain: null };
  }
  return {
    enabled: true,
    pending: listPendingAttestations(wallet),
    domain: getEIP712Domain(),
  };
}

export function handleGetAttestationStatus(wallet: string): AttestationStatusResponse {
  return getAttestationStatus(wallet);
}

export async function handleCreateAttestationBatch(wallet: string): Promise<PendingAttestation> {
  return createAttestationBatch(wallet);
}

export async function handleSubmitAttestation(
  wallet: string,
  req: SignAttestationRequest,
): Promise<AttestationData> {
  return attestWithSignature(wallet, req.contentHash, req.storageRoot, req.deadline, req.signature);
}

export function verifyInternalSecret(header: string | undefined): boolean {
  const config = loadConfig();
  if (!header) return false;
  const expected = config.INTERNAL_API_SECRET;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
