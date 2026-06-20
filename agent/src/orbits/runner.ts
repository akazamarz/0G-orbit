import { randomUUID } from "node:crypto";
import { loadConfig } from "@orbit/shared";
import { getDb } from "../db/client.js";
import { logger } from "../utils/logger.js";
import { filterUnseen, markSeen, searchAllPages, listTimelineAllPages } from "../x/index.js";
import { buildPollSearchQuery } from "../x/query.js";
import { evaluateTweetBatch } from "../ai/client.js";
import { sendAlert } from "../telegram/notify.js";
import { getWalletTelegram } from "../telegram/wallet.js";
import {
  getSubscription,
  markSubscriptionPolled,
  getUpgradedCriteria,
} from "./repository.js";
import type { Alert, Subscription, Tweet } from "@orbit/shared";

const SCORE_THRESHOLD = 60;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

function pollSinceTimestamp(sub: Subscription, globalIntervalMs: number): Date {
  const fallbackMs = globalIntervalMs + 60_000;
  const sinceMs = sub.lastPolledAt ?? sub.createdAt ?? Date.now() - fallbackMs;
  return new Date(sinceMs);
}

async function fetchTweets(sub: Subscription, globalIntervalMs: number): Promise<Tweet[]> {
  if (sub.source === "list") {
    if (!sub.listId) {
      logger.warn({ id: sub.id }, "list orbit missing listId");
      return [];
    }
    return listTimelineAllPages(sub.listId, 1);
  }

  if (!sub.generatedQuery) {
    logger.warn({ id: sub.id }, "custom orbit missing generated query");
    return [];
  }

  const since = pollSinceTimestamp(sub, globalIntervalMs);
  const pollQuery = buildPollSearchQuery(sub.generatedQuery, since);
  logger.debug({ id: sub.id, pollQuery }, "x search poll query");

  return searchAllPages(pollQuery, 1);
}

export async function runSubscription(subscriptionId: string): Promise<void> {
  const fresh = getSubscription(subscriptionId);
  if (!fresh || fresh.paused) return;

  const config = loadConfig();
  const upgradedCriteria = getUpgradedCriteria(fresh);
  const polledAt = Date.now();
  const batchSize = config.AI_BATCH_SIZE;

  logger.info(
    {
      id: fresh.id,
      source: fresh.source,
      baseQuery: fresh.generatedQuery,
      listId: fresh.listId,
      lastPolledAt: fresh.lastPolledAt,
      batchSize,
    },
    "polling orbit",
  );

  const walletTelegram = getWalletTelegram(fresh.wallet);

  let tweets: Tweet[];
  try {
    tweets = await fetchTweets(fresh, config.GLOBAL_POLL_INTERVAL_MS);
  } catch (err) {
    logger.error({ err, subId: fresh.id }, "fetch tweets failed");
    return;
  }

  const unseen = filterUnseen(fresh.id, tweets);
  if (unseen.length === 0) {
    logger.debug({ id: fresh.id }, "no new tweets");
    markSubscriptionPolled(fresh.id, polledAt);
    return;
  }

  for (const batch of chunk(unseen, batchSize)) {
    const indexed = batch.map((tweet, index) => ({
      index,
      id: tweet.id,
      text: tweet.text,
    }));

    try {
      const evaluations = await evaluateTweetBatch(upgradedCriteria, indexed);

      for (const evaluation of evaluations) {
        const tweet = batch[evaluation.index] ?? batch.find((t) => t.id === evaluation.id);
        if (!tweet) continue;

        markSeen(fresh.id, tweet.id);

        const shouldAlert =
          evaluation.relevant && evaluation.score >= SCORE_THRESHOLD && evaluation.summary;

        if (!shouldAlert) {
          logger.debug(
            { tweetId: tweet.id, score: evaluation.score, reason: evaluation.reason },
            "tweet below threshold",
          );
          continue;
        }

        const alert: Alert = {
          id: randomUUID(),
          subscriptionId: fresh.id,
          wallet: fresh.wallet,
          tweet,
          summary: evaluation.summary!,
          score: evaluation.score,
          sentToTelegram: false,
          createdAt: Date.now(),
        };

        persistAlert(alert);

        if (fresh.notifyTelegram && walletTelegram?.alertsEnabled && walletTelegram.chatId) {
          await sendAlert(walletTelegram.chatId, alert);
          markAlertSent(alert.id);
        }

        logger.info(
          { alertId: alert.id, score: evaluation.score, reason: evaluation.reason },
          "alert created",
        );
      }
    } catch (err) {
      logger.error({ err, subId: fresh.id, batchSize: batch.length }, "batch evaluation failed");
    }
  }

  markSubscriptionPolled(fresh.id, polledAt);
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
