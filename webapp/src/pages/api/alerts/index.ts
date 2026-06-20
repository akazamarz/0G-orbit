import type { NextApiRequest, NextApiResponse } from "next";
import { getSessionFromCookies } from "@/lib/auth";
import { agentFetch } from "@/lib/agent-client";
import type { AlertFeedResponse } from "@orbit/shared";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = getSessionFromCookies(req.headers.cookie);
  if (!session) return res.status(401).json({ error: "not authenticated" });

  if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });

  try {
    const params = new URLSearchParams();
    const limit = req.query.limit;
    if (limit != null && limit !== "") params.set("limit", String(limit));
    if (req.query.subscriptionId) params.set("subscriptionId", String(req.query.subscriptionId));
    if (req.query.before) params.set("before", String(req.query.before));
    if (req.query.after) params.set("after", String(req.query.after));

    const qs = params.toString();
    const path = `/internal/alerts?wallet=${encodeURIComponent(session.wallet)}${qs ? `&${qs}` : ""}`;
    const feed = await agentFetch<AlertFeedResponse>(path, { wallet: session.wallet });
    return res.status(200).json(feed);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}
