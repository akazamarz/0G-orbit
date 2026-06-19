import { X_API, type Tweet } from "@orbit/shared";
import { loadConfig } from "@orbit/shared";
import { ExternalApiError } from "../utils/errors.js";
import { retry } from "../utils/retry.js";

export interface SearchResult {
  tweets: Tweet[];
  hasNextPage: boolean;
  nextCursor: string;
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

export async function searchAllPages(query: string, maxPages = 3): Promise<Tweet[]> {
  const all: Tweet[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const res = await advancedSearch(query, cursor);
    all.push(...res.tweets);
    if (!res.hasNextPage || !res.nextCursor) break;
    cursor = res.nextCursor;
  }
  return all;
}
