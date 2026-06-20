import { timingSafeEqual } from "node:crypto";
import { loadConfig } from "@orbit/shared";
import { getDb } from "../db/client.js";
import type {
  Feedback,
  Subscription,
  SubscriptionInput,
  SubscriptionUpdate,
  AttestationData,
  PendingAttestationsResponse,
  SignAttestationRequest,
  UpdateWalletTelegramRequest,
  WalletTelegramStatus,
} from "@orbit/shared";
import {
  createSubscription,
  deleteSubscription,
  listSubscriptions,
  updateSubscription,
} from "../orbits/repository.js";
import { listAlertFeed } from "../alerts/repository.js";
import { pauseSubscription, resumeSubscription } from "../orbits/scheduler.js";
import { createLinkNonce } from "../telegram/notify.js";
import {
  getWalletTelegramStatus,
  isWalletTelegramLinked,
  setWalletTelegramAlertsEnabled,
  unlinkWalletTelegram,
} from "../telegram/wallet.js";
import { listPendingAttestations, attestWithSignature, getEIP712Domain, isAttestationEnabled } from "../0g/index.js";

export { listAlertFeed, countAlerts, parseAlertCursor } from "../alerts/repository.js";

export function recordFeedback(wallet: string, alertId: string, rating: "up" | "down"): Feedback {
  const id = crypto.randomUUID();
  getDb()
    .prepare("INSERT INTO feedback (id, alert_id, wallet, rating, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, alertId, wallet, rating, Date.now());
  return { id, alertId, wallet, rating, createdAt: Date.now() };
}

export function handleCreateSubscription(input: SubscriptionInput): Promise<Subscription> {
  return createSubscription(input);
}

export async function handleUpdateSubscription(
  id: string,
  update: SubscriptionUpdate,
): Promise<Subscription | null> {
  const updated = await updateSubscription(id, update);
  if (updated && update.paused === true) pauseSubscription(id);
  if (updated && update.paused === false) resumeSubscription(id);
  return updated;
}

export function handleDeleteSubscription(id: string): boolean {
  pauseSubscription(id);
  return deleteSubscription(id);
}

export function handleListSubscriptions(wallet: string): Subscription[] {
  return listSubscriptions(wallet);
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
