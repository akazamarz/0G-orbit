import type { NextApiRequest, NextApiResponse } from "next";
import { getSessionFromCookies } from "@/lib/auth";
import { agentFetch } from "@/lib/agent-client";
import type { FeedbackRequest } from "@orbit/shared";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = getSessionFromCookies(req.headers.cookie);
  if (!session) return res.status(401).json({ error: "not authenticated" });

  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  try {
    const body = req.body as Omit<FeedbackRequest, "wallet">;
    const fb = await agentFetch<unknown>("/internal/feedback", {
      method: "POST",
      body: { ...body, wallet: session.wallet },
      wallet: session.wallet,
    });
    return res.status(201).json(fb);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}
