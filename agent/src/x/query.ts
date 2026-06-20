const MAX_KEYWORDS = 12;

const BLOCKED_OPERATORS =
  /\b(?:from|to|list|lang|min_faves|min_retweets|min_replies|filter|has|url|place|point_radius|bio|is|retweets_of|in_reply_to|context|with|sample):[^\s)]+/gi;

export function stripTimeBounds(query: string): string {
  return query
    .replace(/\b(?:since|until)(?:_time)?:\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Max words per OR segment — allows "Fable 5" / "Meta AI" but not legacy AND blobs. */
const MAX_WORDS_PER_SEGMENT = 2;

function isLegacySegment(segment: string): boolean {
  return segment.split(/\s+/).filter(Boolean).length > MAX_WORDS_PER_SEGMENT;
}

/** Split a stored OR query string into OR segments (not used for AI keyword arrays). */
function parseOrQuery(query: string): string[] {
  return query
    .replace(BLOCKED_OPERATORS, "")
    .replace(/(?:^|\s)@\w+/g, " ")
    .replace(/(?:^|\s)#\w+/g, " ")
    .replace(/[()"']/g, " ")
    .split(/\s+OR\s+/i)
    .map((t) => t.trim().replace(/^[^\w]+|[^\w]+$/g, ""))
    .filter((t) => t.length >= 2 && !/^\d+$/.test(t));
}

function dedupeKeywords(tokens: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const word of tokens) {
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(word);
    if (out.length >= MAX_KEYWORDS) break;
  }
  return out;
}

/** Entity-only OR query, e.g. Fable OR Anthropic OR Claude. */
export function toEntityOrQuery(input: string | string[]): string {
  const tokens = Array.isArray(input)
    ? input.map((k) => k.trim()).filter((k) => k.length >= 2)
    : parseOrQuery(stripTimeBounds(input));
  return dedupeKeywords(tokens).join(" OR ");
}

export function sanitizeSearchQuery(query: string): string {
  return toEntityOrQuery(query);
}

export function formatTwitterSince(date: Date): string {
  return `since_time:${Math.floor(date.getTime() / 1000)}`;
}

export function formatTwitterUntil(date: Date): string {
  return `until_time:${Math.floor(date.getTime() / 1000)}`;
}

/** Base list feed query (no time bounds) — stored for display. */
export function buildListFeedQueryBase(listId: string): string {
  return `list:${listId} (-filter:replies OR filter:self_threads) include:nativeretweets`;
}

function formatPollTimeBounds(since: Date, until: Date): string {
  return `${formatTwitterSince(since)} ${formatTwitterUntil(until)}`;
}

/** Full list poll query with incremental time window (Unix seconds). */
export function buildListPollQuery(listId: string, since: Date, until = new Date()): string {
  return `${buildListFeedQueryBase(listId)} ${formatPollTimeBounds(since, until)}`;
}

export function buildPollSearchQuery(baseQuery: string, since: Date, until = new Date()): string {
  const core = sanitizeSearchQuery(baseQuery);
  const bounds = formatPollTimeBounds(since, until);
  return core ? `${core} ${bounds}` : bounds;
}

/** Regenerate when stored query is empty, has legacy AND-joined segments, or needs cleanup. */
export function needsQueryRegeneration(query: string): boolean {
  const core = stripTimeBounds(query).trim();
  if (!core) return true;
  const segments = core.split(/\s+OR\s+/i).map((s) => s.trim()).filter(Boolean);
  if (segments.some(isLegacySegment)) return true;
  return sanitizeSearchQuery(core) !== core;
}
