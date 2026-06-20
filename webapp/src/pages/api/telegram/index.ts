import type { NextApiRequest, NextApiResponse } from "next";
import { getSessionFromCookies } from "@/lib/auth";
import { agentFetch, AgentError } from "@/lib/agent-client";
import type { UpdateWalletTelegramRequest, WalletTelegramStatus } from "@orbit/shared";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = getSessionFromCookies(req.headers.cookie);
  if (!session) return res.status(401).json({ error: "not authenticated" });

  try {
    if (req.method === "GET") {
      const status = await agentFetch<WalletTelegramStatus>("/internal/telegram", {
        wallet: session.wallet,
      });
      return res.status(200).json(status);
    }

    if (req.method === "PATCH") {
      const body = req.body as UpdateWalletTelegramRequest;
      const status = await agentFetch<WalletTelegramStatus>("/internal/telegram", {
        method: "PATCH",
        body,
        wallet: session.wallet,
      });
      return res.status(200).json(status);
    }

    return res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    if (err instanceof AgentError) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: (err as Error).message });
  }
}
