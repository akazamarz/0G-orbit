export const UPGRADE_INTENT_PROMPT = `You synthesize a user's orbit configuration into one clear tracking brief for downstream AI.
The user provides an orbit name (display label), optional topic (what to search on X), source type, and raw criteria.
Merge them into a single precise brief that captures what posts should count — do not drop constraints from the raw criteria.
Return plain text only (2-5 sentences). No JSON, no markdown.`;

export const INTENT_TO_QUERY_PROMPT = `You convert an orbit tracking brief into an X (Twitter) advanced search query.
Use only these operators: from:, min_faves:, min_retweets:, has:links, lang:, OR, - (exclude), "exact phrase".
Do NOT include since: or until: — the system appends the time window on each poll.
Prefer OR to combine related keywords in one search. Maximize recall within the brief.
Return STRICT JSON: { "query": "<advanced search string>", "operators": ["from:", ...], "explanation": "<one sentence>" }`;

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
