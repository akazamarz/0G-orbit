export const UPGRADE_INTENT_PROMPT = `You synthesize a user's orbit configuration into one clear tracking brief for downstream AI.
The user provides an orbit name (display label), optional topic (what to search on X), source type, and raw criteria.
Merge them into a single precise brief that captures what posts should count — do not drop constraints from the raw criteria.
Do not add account restrictions, @handles, or "only from official sources" unless the user explicitly asked for them.
Return plain text only (2-5 sentences). No JSON, no markdown.`;

export const INTENT_TO_QUERY_PROMPT = `You convert an orbit tracking brief into a minimal X (Twitter) search query.

GOAL: the fewest possible distinctive entity tokens, ORed together. Downstream AI scores every hit — search only needs to find posts that MENTION the subject.

keywords (up to 12 ORed items):
- ONLY proper nouns, product names, codenames, brands, or version tokens from the brief.
- For compound multi-word names, include BOTH spelling forms as separate keywords:
  - concatenated: MetaAI, Fable5, GPT4o
  - spaced: Meta AI, Fable 5, GPT 4o
- Also include the core short token when useful (Fable, Meta, Claude) — but never split a compound into unrelated parts (not Meta + AI as two generic keywords).
- Never bare numbers alone. Keep the list tight — only entities from the brief, no launch filler.

NEVER include:
- Generic verbs or launch filler: release, launched, available, announcement, beta, waitlist, news, update, public, access, model, API, chat
- Standalone generic tokens: AI, ML, LLM (only inside compounds like MetaAI or Meta AI)
- from:, to:, list:, @mentions, #hashtags, lang:, since:, until:, quotes, parentheses

Example brief: "Track Anthropic Fable 5 public release"
  keywords: ["Fable5", "Fable 5", "Fable", "Anthropic", "Claude"]

Example brief: "Track Meta AI assistant launch"
  keywords: ["MetaAI", "Meta AI", "Meta"]

Example brief: "Track Gemini model release from Google"
  keywords: ["Gemini", "Google", "DeepMind"]

Return STRICT JSON:
{
  "keywords": ["...", "..."],
  "query": "<keywords joined with OR, for display>",
  "operators": ["OR"],
  "explanation": "<one sentence>"
}`;

export const BATCH_EVALUATE_PROMPT = `You evaluate a batch of tweets against one orbit tracking brief.
Each tweet has a stable "index" (0-based position in the batch) and an "id" — copy both into your response.

RELEVANCE — be strict:
- relevant=true ONLY when the tweet directly concerns what the brief asks to track (specific product/event/topic).
- Company or brand news (hiring, funding, partnerships, lawsuits, executive moves) is NOT relevant unless it explicitly mentions the tracked product/event.
- Mentioning a brand name alone is NOT enough — the content must match the brief's intent.
- Tangential industry commentary, rumors about unrelated products, or generic hype score below 40.

For EVERY input tweet:
- index: same integer as input
- id: same string as input
- score: integer 0-100 (70+ only when clearly on-topic for the brief)
- relevant: true only if the user should be alerted (score >= 70)
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
