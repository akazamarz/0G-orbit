import { randomUUID } from "node:crypto";
import { loadConfig } from "@orbit/shared";
import { getDb } from "../db/client.js";
import { logger } from "../utils/logger.js";
import {
  applyOrbitCreatedFloor,
  filterUnseen,
  FIRST_POLL_MAX_PAGES,
  markSeen,
  searchAllPages,
  tweetTextForEval,
  groupAuthorThreads,
} from "../x/index.js";
import { buildPollSearchQuery, buildListPollQuery } from "../x/query.js";
import { evaluateTweetBatch } from "../ai/client.js";
import { sendAlert } from "../telegram/notify.js";
import { getWalletTelegram } from "../telegram/wallet.js";
import {
  getOrbit,
  markOrbitPolled,
  getUpgradedCriteria,
  refreshOrbitQueryIfStale,
} from "./repository.js";
import type { Alert, Orbit, Tweet } from "@orbit/shared";

const SCORE_THRESHOLD = 70;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

/** Never poll before orbit creation; incremental polls resume from last poll start. */
function pollSinceTimestamp(orbit: Orbit): Date {
  const createdAt = orbit.createdAt ?? Date.now();
  const sinceMs = Math.max(createdAt, orbit.lastPolledAt ?? createdAt);
  return new Date(sinceMs);
}

async function fetchTweets(orbit: Orbit, until: Date): Promise<Tweet[]> {
  const since = pollSinceTimestamp(orbit);
  const isFirstPoll = orbit.lastPolledAt == null;
  const maxPages = isFirstPoll ? FIRST_POLL_MAX_PAGES : undefined;

  if (orbit.source === "list") {
    if (!orbit.listId) {
      logger.warn({ id: orbit.id }, "list orbit missing listId");
      return [];
    }
    const pollQuery = buildListPollQuery(orbit.listId, since, until);
    logger.info(
      {
        orbitId: orbit.id,
        listId: orbit.listId,
        pollQuery,
        sinceMs: since.getTime(),
        untilMs: until.getTime(),
        isFirstPoll,
        maxPages: maxPages ?? "default",
      },
      "x list feed poll starting",
    );
    const tweets = await searchAllPages(pollQuery, {
      orbitId: orbit.id,
      listId: orbit.listId,
      kind: "list",
      maxPages,
    });
    const threads = groupAuthorThreads(tweets);
    if (threads.length > 0) {
      logger.debug({ orbitId: orbit.id, threadCount: threads.length }, "author thread groups in list feed");
    }
    return tweets;
  }

  if (!orbit.generatedQuery) {
    logger.warn({ id: orbit.id }, "custom orbit missing generated query");
    return [];
  }

  const pollQuery = buildPollSearchQuery(orbit.generatedQuery, since, until);
  logger.info(
    {
      orbitId: orbit.id,
      pollQuery,
      sinceMs: since.getTime(),
      untilMs: until.getTime(),
      isFirstPoll,
      maxPages: maxPages ?? "default",
    },
    "x search poll starting",
  );

  return searchAllPages(pollQuery, { orbitId: orbit.id, kind: "search", maxPages });
}

export async function runOrbit(orbitId: string): Promise<void> {
  let fresh = getOrbit(orbitId);
  if (!fresh || fresh.paused) return;

  if (fresh.source === "custom" || fresh.source === "list") {
    fresh = await refreshOrbitQueryIfStale(fresh);
  }

  const config = loadConfig();
  const upgradedCriteria = getUpgradedCriteria(fresh);
  const polledAt = Date.now();
  const batchSize = config.AI_BATCH_SIZE;
  const orbitCreatedAt = fresh.createdAt ?? polledAt;

  logger.info(
    {
      id: fresh.id,
      source: fresh.source,
      baseQuery: fresh.generatedQuery,
      listId: fresh.listId,
      lastPolledAt: fresh.lastPolledAt,
      createdAt: orbitCreatedAt,
      batchSize,
    },
    "polling orbit",
  );

  const walletTelegram = getWalletTelegram(fresh.wallet);

  let tweets: Tweet[];
  try {
    tweets = await fetchTweets(fresh, new Date(polledAt));
  } catch (err) {
    logger.error({ err, orbitId: fresh.id }, "fetch tweets failed");
    return;
  }

  const beforeFloor = tweets.length;
  tweets = applyOrbitCreatedFloor(fresh.id, tweets, orbitCreatedAt);
  if (beforeFloor > tweets.length) {
    logger.debug(
      { orbitId: fresh.id, dropped: beforeFloor - tweets.length, floorMs: orbitCreatedAt },
      "dropped tweets before orbit creation",
    );
  }

  const unseen = filterUnseen(fresh.id, tweets);
  if (unseen.length === 0) {
    logger.debug({ id: fresh.id }, "no new tweets");
    markOrbitPolled(fresh.id, polledAt);
    return;
  }

  for (const batch of chunk(unseen, batchSize)) {
    const indexed = batch.map((tweet, index) => ({
      index,
      id: tweet.id,
      text: tweetTextForEval(tweet),
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
          orbitId: fresh.id,
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
      logger.error({ err, orbitId: fresh.id, batchSize: batch.length }, "batch evaluation failed");
    }
  }

  markOrbitPolled(fresh.id, polledAt);
}

function persistAlert(alert: Alert): void {
  getDb()
    .prepare(
      `INSERT INTO alerts
        (id, orbit_id, wallet, tweet_id, tweet_json, summary, score, sent_to_telegram, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    )
    .run(
      alert.id,
      alert.orbitId,
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
