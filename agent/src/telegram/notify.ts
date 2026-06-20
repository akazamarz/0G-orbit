import { getDb } from "../db/client.js";
import type { Alert } from "@orbit/shared";
import { getOrbit } from "../orbits/repository.js";
import { formatAlertMessage } from "./messages.js";

export interface TelegramNotifier {
  sendMessage(chatId: number, text: string): Promise<void>;
}

let notifier: TelegramNotifier | null = null;

export function setNotifier(n: TelegramNotifier): void {
  notifier = n;
}

async function send(chatId: number, text: string): Promise<void> {
  if (!notifier) return;
  await notifier.sendMessage(chatId, text);
}

export async function sendAlert(chatId: number, alert: Alert): Promise<void> {
  const orbit = getOrbit(alert.orbitId);
  const text = formatAlertMessage(alert, orbit?.title);
  await send(chatId, text);
}

export function createLinkNonce(wallet: string): string {
  const nonce = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  getDb()
    .prepare("INSERT INTO telegram_links (nonce, wallet, expires_at) VALUES (?, ?, ?)")
    .run(nonce, wallet, Date.now() + 10 * 60 * 1000);
  return nonce;
}

export function resolveNonce(nonce: string): string | null {
  const row = getDb()
    .prepare("SELECT wallet FROM telegram_links WHERE nonce = ? AND chat_id IS NULL AND expires_at > ?")
    .get(nonce, Date.now()) as { wallet: string } | undefined;
  return row?.wallet ?? null;
}

export function bindNonceToChat(nonce: string, chatId: number): string | null {
  const wallet = resolveNonce(nonce);
  if (!wallet) return null;
  getDb()
    .prepare("UPDATE telegram_links SET chat_id = ?, linked_at = ? WHERE nonce = ?")
    .run(chatId, Date.now(), nonce);
  return wallet;
}
