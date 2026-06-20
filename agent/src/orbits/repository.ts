import { randomUUID } from "node:crypto";
import { parseListId } from "@orbit/shared";
import { getDb } from "../db/client.js";
import { logger } from "../utils/logger.js";
import type { Subscription, SubscriptionInput, SubscriptionUpdate, TrackSource } from "@orbit/shared";
import { trackToQuery } from "../ai/client.js";

function rowToSub(row: Record<string, unknown>): Subscription {
  return {
    id: String(row.id),
    wallet: String(row.wallet),
    source: String(row.source ?? "custom") as TrackSource,
    title: String(row.title ?? row.intent ?? ""),
    topic: (row.topic as string) ?? undefined,
    criteria: String(row.criteria ?? row.intent ?? ""),
    listId: (row.list_id as string) ?? undefined,
    notifyTelegram: Boolean(row.notify_telegram),
    generatedQuery: String(row.generated_query ?? ""),
    queryVersion: Number(row.query_version),
    pollIntervalMs: Number(row.poll_interval_ms),
    paused: Boolean(row.paused),
    storageRoot: (row.storage_root as string) ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

async function resolveGeneratedQuery(input: SubscriptionInput): Promise<string> {
  if (input.source === "list") return "";
  const topic = input.topic?.trim() || input.title.trim();
  const { query } = await trackToQuery(topic, input.criteria);
  return query;
}

function resolveListId(input: SubscriptionInput): string | undefined {
  if (input.source !== "list") return undefined;
  const listId = input.listId ? parseListId(input.listId) : null;
  if (!listId) throw new Error("invalid X list URL or ID");
  return listId;
}

export async function createSubscription(input: SubscriptionInput): Promise<Subscription> {
  const listId = resolveListId(input);
  const generatedQuery = await resolveGeneratedQuery(input);
  const topic = input.source === "custom" ? (input.topic?.trim() || input.title.trim()) : null;
  const id = randomUUID();
  const now = Date.now();
  const pollIntervalMs = input.pollIntervalMs ?? Number(process.env.X_POLL_INTERVAL_MS ?? 300000);

  getDb()
    .prepare(
      `INSERT INTO subscriptions
        (id, wallet, source, title, topic, criteria, list_id, notify_telegram, generated_query, query_version, poll_interval_ms, paused, storage_root, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0, ?, ?, ?)`,
    )
    .run(
      id,
      input.wallet,
      input.source,
      input.title.trim(),
      topic,
      input.criteria.trim(),
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
    update.topic !== undefined
      ? update.topic.trim() || undefined
      : current.topic;
  const criteria = update.criteria?.trim() ?? current.criteria;
  const listId = update.listId !== undefined ? parseListId(update.listId) ?? update.listId : current.listId;
  const notifyTelegram = update.notifyTelegram ?? current.notifyTelegram;
  const paused = update.paused ?? current.paused;
  const pollIntervalMs = update.pollIntervalMs ?? current.pollIntervalMs;

  let generatedQuery = current.generatedQuery;
  let queryVersion = current.queryVersion;
  if (
    current.source === "custom" &&
    (update.criteria !== undefined || update.topic !== undefined)
  ) {
    const searchTopic = topic ?? title;
    const { query } = await trackToQuery(searchTopic, criteria);
    generatedQuery = query;
    queryVersion += 1;
  }

  const now = Date.now();
  getDb()
    .prepare(
      `UPDATE subscriptions SET
        title = ?, topic = ?, criteria = ?, list_id = ?, notify_telegram = ?, generated_query = ?, query_version = ?,
        paused = ?, poll_interval_ms = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      title,
      topic ?? null,
      criteria,
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

export function getActiveSubscriptions(): Subscription[] {
  const rows = getDb()
    .prepare("SELECT * FROM subscriptions WHERE paused = 0 ORDER BY updated_at DESC")
    .all() as Record<string, unknown>[];
  return rows.map(rowToSub);
}
