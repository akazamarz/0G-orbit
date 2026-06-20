import { Bot } from "grammy";
import { loadConfig } from "@orbit/shared";
import { logger } from "../utils/logger.js";
import { setNotifier, bindNonceToChat } from "./notify.js";
import { registerCommands } from "./commands.js";
import { upsertWalletTelegram } from "./wallet.js";
import {
  BOT_COMMAND_MENU,
  HTML_REPLY,
  linkFailedMessage,
  linkSuccessMessage,
  welcomeMessage,
} from "./messages.js";

let bot: Bot | null = null;

export async function startBot(): Promise<void> {
  const config = loadConfig();
  bot = new Bot(config.TELEGRAM_BOT_TOKEN);

  setNotifier({
    async sendMessage(chatId, text) {
      await bot!.api.sendMessage(chatId, text, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
    },
  });

  bot.command("start", async (ctx) => {
    const nonce = ctx.match;
    if (nonce) {
      const wallet = bindNonceToChat(String(nonce), ctx.chat.id);
      if (wallet) {
        const from = ctx.from;
        upsertWalletTelegram(wallet, {
          chatId: ctx.chat.id,
          username: from?.username,
          firstName: from?.first_name,
          lastName: from?.last_name,
        });
        await ctx.reply(linkSuccessMessage(wallet, from?.first_name), HTML_REPLY);
        logger.info({ chatId: ctx.chat.id, wallet }, "telegram linked");
        return;
      }
      await ctx.reply(linkFailedMessage(), HTML_REPLY);
      return;
    }
    await ctx.reply(welcomeMessage(), HTML_REPLY);
  });

  registerCommands(bot);

  bot.catch((err) => logger.error({ err: err.error }, "telegram bot error"));

  await bot.api.setMyCommands(
    BOT_COMMAND_MENU.map((c) => ({ command: c.command, description: c.description })),
  );
  logger.info({ commands: BOT_COMMAND_MENU.length }, "telegram command menu registered");

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
