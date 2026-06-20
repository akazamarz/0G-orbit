/** Strip time bounds so each poll can append a fresh since: clause. */
export function stripTimeBounds(query: string): string {
  return query
    .replace(/\bsince:\S+/gi, "")
    .replace(/\buntil:\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

const FORBIDDEN_OPERATOR =
  /\b(?:from|to|list|lang|min_faves|min_retweets|min_replies|filter|has|url|place|point_radius|bio|is|retweets_of|in_reply_to|context|with|sample):[^\s)]+/gi;

function collapseQueryWhitespace(query: string): string {
  return query
    .replace(/(?:\s+OR\s+)+/gi, " OR ")
    .replace(/\s+/g, " ")
    .trim();
}

function expandQuotedPhrases(query: string): string {
  return query.replace(/"([^"]+)"/g, (_, phrase: string) =>
    phrase.split(/\s+/).filter(Boolean).join(" OR "),
  );
}

function toOrKeywords(query: string): string {
  const parts = query.split(/\s+OR\s+/i);
  const words: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (/\s/.test(trimmed)) {
      words.push(...trimmed.split(/\s+/).filter(Boolean));
    } else {
      words.push(trimmed);
    }
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const word of words) {
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(word);
  }
  return unique.join(" OR ");
}

/** Keep only OR-separated single keywords — strip operators and quoted phrases. */
export function sanitizeSearchQuery(query: string): string {
  let q = stripTimeBounds(query);

  q = q.replace(FORBIDDEN_OPERATOR, "");
  q = q.replace(/(?:^|\s)@\w+/g, " ");
  q = q.replace(/(?:^|\s)#\w+/g, " ");
  q = q.replace(/(?:^|\s)-\w+/g, " ");
  q = q.replace(/[()]/g, " ");

  q = expandQuotedPhrases(q);
  q = collapseQueryWhitespace(q);
  q = q.replace(/\bor\b/g, "OR");

  return toOrKeywords(q);
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
  const core = sanitizeSearchQuery(baseQuery);
  if (!core) return formatTwitterSince(since);
  return `${core} ${formatTwitterSince(since)}`;
}
