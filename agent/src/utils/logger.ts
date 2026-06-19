import pino from "pino";
import { loadConfig } from "@orbit/shared";

const config = loadConfig();

export const logger = pino({
  name: "orbit-agent",
  level: config.LOG_LEVEL,
  transport: {
    target: "pino/file",
    options: { colorize: true },
  },
});

export type Logger = typeof logger;
