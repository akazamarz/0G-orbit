import { getDb } from "../db/client.js";
import type { WalletTelegram, WalletTelegramStatus } from "@orbit/shared";

export interface TelegramProfileInput {
  chatId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
}

function rowToWalletTelegram(row: Record<string, unknown>): WalletTelegram {
  return {
    wallet: String(row.wallet),
    chatId: Number(row.chat_id),
    username: (row.username as string) ?? undefined,
    firstName: (row.first_name as string) ?? undefined,
    lastName: (row.last_name as string) ?? undefined,
    alertsEnabled: Boolean(row.alerts_enabled),
    linkedAt: Number(row.linked_at),
    updatedAt: Number(row.updated_at),
  };
}

function displayName(firstName?: string, lastName?: string): string | undefined {
  const parts = [firstName, lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

export function toWalletTelegramStatus(row: WalletTelegram | null): WalletTelegramStatus {
  if (!row) {
    return { linked: false, alertsEnabled: true };
  }
  return {
    linked: true,
    chatId: row.chatId,
    username: row.username,
    displayName: displayName(row.firstName, row.lastName),
    linkedAt: row.linkedAt,
    alertsEnabled: row.alertsEnabled,
  };
}

export function getWalletTelegram(wallet: string): WalletTelegram | null {
  const row = getDb().prepare("SELECT * FROM wallet_telegram WHERE wallet = ?").get(wallet) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToWalletTelegram(row) : null;
}

export function getWalletByChatId(chatId: number): WalletTelegram | null {
  const row = getDb().prepare("SELECT * FROM wallet_telegram WHERE chat_id = ?").get(chatId) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToWalletTelegram(row) : null;
}

export function isWalletTelegramLinked(wallet: string): boolean {
  return getWalletTelegram(wallet) !== null;
}

export function upsertWalletTelegram(wallet: string, profile: TelegramProfileInput): WalletTelegram {
  const now = Date.now();
  const existing = getWalletTelegram(wallet);

  if (existing) {
    getDb()
      .prepare(
        `UPDATE wallet_telegram SET
          chat_id = ?, username = ?, first_name = ?, last_name = ?, updated_at = ?
         WHERE wallet = ?`,
      )
      .run(
        profile.chatId,
        profile.username ?? null,
        profile.firstName ?? null,
        profile.lastName ?? null,
        now,
        wallet,
      );
  } else {
    getDb()
      .prepare(
        `INSERT INTO wallet_telegram
          (wallet, chat_id, username, first_name, last_name, alerts_enabled, linked_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .run(
        wallet,
        profile.chatId,
        profile.username ?? null,
        profile.firstName ?? null,
        profile.lastName ?? null,
        now,
        now,
      );
  }

  return getWalletTelegram(wallet)!;
}

export function setWalletTelegramAlertsEnabled(wallet: string, alertsEnabled: boolean): WalletTelegram | null {
  const existing = getWalletTelegram(wallet);
  if (!existing) return null;
  const now = Date.now();
  getDb()
    .prepare("UPDATE wallet_telegram SET alerts_enabled = ?, updated_at = ? WHERE wallet = ?")
    .run(alertsEnabled ? 1 : 0, now, wallet);
  return getWalletTelegram(wallet);
}

export function unlinkWalletTelegram(wallet: string): boolean {
  const info = getDb().prepare("DELETE FROM wallet_telegram WHERE wallet = ?").run(wallet);
  getDb().prepare("DELETE FROM telegram_links WHERE wallet = ? AND chat_id IS NULL").run(wallet);
  return info.changes > 0;
}

export function getWalletTelegramStatus(wallet: string): WalletTelegramStatus {
  return toWalletTelegramStatus(getWalletTelegram(wallet));
}
