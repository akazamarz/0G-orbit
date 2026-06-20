import type { Tweet, TweetEmbed, TweetFeedType } from "@orbit/shared";
import { markSeen } from "./dedup.js";

function mapAuthor(raw: Record<string, unknown> | undefined): string {
  if (!raw) return "";
  return String(raw.userName ?? raw.username ?? "");
}

function mapEmbed(raw: Record<string, unknown> | undefined): TweetEmbed | undefined {
  if (!raw) return undefined;
  const id = String(raw.id ?? "");
  if (!id) return undefined;
  const author = (raw.author as Record<string, unknown> | undefined) ?? {};
  return {
    id,
    text: String(raw.text ?? raw.content ?? ""),
    author: mapAuthor(author),
    url: String(raw.url ?? `https://x.com/i/status/${id}`),
    createdAt: raw.createdAt != null ? String(raw.createdAt) : undefined,
  };
}

export function mapTweet(raw: Record<string, unknown>): Tweet {
  const author = (raw.author as Record<string, unknown> | undefined) ?? {};
  const id = String(raw.id ?? raw.tweet_id ?? "");
  const tweet: Tweet = {
    id,
    text: String(raw.text ?? raw.content ?? ""),
    author: mapAuthor(author),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ""),
    favoriteCount: Number(raw.likeCount ?? raw.favoriteCount ?? raw.favorite_count ?? 0),
    retweetCount: Number(raw.retweetCount ?? raw.retweet_count ?? 0),
    replyCount: Number(raw.replyCount ?? raw.reply_count ?? 0),
    lang: String(raw.lang ?? "en"),
    url: String(raw.url ?? `https://x.com/i/status/${id}`),
    isReply: raw.isReply != null ? Boolean(raw.isReply) : undefined,
    inReplyToId: raw.inReplyToId != null ? String(raw.inReplyToId) : undefined,
    inReplyToUsername:
      raw.inReplyToUsername != null ? String(raw.inReplyToUsername) : undefined,
    conversationId: raw.conversationId != null ? String(raw.conversationId) : undefined,
    quotedTweet: mapEmbed(raw.quoted_tweet as Record<string, unknown> | undefined),
    retweetedTweet: mapEmbed(raw.retweeted_tweet as Record<string, unknown> | undefined),
  };
  tweet.feedType = classifyTweet(tweet);
  return tweet;
}

export function classifyTweet(tweet: Tweet): TweetFeedType {
  if (tweet.retweetedTweet) return "retweet";
  if (tweet.quotedTweet) return "quote";
  if (tweet.isReply) {
    const author = tweet.author.toLowerCase();
    const replyTo = (tweet.inReplyToUsername ?? "").replace(/^@/, "").toLowerCase();
    if (replyTo && replyTo === author) return "self-reply";
    return "reply-to-other";
  }
  return "original";
}

export function tweetCreatedAtMs(tweet: Tweet): number | null {
  if (!tweet.createdAt) return null;
  const ms = Date.parse(tweet.createdAt);
  return Number.isFinite(ms) ? ms : null;
}

/** Drop tweets before orbit creation; mark older ids seen so they are not re-fetched. */
export function applyOrbitCreatedFloor(
  orbitId: string,
  tweets: Tweet[],
  createdAtMs: number,
): Tweet[] {
  const kept: Tweet[] = [];
  for (const tweet of tweets) {
    const ms = tweetCreatedAtMs(tweet);
    if (ms == null || ms < createdAtMs) {
      if (ms != null && ms < createdAtMs) markSeen(orbitId, tweet.id);
      continue;
    }
    kept.push(tweet);
  }
  return kept;
}

/** Drop replies to other users (not part of a typical X list feed). */
export function filterListFeedTweets(tweets: Tweet[]): Tweet[] {
  return tweets.filter((t) => t.feedType !== "reply-to-other");
}

/** Text passed to AI scoring — includes quote/RT context when present. */
export function tweetTextForEval(tweet: Tweet): string {
  if (tweet.retweetedTweet) {
    const embed = tweet.retweetedTweet;
    const wrapper = tweet.text.trim();
    const body = `@${embed.author}: ${embed.text}`.trim();
    return wrapper ? `[RT] ${wrapper}\n${body}` : `[RT] ${body}`;
  }
  if (tweet.quotedTweet) {
    const embed = tweet.quotedTweet;
    return `${tweet.text.trim()}\n[Quote @${embed.author}] ${embed.text}`.trim();
  }
  return tweet.text;
}

export interface TweetThreadGroup {
  conversationId: string;
  author: string;
  tweets: Tweet[];
}

/** Group author-only threads (same conversationId, same author, 2+ parts). */
export function groupAuthorThreads(tweets: Tweet[]): TweetThreadGroup[] {
  const byConversation = new Map<string, Tweet[]>();
  for (const tweet of tweets) {
    const key = tweet.conversationId ?? tweet.id;
    const bucket = byConversation.get(key) ?? [];
    bucket.push(tweet);
    byConversation.set(key, bucket);
  }

  const groups: TweetThreadGroup[] = [];
  for (const [conversationId, parts] of byConversation) {
    if (parts.length < 2) continue;
    const author = parts[0]?.author;
    if (!author || !parts.every((p) => p.author === author)) continue;
    parts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    groups.push({ conversationId, author, tweets: parts });
  }
  return groups;
}
