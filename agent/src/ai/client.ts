import OpenAI from "openai";
import {
  loadConfig,
  type IntentToQueryResult,
  type TrackSource,
} from "@orbit/shared";
import { logger } from "../utils/logger.js";
import { ExternalApiError } from "../utils/errors.js";
import { retry } from "../utils/retry.js";
import {
  UPGRADE_INTENT_PROMPT,
  INTENT_TO_QUERY_PROMPT,
  BATCH_EVALUATE_PROMPT,
} from "./prompts.js";

let client: OpenAI | null = null;

export function getAiClient(): OpenAI {
  if (client) return client;
  const config = loadConfig();
  client = new OpenAI({
    baseURL: config.AI_BASE_URL,
    apiKey: config.AI_API_KEY,
  });
  logger.info({ baseURL: config.AI_BASE_URL }, "ai client initialized");
  return client;
}

async function chat(model: string, system: string, user: string): Promise<string> {
  const c = getAiClient();
  return retry(
    async () => {
      const res = await c.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
      });
      const content = res.choices[0]?.message?.content;
      if (!content) throw new ExternalApiError("empty ai response");
      return content;
    },
    { label: "ai-chat" },
  );
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned) as T;
}

function orbitConfigPrompt(
  name: string,
  topic: string | undefined,
  criteria: string,
  source: TrackSource,
): string {
  const lines = [
    `Orbit name: ${name}`,
    `Source: ${source === "list" ? "X list timeline" : "custom X search"}`,
    `Topic: ${topic?.trim() || "(none)"}`,
    `Criteria: ${criteria}`,
  ];
  return lines.join("\n");
}

/** Fallback when AI upgrade is unavailable. */
export function fallbackUpgradedCriteria(
  name: string,
  topic: string | undefined,
  criteria: string,
): string {
  const topicLine = topic?.trim() ? ` Topic: ${topic.trim()}.` : "";
  return `Orbit: ${name.trim()}.${topicLine} ${criteria.trim()}`.trim();
}

export async function upgradeOrbitIntent(
  name: string,
  topic: string | undefined,
  criteria: string,
  source: TrackSource,
): Promise<string> {
  const config = loadConfig();
  const raw = await chat(
    config.AI_MODEL_CHAT,
    UPGRADE_INTENT_PROMPT,
    orbitConfigPrompt(name, topic, criteria, source),
  );
  const text = raw.trim();
  if (!text) throw new ExternalApiError("empty upgraded criteria");
  return text;
}

export async function trackToQuery(upgradedCriteria: string): Promise<IntentToQueryResult> {
  const config = loadConfig();
  const raw = await chat(config.AI_MODEL_CHAT, INTENT_TO_QUERY_PROMPT, upgradedCriteria);
  return parseJson<IntentToQueryResult>(raw);
}

export interface BatchTweetInput {
  index: number;
  id: string;
  text: string;
}

export interface BatchTweetEvaluation {
  index: number;
  id: string;
  score: number;
  relevant: boolean;
  summary?: string;
  reason: string;
}

interface BatchEvaluateRow {
  index?: number;
  id?: string;
  score?: number;
  relevant?: boolean;
  summary?: string;
  reason?: string;
}

interface BatchEvaluateResponse {
  results?: BatchEvaluateRow[];
}

const SCORE_THRESHOLD = 70;

function clampScore(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function batchUserPrompt(upgradedCriteria: string, tweets: BatchTweetInput[]): string {
  return [
    "User criteria (sole standard for relevance - if a tweet does not satisfy this, score 0 and no summary):",
    upgradedCriteria,
    "",
    `Evaluate exactly ${tweets.length} tweet(s).`,
    "Tweets:",
    JSON.stringify(tweets, null, 2),
  ].join("\n");
}

function rowToEvaluation(row: BatchEvaluateRow, fallbackIndex: number, fallbackId: string): BatchTweetEvaluation {
  const rawScore = clampScore(row.score);
  const summary = row.summary?.trim() || undefined;
  const aiRelevant = row.relevant === true;
  const relevant = aiRelevant && rawScore >= SCORE_THRESHOLD && Boolean(summary);

  return {
    index: typeof row.index === "number" ? row.index : fallbackIndex,
    id: typeof row.id === "string" && row.id.length > 0 ? row.id : fallbackId,
    score: relevant ? rawScore : 0,
    relevant,
    summary: relevant ? summary : undefined,
    reason: row.reason?.trim() || (relevant ? "" : "not relevant to criteria"),
  };
}

function normalizeBatchResults(
  tweets: BatchTweetInput[],
  raw: unknown,
): BatchTweetEvaluation[] {
  const parsed = raw as BatchEvaluateResponse;
  const rows = Array.isArray(parsed?.results) ? parsed.results : [];

  const byIndex = new Map<number, BatchTweetEvaluation>();
  const byId = new Map<string, BatchTweetEvaluation>();

  for (const row of rows) {
    const fallbackIndex = typeof row.index === "number" ? row.index : -1;
    const fallbackId = row.id ?? "";
    const evaluation = rowToEvaluation(row, fallbackIndex, fallbackId);
    if (evaluation.index >= 0) byIndex.set(evaluation.index, evaluation);
    if (evaluation.id) byId.set(evaluation.id, evaluation);
  }

  return tweets.map((tweet) => {
    const hit = byIndex.get(tweet.index) ?? byId.get(tweet.id);
    if (hit) {
      return { ...hit, index: tweet.index, id: tweet.id };
    }
    return {
      index: tweet.index,
      id: tweet.id,
      score: 0,
      relevant: false,
      reason: "missing from batch response",
    };
  });
}

/** Score and summarize up to AI_BATCH_SIZE tweets in one request. */
export async function evaluateTweetBatch(
  upgradedCriteria: string,
  tweets: BatchTweetInput[],
): Promise<BatchTweetEvaluation[]> {
  if (tweets.length === 0) return [];
  const config = loadConfig();
  const raw = await chat(
    config.AI_MODEL_CHAT,
    BATCH_EVALUATE_PROMPT,
    batchUserPrompt(upgradedCriteria, tweets),
  );
  let parsed: unknown;
  try {
    parsed = parseJson<BatchEvaluateResponse>(raw);
  } catch (err) {
    logger.warn({ err, raw: raw.slice(0, 500) }, "batch evaluate json parse failed");
    throw new ExternalApiError("invalid batch evaluate json");
  }
  return normalizeBatchResults(tweets, parsed);
}
