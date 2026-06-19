import OpenAI from "openai";
import { loadConfig, type BriefResult, type IntentToQueryResult, type ScoreResult } from "@orbit/shared";
import { logger } from "../utils/logger.js";
import { ExternalApiError } from "../utils/errors.js";
import { retry } from "../utils/retry.js";
import { INTENT_TO_QUERY_PROMPT, SCORE_PROMPT, BRIEF_PROMPT, DIGEST_PROMPT, REFINE_PROMPT } from "./prompts.js";

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

export async function intentToQuery(intent: string): Promise<IntentToQueryResult> {
  const config = loadConfig();
  const raw = await chat(config.AI_MODEL_CHAT, INTENT_TO_QUERY_PROMPT, intent);
  return parseJson<IntentToQueryResult>(raw);
}

export async function scoreTweet(intent: string, tweetText: string): Promise<ScoreResult> {
  const config = loadConfig();
  const raw = await chat(
    config.AI_MODEL_CHAT,
    SCORE_PROMPT,
    `Intent: ${intent}\nTweet: ${tweetText}`,
  );
  return parseJson<ScoreResult>(raw);
}

export async function briefAlert(tweetText: string): Promise<BriefResult> {
  const config = loadConfig();
  const summary = await chat(config.AI_MODEL_CHAT, BRIEF_PROMPT, tweetText);
  return { summary: summary.trim() };
}

export async function digestBriefing(alertsText: string): Promise<string> {
  const config = loadConfig();
  const briefing = await chat(config.AI_MODEL_REASONER, DIGEST_PROMPT, alertsText);
  return briefing.trim();
}

export async function refineQuery(intent: string, currentQuery: string, negatives: string): Promise<IntentToQueryResult> {
  const config = loadConfig();
  const raw = await chat(
    config.AI_MODEL_REASONER,
    REFINE_PROMPT,
    `Intent: ${intent}\nCurrent query: ${currentQuery}\nIrrelevant matches to exclude: ${negatives}`,
  );
  return parseJson<IntentToQueryResult>(raw);
}
