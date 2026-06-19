import { getActiveSubscriptions } from "./repository.js";
import { runSubscription } from "./runner.js";
import { loadConfig } from "@orbit/shared";
import { logger } from "../utils/logger.js";
import type { Subscription } from "@orbit/shared";

const timers = new Map<string, NodeJS.Timeout>();

export function startScheduler(): void {
  refresh();
  const tickMs = 60000;
  setInterval(refresh, tickMs);
  logger.info("scheduler started");
}

function refresh(): void {
  const active = getActiveSubscriptions();
  for (const sub of active) {
    if (!timers.has(sub.id)) schedule(sub);
  }
  for (const id of timers.keys()) {
    if (!active.find((s) => s.id === id)) cancel(id);
  }
}

function schedule(sub: Subscription): void {
  const fire = async () => {
    try {
      await runSubscription(sub);
    } catch (err) {
      logger.error({ err, subId: sub.id }, "subscription run failed");
    }
  };
  const timer = setInterval(fire, sub.pollIntervalMs);
  timers.set(sub.id, timer);
  fire();
  logger.info({ id: sub.id, intervalMs: sub.pollIntervalMs }, "subscription scheduled");
}

function cancel(id: string): void {
  const t = timers.get(id);
  if (t) {
    clearInterval(t);
    timers.delete(id);
    logger.info({ id }, "subscription unscheduled");
  }
}

export function pauseSubscription(id: string): void {
  cancel(id);
}

export function resumeSubscription(id: string): void {
  const active = getActiveSubscriptions();
  const sub = active.find((s) => s.id === id);
  if (sub) schedule(sub);
}

export function stopScheduler(): void {
  for (const id of timers.keys()) cancel(id);
}
