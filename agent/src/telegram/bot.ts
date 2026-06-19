import { Bot } from "grammy";
import { loadConfig } from "@orbit/shared";
import { logger } from "../utils/logger.js";
import { setNotifier, bindNonceToChat } from "./notify.js";
import { registerCommands } from "./commands.js";
import { setTelegramChat } from "../orbits/repository.js";

let bot: Bot | null = null;

export async function startBot(): Promise<void> {
  const config = loadConfig();
  bot = new Bot(config.TELEGRAM_BOT_TOKEN);

  setNotifier({
    async sendMessage(chatId, text) {
      await bot!.api.sendMessage(chatId, text, { parse_mode: "HTML", disable_web_page_preview: true });
    },
  });

  bot.command("start", async (ctx) => {
    const nonce = ctx.match;
    if (nonce) {
      const wallet = bindNonceToChat(String(nonce), ctx.chat.id);
      if (wallet) {
        setTelegramChat(wallet, ctx.chat.id);
        await ctx.reply(`✅ Telegram linked to wallet ${wallet.slice(0, 8)}…${wallet.slice(-6)}.\nYou'll now receive orbit alerts here.`);
        logger.info({ chatId: ctx.chat.id, wallet }, "telegram linked");
        return;
      }
      await ctx.reply("❌ Invalid or expired link. Reconnect from the Orbit dashboard.");
      return;
    }
    await ctx.reply("Welcome to Orbit. Link your wallet from the dashboard to start receiving signals.");
  });

  registerCommands(bot);

  bot.catch((err) => logger.error({ err: err.error }, "telegram bot error"));

  await bot.start({
    onStart: () => logger.info("telegram bot started (long-polling)"),
  });
}

export async function stopBot(): Promise<void> {
  if (bot) {
    await bot.stop();
    bot = null;
  }
}
