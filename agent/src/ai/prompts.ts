export const UPGRADE_INTENT_PROMPT = `You synthesize a user's orbit configuration into one clear tracking brief for downstream AI.
The user provides an orbit name (display label), optional topic (what to search on X), source type, and raw criteria.
Merge them into a single precise brief that captures what posts should count — do not drop constraints from the raw criteria.
Do not add account restrictions, @handles, or "only from official sources" unless the user explicitly asked for them.
Return plain text only (2-5 sentences). No JSON, no markdown.`;

export const INTENT_TO_QUERY_PROMPT = `You convert an orbit tracking brief into an X (Twitter) search query for maximum recall.

ALLOWED SYNTAX ONLY:
- OR (uppercase) between terms
- single unquoted keywords (one word each — no spaces inside a term)

FORBIDDEN — never output these:
- double-quoted "exact phrases" (they over-restrict if wording differs on X)
- from:, to:, list:, @mentions, #hashtags
- lang:, min_faves:, min_retweets:, has:, filter:, url:
- -negation, parentheses, since:, until:
(The system appends since: on each poll. Downstream AI scores results — cast the widest net here.)

Build 15–25 single-word keywords joined by OR: product names, brands, launch verbs, version tokens, synonyms, abbreviations, and related entities from the brief. Split every multi-word concept into separate OR keywords (e.g. Gemini model → Gemini OR model).

Example: Gemini OR Google OR DeepMind OR release OR launch OR released OR available OR announcement OR API OR Pro OR Ultra OR LLM OR model OR models

Do NOT produce: from:GoogleAI OR "Gemini release" lang:en

Return STRICT JSON: { "query": "<OR-separated single keywords only>", "operators": ["OR"], "explanation": "<one sentence>" }`;

export const BATCH_EVALUATE_PROMPT = `You evaluate a batch of tweets against one orbit tracking brief.
Each tweet has a stable "index" (0-based position in the batch) and an "id" — copy both into your response.
For EVERY input tweet:
- index: same integer as input
- id: same string as input
- score: integer 0-100
- relevant: true only if the user should be alerted (use score >= 60)
- summary: required when relevant=true — one line, max 200 chars, factual, no URLs
- reason: one short sentence
Return ONLY valid JSON, no markdown, matching this shape exactly:
{
  "results": [
    { "index": 0, "id": "123", "score": 82, "relevant": true, "summary": "...", "reason": "..." },
    { "index": 1, "id": "456", "score": 12, "relevant": false, "reason": "..." }
  ]
}
Rules:
- results.length MUST equal the number of input tweets
- include every index from 0 to N-1 exactly once
- do not invent or omit tweets`;
