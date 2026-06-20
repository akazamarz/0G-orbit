import type { NextApiRequest, NextApiResponse } from "next";
import { getSessionFromCookies } from "@/lib/auth";
import { agentFetch } from "@/lib/agent-client";
import type { Subscription, SubscriptionInput } from "@orbit/shared";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = getSessionFromCookies(req.headers.cookie);
  if (!session) return res.status(401).json({ error: "not authenticated" });

  try {
    if (req.method === "POST") {
      const body = req.body as SubscriptionInput;
      const sub = await agentFetch<Subscription>("/internal/subscriptions", {
        method: "POST",
        body: { ...body, wallet: session.wallet },
        wallet: session.wallet,
      });
      return res.status(201).json(sub);
    }

    if (req.method === "GET") {
      const subs = await agentFetch<Subscription[]>("/internal/subscriptions", {
        wallet: session.wallet,
      });
      return res.status(200).json(subs);
    }

    return res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}
