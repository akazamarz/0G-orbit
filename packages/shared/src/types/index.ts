export type WatchType = "accounts" | "lists" | "topics";

export type AlertMode = "live" | "digest";

export type FeedbackRating = "up" | "down";

export interface Subscription {
  id: string;
  wallet: string;
  intent: string;
  watchType: WatchType;
  mode: AlertMode;
  generatedQuery: string;
  queryVersion: number;
  pollIntervalMs: number;
  paused: boolean;
  storageRoot?: string;
  telegramChatId?: number;
  createdAt: number;
  updatedAt: number;
}

export interface SubscriptionInput {
  wallet: string;
  intent: string;
  watchType: WatchType;
  mode: AlertMode;
  storageRoot?: string;
  pollIntervalMs?: number;
}

export interface SubscriptionUpdate {
  intent?: string;
  watchType?: WatchType;
  mode?: AlertMode;
  paused?: boolean;
  pollIntervalMs?: number;
}

export interface Tweet {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  favoriteCount: number;
  retweetCount: number;
  replyCount: number;
  lang: string;
  url: string;
}

export interface ScoredTweet extends Tweet {
  score: number;
  scoreReason: string;
}

export interface Alert {
  id: string;
  subscriptionId: string;
  wallet: string;
  tweet: Tweet;
  summary: string;
  score: number;
  storageRoot?: string;
  attestationTxHash?: string;
  sentToTelegram: boolean;
  createdAt: number;
}

export interface AlertDigest {
  id: string;
  subscriptionId: string;
  wallet: string;
  alerts: Alert[];
  briefing: string;
  storageRoot?: string;
  attestationTxHash?: string;
  createdAt: number;
}

export interface Feedback {
  id: string;
  alertId: string;
  wallet: string;
  rating: FeedbackRating;
  createdAt: number;
}

export interface TelegramLink {
  nonce: string;
  wallet: string;
  chatId: number;
  linkedAt: number;
  expiresAt: number;
}

export interface CreateTelegramLinkRequest {
  wallet: string;
}

export interface LinkTelegramRequest {
  nonce: string;
  chatId: number;
}

export interface FeedbackRequest {
  wallet: string;
  alertId: string;
  rating: FeedbackRating;
}

export interface AlertQuery {
  wallet: string;
  since?: number;
  limit?: number;
}

export interface IntentToQueryResult {
  query: string;
  operators: string[];
  explanation: string;
}

export interface ScoreResult {
  score: number;
  reason: string;
}

export interface BriefResult {
  summary: string;
}

export interface TrendSignal {
  subscriptionIds: string[];
  topic: string;
  count: number;
  detectedAt: number;
}

export interface AttestationData {
  wallet: string;
  contentHash: string;
  storageRoot: string;
  timestamp: number;
  txHash: string;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  uptime: number;
  subscriptions: number;
  version: string;
}
