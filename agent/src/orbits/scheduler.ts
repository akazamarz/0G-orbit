import { getActiveSubscriptions, getSubscription } from "./repository.js";
import { runSubscription } from "./runner.js";
import { logger } from "../utils/logger.js";

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
    if (!timers.has(sub.id)) schedule(sub.id);
  }
  for (const id of timers.keys()) {
    if (!active.find((s) => s.id === id)) cancel(id);
  }
}

function schedule(subscriptionId: string): void {
  const fire = async () => {
    const sub = getSubscription(subscriptionId);
    if (!sub || sub.paused) return;
    try {
      await runSubscription(sub);
    } catch (err) {
      logger.error({ err, subId: subscriptionId }, "subscription run failed");
    }
  };
  const sub = getSubscription(subscriptionId);
  const intervalMs = sub?.pollIntervalMs ?? 300000;
  const timer = setInterval(fire, intervalMs);
  timers.set(subscriptionId, timer);
  fire();
  logger.info({ id: subscriptionId, intervalMs }, "subscription scheduled");
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
  const sub = getSubscription(id);
  if (sub && !sub.paused) schedule(id);
}

export function stopScheduler(): void {
  for (const id of timers.keys()) cancel(id);
}
