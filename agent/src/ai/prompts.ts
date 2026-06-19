export const INTENT_TO_QUERY_PROMPT = `You convert a user's plain-English intent into an X (Twitter) advanced search query.
Use only these operators: from:, min_faves:, min_retweets:, has:links, since:, until:, lang:, OR, - (exclude), "exact phrase".
Return STRICT JSON: { "query": "<advanced search string>", "operators": ["from:", ...], "explanation": "<one sentence>" }`;

export const SCORE_PROMPT = `You score a tweet's relevance to a user's intent on a 0-100 scale.
Return STRICT JSON: { "score": <number 0-100>, "reason": "<one short sentence>" }`;

export const BRIEF_PROMPT = `You write a single-line summary (max 200 chars) of an alert from a tweet.
Be punchy, factual, and lead with the key signal. No filler. Return plain text only.`;

export const DIGEST_PROMPT = `You synthesize multiple alerts into one concise briefing (max 500 chars).
Group by theme, lead with the strongest signal, cite account names. Return plain text only.`;

export const REFINE_PROMPT = `You refine an X advanced search query based on negative feedback.
Make the query more precise to exclude irrelevant matches while keeping the original intent.
Return STRICT JSON: { "query": "<refined query>", "explanation": "<one sentence>" }`;
