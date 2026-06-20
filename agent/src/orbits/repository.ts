import { randomUUID } from "node:crypto";
import { parseListId, loadConfig } from "@orbit/shared";
import { getDb } from "../db/client.js";
import { logger } from "../utils/logger.js";
import type { Subscription, SubscriptionInput, SubscriptionUpdate, TrackSource } from "@orbit/shared";
import {
  trackToQuery,
  upgradeOrbitIntent,
  fallbackUpgradedCriteria,
} from "../ai/client.js";
import { stripTimeBounds } from "../x/query.js";

function rowToSub(row: Record<string, unknown>): Subscription {
  return {
    id: String(row.id),
    wallet: String(row.wallet),
    source: String(row.source ?? "custom") as TrackSource,
    title: String(row.title ?? row.intent ?? ""),
    topic: (row.topic as string) ?? undefined,
    criteria: String(row.criteria ?? row.intent ?? ""),
    upgradedCriteria: (row.upgraded_criteria as string) ?? undefined,
    listId: (row.list_id as string) ?? undefined,
    notifyTelegram: Boolean(row.notify_telegram),
    generatedQuery: String(row.generated_query ?? ""),
    queryVersion: Number(row.query_version),
    pollIntervalMs: Number(row.poll_interval_ms),
    lastPolledAt: row.last_polled_at != null ? Number(row.last_polled_at) : undefined,
    paused: Boolean(row.paused),
    storageRoot: (row.storage_root as string) ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

async function buildUpgradedCriteria(input: {
  title: string;
  topic?: string;
  criteria: string;
  source: TrackSource;
}): Promise<string> {
  try {
    return await upgradeOrbitIntent(input.title, input.topic, input.criteria, input.source);
  } catch (err) {
    logger.warn({ err }, "upgrade orbit intent failed, using fallback");
    return fallbackUpgradedCriteria(input.title, input.topic, input.criteria);
  }
}

async function resolveGeneratedQuery(
  source: TrackSource,
  upgradedCriteria: string,
): Promise<string> {
  if (source === "list") return "";
  const { query } = await trackToQuery(upgradedCriteria);
  return stripTimeBounds(query);
}

function resolveListId(input: SubscriptionInput): string | undefined {
  if (input.source !== "list") return undefined;
  const listId = input.listId ? parseListId(input.listId) : null;
  if (!listId) throw new Error("invalid X list URL or ID");
  return listId;
}

export async function createSubscription(input: SubscriptionInput): Promise<Subscription> {
  const listId = resolveListId(input);
  const topic = input.source === "custom" ? (input.topic?.trim() || input.title.trim()) : undefined;
  const upgradedCriteria = await buildUpgradedCriteria({
    title: input.title,
    topic,
    criteria: input.criteria,
    source: input.source,
  });
  const generatedQuery = await resolveGeneratedQuery(input.source, upgradedCriteria);
  const config = loadConfig();
  const pollIntervalMs = input.pollIntervalMs ?? config.GLOBAL_POLL_INTERVAL_MS;
  const id = randomUUID();
  const now = Date.now();

  getDb()
    .prepare(
      `INSERT INTO subscriptions
        (id, wallet, source, title, topic, criteria, upgraded_criteria, list_id, notify_telegram, generated_query, query_version, poll_interval_ms, last_polled_at, paused, storage_root, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NULL, 0, ?, ?, ?)`,
    )
    .run(
      id,
      input.wallet,
      input.source,
      input.title.trim(),
      topic ?? null,
      input.criteria.trim(),
      upgradedCriteria,
      listId ?? null,
      input.notifyTelegram ? 1 : 0,
      generatedQuery,
      pollIntervalMs,
      input.storageRoot ?? null,
      now,
      now,
    );

  logger.info({ id, wallet: input.wallet, source: input.source, query: generatedQuery, listId }, "subscription created");
  return getSubscription(id)!;
}

export function getSubscription(id: string): Subscription | null {
  const row = getDb().prepare("SELECT * FROM subscriptions WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToSub(row) : null;
}

export function listSubscriptions(wallet: string): Subscription[] {
  const rows = getDb()
    .prepare("SELECT * FROM subscriptions WHERE wallet = ? ORDER BY created_at DESC")
    .all(wallet) as Record<string, unknown>[];
  return rows.map(rowToSub);
}

export async function updateSubscription(id: string, update: SubscriptionUpdate): Promise<Subscription | null> {
  const current = getSubscription(id);
  if (!current) return null;

  const title = update.title?.trim() ?? current.title;
  const topic =
    update.topic !== undefined ? update.topic.trim() || undefined : current.topic;
  const criteria = update.criteria?.trim() ?? current.criteria;
  const listId = update.listId !== undefined ? parseListId(update.listId) ?? update.listId : current.listId;
  const notifyTelegram = update.notifyTelegram ?? current.notifyTelegram;
  const paused = update.paused ?? current.paused;
  const pollIntervalMs = update.pollIntervalMs ?? current.pollIntervalMs;

  const configChanged =
    update.title !== undefined || update.topic !== undefined || update.criteria !== undefined;

  let upgradedCriteria = current.upgradedCriteria;
  let generatedQuery = current.generatedQuery;
  let queryVersion = current.queryVersion;

  if (configChanged) {
    upgradedCriteria = await buildUpgradedCriteria({
      title,
      topic,
      criteria,
      source: current.source,
    });
    if (current.source === "custom") {
      generatedQuery = await resolveGeneratedQuery("custom", upgradedCriteria);
      queryVersion += 1;
    }
  }

  const now = Date.now();
  getDb()
    .prepare(
      `UPDATE subscriptions SET
        title = ?, topic = ?, criteria = ?, upgraded_criteria = ?, list_id = ?, notify_telegram = ?,
        generated_query = ?, query_version = ?, paused = ?, poll_interval_ms = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      title,
      topic ?? null,
      criteria,
      upgradedCriteria ?? null,
      listId ?? null,
      notifyTelegram ? 1 : 0,
      generatedQuery,
      queryVersion,
      paused ? 1 : 0,
      pollIntervalMs,
      now,
      id,
    );
  return getSubscription(id);
}

export function deleteSubscription(id: string): boolean {
  const info = getDb().prepare("DELETE FROM subscriptions WHERE id = ?").run(id);
  return info.changes > 0;
}

/** Active orbits queued oldest-poll-first (never-polled first). */
export function getActiveSubscriptions(): Subscription[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM subscriptions WHERE paused = 0
       ORDER BY last_polled_at IS NULL DESC, last_polled_at ASC, created_at ASC`,
    )
    .all() as Record<string, unknown>[];
  return rows.map(rowToSub);
}

export function markSubscriptionPolled(id: string, polledAt: number): void {
  getDb()
    .prepare("UPDATE subscriptions SET last_polled_at = ?, updated_at = ? WHERE id = ?")
    .run(polledAt, polledAt, id);
}

export function getUpgradedCriteria(sub: Subscription): string {
  if (sub.upgradedCriteria?.trim()) return sub.upgradedCriteria.trim();
  return fallbackUpgradedCriteria(sub.title, sub.topic, sub.criteria);
}
