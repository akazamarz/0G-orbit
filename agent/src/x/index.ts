export { advancedSearch, searchAllPages, listTimeline, listTimelineAllPages, X_SEARCH_PAGE_SIZE } from "./client.js";
export type { SearchResult } from "./client.js";
export { buildPollSearchQuery, formatTwitterSince, stripTimeBounds, toEntityOrQuery } from "./query.js";
export { markSeen, isSeen, filterUnseen } from "./dedup.js";
