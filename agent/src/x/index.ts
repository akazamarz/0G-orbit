export { advancedSearch, searchAllPages, X_SEARCH_PAGE_SIZE, FIRST_POLL_MAX_PAGES } from "./client.js";
export type { SearchResult, PaginatedFetchContext } from "./client.js";
export {
  buildPollSearchQuery,
  buildListPollQuery,
  buildListFeedQueryBase,
  formatTwitterSince,
  formatTwitterUntil,
  stripTimeBounds,
  toEntityOrQuery,
} from "./query.js";
export {
  mapTweet,
  classifyTweet,
  filterListFeedTweets,
  tweetTextForEval,
  groupAuthorThreads,
  tweetCreatedAtMs,
  applyOrbitCreatedFloor,
} from "./tweet.js";
export type { TweetThreadGroup } from "./tweet.js";
export { markSeen, isSeen, filterUnseen } from "./dedup.js";
