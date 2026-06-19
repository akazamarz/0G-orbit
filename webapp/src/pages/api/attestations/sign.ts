import type { NextApiRequest, NextApiResponse } from "next";
import { getSessionFromCookies } from "@/lib/auth";
import { agentFetch } from "@/lib/agent-client";
import type { AttestationData, SignAttestationRequest } from "@orbit/shared";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = getSessionFromCookies(req.headers.cookie);
  if (!session) return res.status(401).json({ error: "not authenticated" });

  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  try {
    const body = req.body as SignAttestationRequest;
    if (!body.contentHash || !body.storageRoot || !body.deadline || !body.signature) {
      return res.status(400).json({ error: "missing fields" });
    }

    const result = await agentFetch<AttestationData>(`/internal/attestations/sign`, {
      method: "POST",
      body,
      wallet: session.wallet,
    });
    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}
