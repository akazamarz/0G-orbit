import { getDb } from "../db/client.js";
import type { Tweet } from "@orbit/shared";

export function markSeen(orbitId: string, tweetId: string): void {
  getDb()
    .prepare("INSERT OR IGNORE INTO seen_tweets (orbit_id, tweet_id, seen_at) VALUES (?, ?, ?)")
    .run(orbitId, tweetId, Date.now());
}

export function isSeen(orbitId: string, tweetId: string): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM seen_tweets WHERE orbit_id = ? AND tweet_id = ?")
    .get(orbitId, tweetId);
  return Boolean(row);
}

export function filterUnseen(orbitId: string, tweets: Tweet[]): Tweet[] {
  return tweets.filter((t) => !isSeen(orbitId, t.id));
}
