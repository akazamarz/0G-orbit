import type { Subscription } from "@orbit/shared";

export function displayCriteria(sub: Subscription): string {
  const upgraded = sub.upgradedCriteria?.trim();
  if (upgraded) return upgraded;
  return sub.criteria.trim();
}

export function formatWhen(ts?: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
