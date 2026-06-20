import { randomUUID } from "node:crypto";
import { getDb } from "../db/client.js";
import { logger } from "../utils/logger.js";
import { filterUnseen, markSeen, searchAllPages, listTimelineAllPages } from "../x/index.js";
import { scoreTweet, briefAlert } from "../ai/client.js";
import { sendAlert } from "../telegram/notify.js";
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
  logger.info({ id: sub.id, source: sub.source, query: sub.generatedQuery, listId: sub.listId }, "polling subscription");

  const tweets = await fetchTweets(sub);
  const unseen = filterUnseen(sub.id, tweets);
  if (unseen.length === 0) {
    logger.debug({ id: sub.id }, "no new tweets");
    return;
  }

  for (const tweet of unseen) {
    markSeen(sub.id, tweet.id);
    const { score, reason } = await scoreTweet(sub.title, sub.criteria, tweet.text);
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

    if (sub.notifyTelegram && sub.telegramChatId) {
      await sendAlert(sub.telegramChatId, alert);
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
