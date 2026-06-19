import { timingSafeEqual } from "node:crypto";
import { loadConfig } from "@orbit/shared";
import { getDb } from "../db/client.js";
import type { Alert, Feedback, Subscription, AttestationData, PendingAttestationsResponse, SignAttestationRequest } from "@orbit/shared";
import { createSubscription, deleteSubscription, getSubscription, listSubscriptions, updateSubscription } from "../orbits/repository.js";
import { pauseSubscription, resumeSubscription } from "../orbits/scheduler.js";
import { createLinkNonce, bindNonceToChat } from "../telegram/notify.js";
import { setTelegramChat } from "../orbits/repository.js";
import { listPendingAttestations, attestWithSignature, getEIP712Domain } from "../0g/index.js";

export function listAlerts(wallet: string, since = 0, limit = 50): Alert[] {
  const rows = getDb()
    .prepare("SELECT * FROM alerts WHERE wallet = ? AND created_at >= ? ORDER BY created_at DESC LIMIT ?")
    .all(wallet, since, limit) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    subscriptionId: String(r.subscription_id),
    wallet: String(r.wallet),
    tweet: JSON.parse(String(r.tweet_json)),
    summary: String(r.summary),
    score: Number(r.score),
    storageRoot: (r.storage_root as string) ?? undefined,
    attestationTxHash: (r.attestation_tx_hash as string) ?? undefined,
    sentToTelegram: Boolean(r.sent_to_telegram),
    createdAt: Number(r.created_at),
  }));
}

export function recordFeedback(wallet: string, alertId: string, rating: "up" | "down"): Feedback {
  const id = crypto.randomUUID();
  getDb()
    .prepare("INSERT INTO feedback (id, alert_id, wallet, rating, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, alertId, wallet, rating, Date.now());
  return { id, alertId, wallet, rating, createdAt: Date.now() };
}

export function handleCreateSubscription(input: {
  wallet: string;
  intent: string;
  watchType: "accounts" | "lists" | "topics";
  mode: "live" | "digest";
  storageRoot?: string;
}): Promise<Subscription> {
  return createSubscription(input);
}

export function handleUpdateSubscription(
  id: string,
  update: { intent?: string; watchType?: Subscription["watchType"]; mode?: Subscription["mode"]; paused?: boolean },
): Subscription | null {
  const updated = updateSubscription(id, update);
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
  const nonce = createLinkNonce(wallet);
  const config = loadConfig();
  const username = config.TELEGRAM_BOT_USERNAME.replace(/^@/, "");
  return {
    nonce,
    deeplink: `https://t.me/${username}?start=${nonce}`,
  };
}

export function handleLinkTelegram(nonce: string, chatId: number): string | null {
  const wallet = bindNonceToChat(nonce, chatId);
  if (wallet) setTelegramChat(wallet, chatId);
  return wallet;
}

export function handleListPendingAttestations(wallet: string): PendingAttestationsResponse {
  const pending = listPendingAttestations(wallet);
  const domain = getEIP712Domain();
  if (!domain) throw new Error("attestation contract not configured");
  return { pending, domain };
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
