import type { Bot } from "grammy";
import { getDb } from "../db/client.js";
import { pauseSubscription, resumeSubscription } from "../orbits/scheduler.js";

function getWalletByChatId(chatId: number): string | null {
  const row = getDb()
    .prepare("SELECT wallet FROM subscriptions WHERE telegram_chat_id = ? LIMIT 1")
    .get(chatId) as { wallet: string } | undefined;
  return row?.wallet ?? null;
}

export function registerCommands(bot: Bot): void {
  bot.command("orbits", async (ctx) => {
    const wallet = getWalletByChatId(ctx.chat.id);
    if (!wallet) return ctx.reply("Link your wallet from the dashboard first.");
    const rows = getDb()
      .prepare("SELECT id, title, paused FROM subscriptions WHERE wallet = ?")
      .all(wallet) as { id: string; title: string; paused: number }[];
    if (rows.length === 0) return ctx.reply("No active tracks.");
    const lines = rows.map((r) => `${r.paused ? "⏸" : "🛰"} ${r.title.slice(0, 50)} (id: ${r.id.slice(0, 8)})`);
    await ctx.reply(lines.join("\n"));
  });

  bot.command("pause", async (ctx) => {
    const wallet = getWalletByChatId(ctx.chat.id);
    if (!wallet) return ctx.reply("Link your wallet from the dashboard first.");
    const subId = String(ctx.match);
    const row = getDb()
      .prepare("SELECT id FROM subscriptions WHERE id = ? AND wallet = ?")
      .get(subId, wallet);
    if (!row) return ctx.reply("Subscription not found.");
    getDb().prepare("UPDATE subscriptions SET paused = 1, updated_at = ? WHERE id = ?").run(Date.now(), subId);
    pauseSubscription(subId);
    await ctx.reply("⏸ Paused.");
  });

  bot.command("resume", async (ctx) => {
    const wallet = getWalletByChatId(ctx.chat.id);
    if (!wallet) return ctx.reply("Link your wallet from the dashboard first.");
    const subId = String(ctx.match);
    const row = getDb()
      .prepare("SELECT id FROM subscriptions WHERE id = ? AND wallet = ?")
      .get(subId, wallet);
    if (!row) return ctx.reply("Subscription not found.");
    getDb().prepare("UPDATE subscriptions SET paused = 0, updated_at = ? WHERE id = ?").run(Date.now(), subId);
    resumeSubscription(subId);
    await ctx.reply("▶️ Resumed.");
  });

  bot.command("feedback", async (ctx) => {
    await ctx.reply("Rate the last alert with 👍 or 👎 reactions on the alert message.");
  });
}
