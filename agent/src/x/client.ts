import { X_API, type Tweet } from "@orbit/shared";
import { loadConfig } from "@orbit/shared";
import { ExternalApiError } from "../utils/errors.js";
import { retry } from "../utils/retry.js";
import { logger } from "../utils/logger.js";
import { filterListFeedTweets, mapTweet } from "./tweet.js";

/** twitterapi.io returns up to 20 tweets per page. */
export const X_SEARCH_PAGE_SIZE = 20;

/** First poll: one page only — avoids burning API credits on backlog pagination. */
export const FIRST_POLL_MAX_PAGES = 1;

/** Safety cap — 50 pages × 20 tweets = 1000 tweets max per incremental poll. */
const MAX_SEARCH_PAGES = 50;

/** twitterapi.io rate limit guidance between search pages. */
const PAGE_DELAY_MS = 320;

export interface SearchResult {
  tweets: Tweet[];
  hasNextPage: boolean;
  nextCursor: string;
}

export interface PaginatedFetchContext {
  orbitId?: string;
  listId?: string;
  kind: "search" | "list";
  maxPages?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tweetPreview(tweet: Tweet): {
  id: string;
  author: string;
  createdAt: string;
  feedType?: string;
  text: string;
} {
  const text = tweet.text.replace(/\s+/g, " ").trim();
  return {
    id: tweet.id,
    author: tweet.author,
    createdAt: tweet.createdAt,
    feedType: tweet.feedType,
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

async function fetchAllPages(
  query: string,
  ctx: PaginatedFetchContext,
): Promise<Tweet[]> {
  const all: Tweet[] = [];
  let cursor: string | undefined;
  let request = 0;
  const pageCap = ctx.maxPages ?? MAX_SEARCH_PAGES;

  while (request < pageCap) {
    request += 1;
    const res = await advancedSearch(query, cursor);
    const page = ctx.kind === "list" ? filterListFeedTweets(res.tweets) : res.tweets;
    all.push(...page);

    logger.info(
      {
        ...ctx,
        request,
        query: request === 1 ? query : undefined,
        pageTweetCount: page.length,
        rawPageTweetCount: res.tweets.length,
        cumulativeTweetCount: all.length,
        hasNextPage: res.hasNextPage,
        hasCursor: Boolean(res.nextCursor),
        tweets: page.map(tweetPreview),
      },
      `x ${ctx.kind} request ${request}: ${page.length} tweet(s)`,
    );

    if (res.tweets.length === 0) break;
    if (!res.hasNextPage || !res.nextCursor) break;

    cursor = res.nextCursor;
    await sleep(PAGE_DELAY_MS);
  }

  if (request >= pageCap) {
    logger.warn(
      { ...ctx, request, cumulativeTweetCount: all.length, maxPages: pageCap },
      "x pagination stopped at page cap",
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

/** Paginate advanced_search until empty page or no cursor. */
export async function searchAllPages(
  query: string,
  ctx: Omit<PaginatedFetchContext, "kind"> & { kind?: PaginatedFetchContext["kind"] } = {},
): Promise<Tweet[]> {
  const kind = ctx.kind ?? (query.includes("list:") ? "list" : "search");
  return fetchAllPages(query, { ...ctx, kind });
}
