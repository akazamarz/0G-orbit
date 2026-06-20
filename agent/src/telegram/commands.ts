import type { Bot, Context } from "grammy";
import { getDb } from "../db/client.js";
import { pauseOrbit, resumeOrbit } from "../orbits/scheduler.js";
import { getWalletByChatId } from "./wallet.js";
import {
  decodeCallbackData,
  encodeCallbackData,
  inlineKeyboardColumn,
  truncateButtonLabel,
} from "./keyboards.js";
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

const ORBIT_CALLBACK = "orbit" as const;
const ORBIT_ACTION = { Pause: "pause", Resume: "resume" } as const;

interface OrbitRow {
  id: string;
  title: string;
  paused: number;
  notify_telegram: number;
}

function listOrbits(wallet: string): OrbitRow[] {
  return getDb()
    .prepare(
      "SELECT id, title, paused, notify_telegram FROM orbits WHERE wallet = ? ORDER BY created_at DESC",
    )
    .all(wallet) as OrbitRow[];
}

function getOrbit(wallet: string, orbitId: string): { id: string; title: string; paused: number } | null {
  const row = getDb()
    .prepare("SELECT id, title, paused FROM orbits WHERE id = ? AND wallet = ?")
    .get(orbitId, wallet) as { id: string; title: string; paused: number } | undefined;
  return row ?? null;
}

function orbitPickerKeyboard(
  action: (typeof ORBIT_ACTION)[keyof typeof ORBIT_ACTION],
  orbits: { id: string; title: string }[],
) {
  return inlineKeyboardColumn(
    orbits.map((orbit) => ({
      label: truncateButtonLabel(orbit.title, "Untitled orbit"),
      callbackData: encodeCallbackData(ORBIT_CALLBACK, action, orbit.id),
    })),
  );
}

async function handleOrbitCallback(ctx: Context, action: string, orbitId: string): Promise<void> {
  const chatId = ctx.callbackQuery?.message?.chat.id;
  if (!chatId) return;

  if (action !== ORBIT_ACTION.Pause && action !== ORBIT_ACTION.Resume) return;

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

  if (action === ORBIT_ACTION.Pause) {
    if (orbit.paused) {
      await ctx.answerCallbackQuery({ text: `${orbit.title} is already paused.` });
      return;
    }
    getDb().prepare("UPDATE orbits SET paused = 1, updated_at = ? WHERE id = ?").run(Date.now(), orbit.id);
    pauseOrbit(orbit.id);
    await ctx.answerCallbackQuery({ text: `Paused: ${orbit.title}` });
    await ctx.editMessageText(pauseSuccessMessage(orbit.title), HTML_REPLY);
    return;
  }

  if (!orbit.paused) {
    await ctx.answerCallbackQuery({ text: `${orbit.title} is already active.` });
    return;
  }
  getDb().prepare("UPDATE orbits SET paused = 0, updated_at = ? WHERE id = ?").run(Date.now(), orbit.id);
  resumeOrbit(orbit.id);
  await ctx.answerCallbackQuery({ text: `Resumed: ${orbit.title}` });
  await ctx.editMessageText(resumeSuccessMessage(orbit.title), HTML_REPLY);
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
    await ctx.reply(pausePickerMessage(active.length), {
      ...HTML_REPLY,
      reply_markup: orbitPickerKeyboard(ORBIT_ACTION.Pause, active),
    });
  });

  bot.command("resume", async (ctx) => {
    const linked = getWalletByChatId(ctx.chat.id);
    if (!linked) return ctx.reply(notLinkedMessage(), HTML_REPLY);
    const paused = listOrbits(linked.wallet).filter((o) => o.paused);
    if (paused.length === 0) return ctx.reply(noPausedOrbitsMessage(), HTML_REPLY);
    await ctx.reply(resumePickerMessage(paused.length), {
      ...HTML_REPLY,
      reply_markup: orbitPickerKeyboard(ORBIT_ACTION.Resume, paused),
    });
  });

  bot.command("feedback", async (ctx) => {
    await ctx.reply(feedbackMessage(), HTML_REPLY);
  });

  bot.on("callback_query:data", async (ctx) => {
    const decoded = decodeCallbackData(ctx.callbackQuery.data);
    if (!decoded) return;

    if (decoded.namespace === ORBIT_CALLBACK) {
      await handleOrbitCallback(ctx, decoded.action, decoded.payload);
    }
  });
}
