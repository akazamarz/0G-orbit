import { X_API, type Tweet } from "@orbit/shared";
import { loadConfig } from "@orbit/shared";
import { ExternalApiError } from "../utils/errors.js";
import { retry } from "../utils/retry.js";
import { logger } from "../utils/logger.js";

/** twitterapi.io returns up to 20 tweets per page. */
export const X_SEARCH_PAGE_SIZE = 20;

/** Safety cap — 50 pages × 20 tweets = 1000 tweets max per poll. */
const MAX_SEARCH_PAGES = 50;

export interface SearchResult {
  tweets: Tweet[];
  hasNextPage: boolean;
  nextCursor: string;
}

export interface PaginatedFetchContext {
  orbitId?: string;
  listId?: string;
  kind: "search" | "list";
}

function mapTweet(raw: Record<string, unknown>): Tweet {
  const author = (raw.author as Record<string, unknown> | undefined) ?? {};
  return {
    id: String(raw.id ?? raw.tweet_id ?? ""),
    text: String(raw.text ?? raw.content ?? ""),
    author: String(author.userName ?? author.username ?? raw.authorUserName ?? ""),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ""),
    favoriteCount: Number(raw.favoriteCount ?? raw.favorite_count ?? 0),
    retweetCount: Number(raw.retweetCount ?? raw.retweet_count ?? 0),
    replyCount: Number(raw.replyCount ?? raw.reply_count ?? 0),
    lang: String(raw.lang ?? "en"),
    url: String(raw.url ?? `https://x.com/i/status/${raw.id ?? raw.tweet_id ?? ""}`),
  };
}

function tweetPreview(tweet: Tweet): { id: string; author: string; createdAt: string; text: string } {
  const text = tweet.text.replace(/\s+/g, " ").trim();
  return {
    id: tweet.id,
    author: tweet.author,
    createdAt: tweet.createdAt,
    text: text.length > 120 ? `${text.slice(0, 117)}...` : text,
  };
}

export async function advancedSearch(query: string, cursor?: string): Promise<SearchResult> {
  const config = loadConfig();
  const url = new URL(X_API.advancedSearch);
  url.searchParams.set("query", query);
  url.searchParams.set("queryType", "Latest");
  if (cursor) url.searchParams.set("cursor", cursor);

  return retry(
    async () => {
      const res = await fetch(url, {
        headers: { "X-API-Key": config.X_API_KEY },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        throw new ExternalApiError(`x api ${res.status}: ${await res.text()}`);
      }
      const body = (await res.json()) as Record<string, unknown>;
      const rawTweets = (body.tweets as Record<string, unknown>[]) ?? [];
      return {
        tweets: rawTweets.map(mapTweet),
        hasNextPage: Boolean(body.has_next_page),
        nextCursor: String(body.next_cursor ?? ""),
      };
    },
    { label: "x-search" },
  );
}

export async function listTimeline(listId: string, cursor?: string): Promise<SearchResult> {
  const config = loadConfig();
  const url = new URL(X_API.listTimeline);
  url.searchParams.set("listId", listId);
  if (cursor) url.searchParams.set("cursor", cursor);

  return retry(
    async () => {
      const res = await fetch(url, {
        headers: { "X-API-Key": config.X_API_KEY },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        throw new ExternalApiError(`x list api ${res.status}: ${await res.text()}`);
      }
      const body = (await res.json()) as Record<string, unknown>;
      const rawTweets = (body.tweets as Record<string, unknown>[]) ?? [];
      return {
        tweets: rawTweets.map(mapTweet),
        hasNextPage: Boolean(body.has_next_page),
        nextCursor: String(body.next_cursor ?? ""),
      };
    },
    { label: "x-list" },
  );
}

async function fetchAllPages(
  fetchPage: (cursor: string | undefined) => Promise<SearchResult>,
  ctx: PaginatedFetchContext,
  query?: string,
): Promise<Tweet[]> {
  const all: Tweet[] = [];
  let cursor: string | undefined;
  let request = 0;

  while (request < MAX_SEARCH_PAGES) {
    request += 1;
    const res = await fetchPage(cursor);
    all.push(...res.tweets);

    logger.info(
      {
        ...ctx,
        request,
        query: request === 1 ? query : undefined,
        pageTweetCount: res.tweets.length,
        cumulativeTweetCount: all.length,
        hasNextPage: res.hasNextPage,
        hasCursor: Boolean(res.nextCursor),
        tweets: res.tweets.map(tweetPreview),
      },
      `x ${ctx.kind} request ${request}: ${res.tweets.length} tweet(s)`,
    );

    if (res.tweets.length === 0) break;
    if (!res.hasNextPage || !res.nextCursor) break;
    cursor = res.nextCursor;
  }

  if (request >= MAX_SEARCH_PAGES) {
    logger.warn(
      { ...ctx, request, cumulativeTweetCount: all.length, maxPages: MAX_SEARCH_PAGES },
      "x pagination stopped at safety page cap",
    );
  }

  logger.info(
    {
      ...ctx,
      totalRequests: request,
      totalTweets: all.length,
      query,
    },
    `x ${ctx.kind} pagination complete: ${request} request(s), ${all.length} tweet(s)`,
  );

  return all;
}

/** Fetch every page until empty or has_next_page is false. */
export async function searchAllPages(
  query: string,
  ctx: Pick<PaginatedFetchContext, "orbitId"> = {},
): Promise<Tweet[]> {
  return fetchAllPages((cursor) => advancedSearch(query, cursor), { kind: "search", ...ctx }, query);
}

export async function listTimelineAllPages(
  listId: string,
  ctx: Pick<PaginatedFetchContext, "orbitId"> = {},
): Promise<Tweet[]> {
  return fetchAllPages(
    (cursor) => listTimeline(listId, cursor),
    { kind: "list", listId, ...ctx },
    `listId:${listId}`,
  );
}
