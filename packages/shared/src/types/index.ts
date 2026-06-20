export type TrackSource = "list" | "custom";

export type FeedbackRating = "up" | "down";

export interface Orbit {
  id: string;
  wallet: string;
  source: TrackSource;
  /** User-facing orbit name (dashboard, Telegram, etc.). */
  title: string;
  /** Custom-topic search subject; drives AI query generation. */
  topic?: string;
  criteria: string;
  listId?: string;
  /** AI-synthesized brief from title + topic + criteria. */
  upgradedCriteria?: string;
  notifyTelegram: boolean;
  generatedQuery: string;
  queryVersion: number;
  pollIntervalMs: number;
  lastPolledAt?: number;
  paused: boolean;
  storageRoot?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OrbitInput {
  wallet: string;
  source: TrackSource;
  title: string;
  topic?: string;
  criteria: string;
  listId?: string;
  notifyTelegram: boolean;
  storageRoot?: string;
  pollIntervalMs?: number;
}

export interface OrbitUpdate {
  title?: string;
  topic?: string;
  criteria?: string;
  listId?: string;
  notifyTelegram?: boolean;
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
  orbitId: string;
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
  orbitId: string;
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

export interface WalletTelegram {
  wallet: string;
  chatId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  alertsEnabled: boolean;
  linkedAt: number;
  updatedAt: number;
}

export interface WalletTelegramStatus {
  linked: boolean;
  chatId?: number;
  username?: string;
  displayName?: string;
  linkedAt?: number;
  alertsEnabled: boolean;
}

export interface UpdateWalletTelegramRequest {
  alertsEnabled: boolean;
}

export interface FeedbackRequest {
  wallet: string;
  alertId: string;
  rating: FeedbackRating;
}

export interface AlertCursor {
  createdAt: number;
  id: string;
}

export interface AlertQuery {
  wallet: string;
  orbitId?: string;
  limit?: number;
  before?: AlertCursor;
  after?: AlertCursor;
}

export interface AlertFeedResponse {
  items: Alert[];
  nextCursor: AlertCursor | null;
  hasMore: boolean;
  total: number;
}

export interface IntentToQueryResult {
  /** Distinctive entity/product tokens only — joined with OR (3–6 items). */
  keywords: string[];
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

export interface AttestationData {
  wallet: string;
  contentHash: string;
  storageRoot: string;
  timestamp: number;
  txHash: string;
}

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

export interface AttestationRequest {
  contentHash: string;
  storageRoot: string;
  deadline: number;
}

export interface PendingAttestation {
  id: string;
  wallet: string;
  contentHash: string;
  storageRoot: string;
  digestId: string;
  briefing: string;
  deadline: number;
  status: "pending" | "attested" | "expired";
  txHash?: string;
  createdAt: number;
  attestedAt?: number;
}

export interface PendingAttestationsResponse {
  enabled: boolean;
  pending: PendingAttestation[];
  domain: EIP712Domain | null;
}

export interface SignAttestationRequest {
  contentHash: string;
  storageRoot: string;
  deadline: number;
  signature: string;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  uptime: number;
  orbits: number;
  version: string;
}
