import { randomUUID } from "node:crypto";
import { getDb } from "../db/client.js";
import { logger } from "../utils/logger.js";
import type { Subscription, SubscriptionInput, SubscriptionUpdate } from "@orbit/shared";
import { intentToQuery } from "../ai/client.js";

function rowToSub(row: Record<string, unknown>): Subscription {
  return {
    id: String(row.id),
    wallet: String(row.wallet),
    intent: String(row.intent),
    watchType: String(row.watch_type) as Subscription["watchType"],
    mode: String(row.mode) as Subscription["mode"],
    generatedQuery: String(row.generated_query),
    queryVersion: Number(row.query_version),
    pollIntervalMs: Number(row.poll_interval_ms),
    paused: Boolean(row.paused),
    storageRoot: (row.storage_root as string) ?? undefined,
    telegramChatId: (row.telegram_chat_id as number) ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function createSubscription(input: SubscriptionInput): Promise<Subscription> {
  const { query } = await intentToQuery(input.intent);
  const id = randomUUID();
  const now = Date.now();
  const pollIntervalMs = input.pollIntervalMs ?? Number(process.env.X_POLL_INTERVAL_MS ?? 300000);

  getDb()
    .prepare(
      `INSERT INTO subscriptions
        (id, wallet, intent, watch_type, mode, generated_query, query_version, poll_interval_ms, paused, storage_root, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, 0, ?, ?, ?)`,
    )
    .run(
      id,
      input.wallet,
      input.intent,
      input.watchType,
      input.mode,
      query,
      pollIntervalMs,
      input.storageRoot ?? null,
      now,
      now,
    );

  logger.info({ id, wallet: input.wallet, query }, "subscription created");
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

export function updateSubscription(id: string, update: SubscriptionUpdate): Subscription | null {
  const current = getSubscription(id);
  if (!current) return null;
  const now = Date.now();
  getDb()
    .prepare(
      `UPDATE subscriptions SET
        intent = ?, watch_type = ?, mode = ?, paused = ?, poll_interval_ms = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      update.intent ?? current.intent,
      update.watchType ?? current.watchType,
      update.mode ?? current.mode,
      update.paused ? 1 : 0,
      update.pollIntervalMs ?? current.pollIntervalMs,
      now,
      id,
    );
  return getSubscription(id);
}

export function deleteSubscription(id: string): boolean {
  const info = getDb().prepare("DELETE FROM subscriptions WHERE id = ?").run(id);
  return info.changes > 0;
}

export function setTelegramChat(wallet: string, chatId: number): void {
  getDb()
    .prepare("UPDATE subscriptions SET telegram_chat_id = ?, updated_at = ? WHERE wallet = ?")
    .run(chatId, Date.now(), wallet);
}

export function getActiveSubscriptions(): Subscription[] {
  const rows = getDb()
    .prepare("SELECT * FROM subscriptions WHERE paused = 0 ORDER BY updated_at DESC")
    .all() as Record<string, unknown>[];
  return rows.map(rowToSub);
}
