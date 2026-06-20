import { loadConfig } from "@orbit/shared";
import { getActiveSubscriptions } from "./repository.js";
import { runSubscription } from "./runner.js";
import { logger } from "../utils/logger.js";

let cycleTimer: NodeJS.Timeout | null = null;
let cycleRunning = false;

async function runGlobalPollCycle(): Promise<void> {
  if (cycleRunning) {
    logger.warn("global poll cycle skipped — previous cycle still running");
    return;
  }

  cycleRunning = true;
  const subs = getActiveSubscriptions();
  logger.info({ count: subs.length }, "global poll cycle started");

  try {
    for (const sub of subs) {
      try {
        await runSubscription(sub.id);
      } catch (err) {
        logger.error({ err, subId: sub.id }, "orbit poll failed");
      }
    }
  } finally {
    cycleRunning = false;
    logger.info("global poll cycle finished");
  }
}

export function startScheduler(): void {
  const config = loadConfig();
  const intervalMs = config.GLOBAL_POLL_INTERVAL_MS;

  void runGlobalPollCycle();
  cycleTimer = setInterval(() => void runGlobalPollCycle(), intervalMs);
  logger.info({ intervalMs }, "global poll scheduler started");
}

export function pauseSubscription(_id: string): void {
  // Paused orbits are excluded from getActiveSubscriptions().
}

export function resumeSubscription(_id: string): void {
  // Resumed orbits are picked up on the next global cycle.
}

export function stopScheduler(): void {
  if (cycleTimer) {
    clearInterval(cycleTimer);
    cycleTimer = null;
  }
}
