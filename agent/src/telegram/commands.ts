import type { Bot } from "grammy";
import { getDb } from "../db/client.js";
import { pauseSubscription, resumeSubscription } from "../orbits/scheduler.js";
import { getWalletByChatId } from "./wallet.js";
import { buildOrbitPickerKeyboard } from "./keyboards.js";
import {
  HTML_REPLY,
  feedbackMessage,
  helpMessage,
  noActiveOrbitsToPauseMessage,
  noOrbitsMessage,
  noPausedOrbitsMessage,
  notLinkedMessage,
  orbitsListMessage,
  pausePickerMessage,
  pauseSuccessMessage,
  resumePickerMessage,
  resumeSuccessMessage,
} from "./messages.js";

interface OrbitRow {
  id: string;
  title: string;
  paused: number;
  notify_telegram: number;
}

function listOrbits(wallet: string): OrbitRow[] {
  return getDb()
    .prepare(
      "SELECT id, title, paused, notify_telegram FROM subscriptions WHERE wallet = ? ORDER BY created_at DESC",
    )
    .all(wallet) as OrbitRow[];
}

function getOrbit(wallet: string, orbitId: string): { id: string; title: string; paused: number } | null {
  const row = getDb()
    .prepare("SELECT id, title, paused FROM subscriptions WHERE id = ? AND wallet = ?")
    .get(orbitId, wallet) as { id: string; title: string; paused: number } | undefined;
  return row ?? null;
}

export function registerCommands(bot: Bot): void {
  bot.command("help", async (ctx) => {
    await ctx.reply(helpMessage(), HTML_REPLY);
  });

  bot.command("orbits", async (ctx) => {
    const linked = getWalletByChatId(ctx.chat.id);
    if (!linked) return ctx.reply(notLinkedMessage(), HTML_REPLY);
    const rows = listOrbits(linked.wallet);
    if (rows.length === 0) return ctx.reply(noOrbitsMessage(), HTML_REPLY);
    await ctx.reply(orbitsListMessage(rows), HTML_REPLY);
  });

  bot.command("pause", async (ctx) => {
    const linked = getWalletByChatId(ctx.chat.id);
    if (!linked) return ctx.reply(notLinkedMessage(), HTML_REPLY);
    const active = listOrbits(linked.wallet).filter((o) => !o.paused);
    if (active.length === 0) return ctx.reply(noActiveOrbitsToPauseMessage(), HTML_REPLY);
    await ctx.reply(pausePickerMessage(), {
      ...HTML_REPLY,
      reply_markup: buildOrbitPickerKeyboard(
        "pause",
        active.map((o) => ({ id: o.id, title: o.title })),
      ),
    });
  });

  bot.command("resume", async (ctx) => {
    const linked = getWalletByChatId(ctx.chat.id);
    if (!linked) return ctx.reply(notLinkedMessage(), HTML_REPLY);
    const paused = listOrbits(linked.wallet).filter((o) => o.paused);
    if (paused.length === 0) return ctx.reply(noPausedOrbitsMessage(), HTML_REPLY);
    await ctx.reply(resumePickerMessage(), {
      ...HTML_REPLY,
      reply_markup: buildOrbitPickerKeyboard(
        "resume",
        paused.map((o) => ({ id: o.id, title: o.title })),
      ),
    });
  });

  bot.command("feedback", async (ctx) => {
    await ctx.reply(feedbackMessage(), HTML_REPLY);
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const chatId = ctx.callbackQuery.message?.chat.id;
    if (!chatId) return;

    const action = data.startsWith("pause:") ? "pause" : data.startsWith("resume:") ? "resume" : null;
    if (!action) return;

    const orbitId = data.slice(action.length + 1);
    const linked = getWalletByChatId(chatId);
    if (!linked) {
      await ctx.answerCallbackQuery({ text: "Link your wallet in the Orbit app first.", show_alert: true });
      return;
    }

    const orbit = getOrbit(linked.wallet, orbitId);
    if (!orbit) {
      await ctx.answerCallbackQuery({ text: "That orbit was not found.", show_alert: true });
      return;
    }

    if (action === "pause") {
      if (orbit.paused) {
        await ctx.answerCallbackQuery({ text: `${orbit.title} is already paused.` });
        return;
      }
      getDb().prepare("UPDATE subscriptions SET paused = 1, updated_at = ? WHERE id = ?").run(Date.now(), orbit.id);
      pauseSubscription(orbit.id);
      await ctx.answerCallbackQuery({ text: `Paused: ${orbit.title}` });
      await ctx.editMessageText(pauseSuccessMessage(orbit.title), HTML_REPLY);
      return;
    }

    if (!orbit.paused) {
      await ctx.answerCallbackQuery({ text: `${orbit.title} is already active.` });
      return;
    }
    getDb().prepare("UPDATE subscriptions SET paused = 0, updated_at = ? WHERE id = ?").run(Date.now(), orbit.id);
    resumeSubscription(orbit.id);
    await ctx.answerCallbackQuery({ text: `Resumed: ${orbit.title}` });
    await ctx.editMessageText(resumeSuccessMessage(orbit.title), HTML_REPLY);
  });
}
