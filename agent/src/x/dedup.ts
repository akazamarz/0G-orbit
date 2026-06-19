import { getDb } from "../db/client.js";
import type { Tweet } from "@orbit/shared";

export function markSeen(subscriptionId: string, tweetId: string): void {
  getDb()
    .prepare("INSERT OR IGNORE INTO seen_tweets (subscription_id, tweet_id, seen_at) VALUES (?, ?, ?)")
    .run(subscriptionId, tweetId, Date.now());
}

export function isSeen(subscriptionId: string, tweetId: string): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM seen_tweets WHERE subscription_id = ? AND tweet_id = ?")
    .get(subscriptionId, tweetId);
  return Boolean(row);
}

export function filterUnseen(subscriptionId: string, tweets: Tweet[]): Tweet[] {
  return tweets.filter((t) => !isSeen(subscriptionId, t.id));
}
