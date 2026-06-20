import type { NextApiRequest, NextApiResponse } from "next";
import { getSessionFromCookies } from "@/lib/auth";
import { agentFetch } from "@/lib/agent-client";
import type { PendingAttestation } from "@orbit/shared";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = getSessionFromCookies(req.headers.cookie);
  if (!session) return res.status(401).json({ error: "not authenticated" });

  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  try {
    const batch = await agentFetch<PendingAttestation>("/internal/attestations/batch", {
      method: "POST",
      wallet: session.wallet,
    });
    return res.status(201).json(batch);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}
