import type { Orbit } from "@orbit/shared";

export function displayCriteria(orbit: Orbit): string {
  const upgraded = orbit.upgradedCriteria?.trim();
  if (upgraded) return upgraded;
  return orbit.criteria.trim();
}

export function formatWhen(ts?: number): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
