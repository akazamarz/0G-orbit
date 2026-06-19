import { randomUUID } from "node:crypto";
import { ethers } from "ethers";
import { loadConfig } from "@orbit/shared";
import { getDb } from "../db/client.js";
import { logger } from "../utils/logger.js";
import { filterUnseen, markSeen, searchAllPages } from "../x/index.js";
import { scoreTweet, briefAlert, digestBriefing } from "../ai/client.js";
import { uploadDigest, createPendingAttestation, isAttestationEnabled } from "../0g/index.js";
import { sendAlert, sendDigest } from "../telegram/notify.js";
import type { Alert, AlertDigest, Subscription } from "@orbit/shared";

const SCORE_THRESHOLD = 60;

export async function runSubscription(sub: Subscription): Promise<void> {
  logger.info({ id: sub.id, query: sub.generatedQuery }, "polling subscription");

  const tweets = await searchAllPages(sub.generatedQuery);
  const unseen = filterUnseen(sub.id, tweets);
  if (unseen.length === 0) {
    logger.debug({ id: sub.id }, "no new tweets");
    return;
  }

  for (const tweet of unseen) {
    markSeen(sub.id, tweet.id);
    const { score, reason } = await scoreTweet(sub.intent, tweet.text);
    if (score < SCORE_THRESHOLD) continue;

    const { summary } = await briefAlert(tweet.text);
    const alert: Alert = {
      id: randomUUID(),
      subscriptionId: sub.id,
      wallet: sub.wallet,
      tweet,
      summary,
      score,
      sentToTelegram: false,
      createdAt: Date.now(),
    };

    persistAlert(alert);

    if (sub.mode === "live" && sub.telegramChatId) {
      await sendAlert(sub.telegramChatId, alert);
      markAlertSent(alert.id);
    }

    logger.info({ alertId: alert.id, score, reason }, "alert created");
  }

  if (sub.mode === "digest") {
    await runDigest(sub);
  }
}

export async function runDigest(sub: Subscription): Promise<void> {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const alerts = listAlertsSince(sub.id, since);
  if (alerts.length === 0) return;

  const alertsText = alerts
    .map((a) => `@${a.tweet.author}: ${a.tweet.text.slice(0, 120)}`)
    .join("\n");
  const briefing = await digestBriefing(alertsText);

  const digest: AlertDigest = {
    id: randomUUID(),
    subscriptionId: sub.id,
    wallet: sub.wallet,
    alerts,
    briefing,
    createdAt: Date.now(),
  };
  const upload = await uploadDigest(digest, sub.wallet);
  digest.storageRoot = upload.storageRoot;

  if (isAttestationEnabled()) {
    const contentHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(digest)));
    const deadline = Date.now() + loadConfig().ATTESTATION_SIGN_DEADLINE_MS;
    createPendingAttestation(sub.wallet, digest, contentHash, upload.storageRoot, deadline);
    logger.info({ subId: sub.id, count: alerts.length, contentHash }, "digest stored, pending attestation");
  } else {
    logger.info({ subId: sub.id, count: alerts.length }, "digest stored");
  }

  if (sub.telegramChatId) {
    await sendDigest(sub.telegramChatId, briefing, alerts);
  }
}

function persistAlert(alert: Alert): void {
  getDb()
    .prepare(
      `INSERT INTO alerts
        (id, subscription_id, wallet, tweet_id, tweet_json, summary, score, sent_to_telegram, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    )
    .run(
      alert.id,
      alert.subscriptionId,
      alert.wallet,
      alert.tweet.id,
      JSON.stringify(alert.tweet),
      alert.summary,
      alert.score,
      alert.createdAt,
    );
}

function markAlertSent(id: string): void {
  getDb().prepare("UPDATE alerts SET sent_to_telegram = 1 WHERE id = ?").run(id);
}

function listAlertsSince(subscriptionId: string, since: number): Alert[] {
  const rows = getDb()
    .prepare("SELECT * FROM alerts WHERE subscription_id = ? AND created_at >= ? ORDER BY created_at")
    .all(subscriptionId, since) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    subscriptionId: String(r.subscription_id),
    wallet: String(r.wallet),
    tweet: JSON.parse(String(r.tweet_json)),
    summary: String(r.summary),
    score: Number(r.score),
    sentToTelegram: Boolean(r.sent_to_telegram),
    createdAt: Number(r.created_at),
  }));
}
