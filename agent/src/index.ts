import { serve } from "@hono/node-server";
import { loadConfig } from "@orbit/shared";
import { getDb } from "./db/client.js";
import { startScheduler, stopScheduler } from "./orbits/scheduler.js";
import { startBot, stopBot } from "./telegram/bot.js";
import { app } from "./internal-api/server.js";
import { getServerBalance } from "./0g/chain.js";
import { logger } from "./utils/logger.js";

async function main() {
  const config = loadConfig();

  getDb();
  logger.info("orbit agent starting");

  try {
    const balance = await getServerBalance();
    logger.info({ balance: balance.toString() }, "server wallet balance");
  } catch (err) {
    logger.warn({ err }, "could not fetch server wallet balance");
  }

  startScheduler();

  void startBot().catch((err) => logger.error({ err }, "telegram bot failed to start"));

  serve(
    {
      fetch: app.fetch,
      hostname: config.AGENT_HOST,
      port: config.AGENT_PORT,
    },
    (info) => {
      logger.info({ host: config.AGENT_HOST, port: info.port }, "internal api listening");
    },
  );
}

function shutdown() {
  logger.info("shutting down");
  stopScheduler();
  void stopBot();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((err) => {
  logger.fatal({ err }, "fatal startup error");
  process.exit(1);
});
