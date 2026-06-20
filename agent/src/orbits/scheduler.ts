import { loadConfig } from "@orbit/shared";
import { getActiveOrbits } from "./repository.js";
import { runOrbit } from "./runner.js";
import { logger } from "../utils/logger.js";

let cycleTimer: NodeJS.Timeout | null = null;
let cycleRunning = false;

async function runGlobalPollCycle(): Promise<void> {
  if (cycleRunning) {
    logger.warn("global poll cycle skipped — previous cycle still running");
    return;
  }

  cycleRunning = true;
  const orbits = getActiveOrbits();
  logger.info({ count: orbits.length }, "global poll cycle started");

  try {
    for (const orbit of orbits) {
      try {
        await runOrbit(orbit.id);
      } catch (err) {
        logger.error({ err, orbitId: orbit.id }, "orbit poll failed");
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

export function pauseOrbit(_id: string): void {
  // Paused orbits are excluded from getActiveOrbits().
}

export function resumeOrbit(_id: string): void {
  // Resumed orbits are picked up on the next global cycle.
}

export function stopScheduler(): void {
  if (cycleTimer) {
    clearInterval(cycleTimer);
    cycleTimer = null;
  }
}
