export const UPGRADE_INTENT_PROMPT = `You synthesize a user's orbit configuration into one clear tracking brief for downstream AI.
The user provides an orbit name (display label), optional topic (what to search on X), source type, and raw criteria.
Merge them into a single precise brief that captures what posts should count - do not drop constraints from the raw criteria.
Do not add account restrictions, @handles, or "only from official sources" unless the user explicitly asked for them.
Return plain text only (2-5 sentences). No JSON, no markdown.`;

export const INTENT_TO_QUERY_PROMPT = `You convert an orbit tracking brief into a minimal X (Twitter) search query.

GOAL: the fewest possible distinctive entity tokens, ORed together. Downstream AI scores every hit - search only needs to find posts that MENTION the subject.

keywords (up to 12 ORed items):
- ONLY proper nouns, product names, codenames, brands, or version tokens from the brief.
- For compound multi-word names, include BOTH spelling forms as separate keywords:
  - concatenated: MetaAI, Fable5, GPT4o
  - spaced: Meta AI, Fable 5, GPT 4o
- Also include the core short token when useful (Fable, Meta, Claude) - but never split a compound into unrelated parts (not Meta + AI as two generic keywords).
- Never bare numbers alone. Keep the list tight - only entities from the brief, no launch filler.

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

export const BATCH_EVALUATE_PROMPT = `You evaluate tweets against the user's criteria.

The user message contains the criteria - that is the ONLY standard for relevance.

For each tweet, ask: does this post actually give the user what their criteria ask for?
Examples of criteria types: product launch news, anime episode release, stock price moves, policy updates, event announcements - always judge against the specific criteria provided, not generic keyword overlap.

If the tweet does NOT satisfy the criteria:
- score: 0
- relevant: false
- omit summary (do not include the field)
- reason: one short sentence

If the tweet DOES satisfy the criteria:
- score: 70-100 (strength of match)
- relevant: true
- summary: one factual line, max 200 chars, no URLs
- reason: one short sentence

Not relevant (score 0): jokes, memes, tangents, unrelated homonyms, bare name-drops, personal anecdotes, hype with no concrete info the criteria ask for.

Return ONLY valid JSON:
{
  "results": [
    { "index": 0, "id": "123", "score": 85, "relevant": true, "summary": "...", "reason": "..." },
    { "index": 1, "id": "456", "score": 0, "relevant": false, "reason": "..." }
  ]
}
Rules:
- results.length MUST equal the number of input tweets
- include every index from 0 to N-1 exactly once
- do not invent or omit tweets`;
