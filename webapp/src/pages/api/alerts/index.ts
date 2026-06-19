import type { NextApiRequest, NextApiResponse } from "next";
import { getSessionFromCookies } from "@/lib/auth";
import { agentFetch } from "@/lib/agent-client";
import type { Alert } from "@orbit/shared";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = getSessionFromCookies(req.headers.cookie);
  if (!session) return res.status(401).json({ error: "not authenticated" });

  if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });

  try {
    const since = (req.query.since as string) ?? "0";
    const alerts = await agentFetch<Alert[]>(`/internal/alerts?wallet=${session.wallet}&since=${since}`, {
      wallet: session.wallet,
    });
    return res.status(200).json(alerts);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}
