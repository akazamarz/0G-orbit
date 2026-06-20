/** Strip time bounds so each poll can append a fresh since: clause. */
export function stripTimeBounds(query: string): string {
  return query
    .replace(/\bsince:\S+/gi, "")
    .replace(/\buntil:\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Twitter advanced search since operator (UTC). */
export function formatTwitterSince(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `since:${y}-${m}-${d}_${h}:${min}:${s}_UTC`;
}

export function buildPollSearchQuery(baseQuery: string, since: Date): string {
  const core = stripTimeBounds(baseQuery);
  if (!core) return formatTwitterSince(since);
  return `${core} ${formatTwitterSince(since)}`;
}
