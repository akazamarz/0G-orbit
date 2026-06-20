import type { NextApiRequest, NextApiResponse } from "next";
import { getSessionFromCookies } from "@/lib/auth";
import { agentFetch, AgentError } from "@/lib/agent-client";
import type { Orbit, OrbitInput } from "@orbit/shared";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = getSessionFromCookies(req.headers.cookie);
  if (!session) return res.status(401).json({ error: "not authenticated" });

  try {
    if (req.method === "POST") {
      const body = req.body as OrbitInput;
      const orbit = await agentFetch<Orbit>("/internal/orbits", {
        method: "POST",
        body: { ...body, wallet: session.wallet },
        wallet: session.wallet,
      });
      return res.status(201).json(orbit);
    }

    if (req.method === "GET") {
      const orbits = await agentFetch<Orbit[]>("/internal/orbits", {
        wallet: session.wallet,
      });
      return res.status(200).json(orbits);
    }

    return res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    const status = err instanceof AgentError ? err.status : 500;
    return res.status(status).json({ error: (err as Error).message });
  }
}
