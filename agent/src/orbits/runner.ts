import { randomUUID } from "node:crypto";
import { getDb } from "../db/client.js";
import { logger } from "../utils/logger.js";
import { filterUnseen, markSeen, searchAllPages, listTimelineAllPages } from "../x/index.js";
import { scoreTweet, briefAlert } from "../ai/client.js";
import { sendAlert } from "../telegram/notify.js";
import { getWalletTelegram } from "../telegram/wallet.js";
import { getSubscription } from "./repository.js";
import type { Alert, Subscription, Tweet } from "@orbit/shared";

const SCORE_THRESHOLD = 60;

async function fetchTweets(sub: Subscription): Promise<Tweet[]> {
  if (sub.source === "list") {
    if (!sub.listId) {
      logger.warn({ id: sub.id }, "list track missing listId");
      return [];
    }
    return listTimelineAllPages(sub.listId);
  }
  if (!sub.generatedQuery) {
    logger.warn({ id: sub.id }, "custom track missing generated query");
    return [];
  }
  return searchAllPages(sub.generatedQuery);
}

export async function runSubscription(sub: Subscription): Promise<void> {
  const fresh = getSubscription(sub.id);
  if (!fresh || fresh.paused) return;

  logger.info(
    { id: fresh.id, source: fresh.source, query: fresh.generatedQuery, listId: fresh.listId },
    "polling subscription",
  );

  const walletTelegram = getWalletTelegram(fresh.wallet);

  const tweets = await fetchTweets(fresh);
  const unseen = filterUnseen(fresh.id, tweets);
  if (unseen.length === 0) {
    logger.debug({ id: fresh.id }, "no new tweets");
    return;
  }

  for (const tweet of unseen) {
    markSeen(fresh.id, tweet.id);
    const { score, reason } = await scoreTweet(fresh.title, fresh.criteria, tweet.text);
    if (score < SCORE_THRESHOLD) continue;

    const { summary } = await briefAlert(tweet.text);
    const alert: Alert = {
      id: randomUUID(),
      subscriptionId: fresh.id,
      wallet: fresh.wallet,
      tweet,
      summary,
      score,
      sentToTelegram: false,
      createdAt: Date.now(),
    };

    persistAlert(alert);

    if (fresh.notifyTelegram && walletTelegram?.alertsEnabled && walletTelegram.chatId) {
      await sendAlert(walletTelegram.chatId, alert);
      markAlertSent(alert.id);
    }

    logger.info({ alertId: alert.id, score, reason }, "alert created");
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
