import type { NextApiRequest, NextApiResponse } from "next";
import { getSessionFromCookies } from "@/lib/auth";
import { agentFetch, AgentError } from "@/lib/agent-client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = getSessionFromCookies(req.headers.cookie);
  if (!session) return res.status(401).json({ error: "not authenticated" });

  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  try {
    await agentFetch<{ ok: true }>("/internal/telegram/unlink", {
      method: "POST",
      body: { wallet: session.wallet },
      wallet: session.wallet,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    if (err instanceof AgentError) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: (err as Error).message });
  }
}
