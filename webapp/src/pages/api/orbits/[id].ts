import type { NextApiRequest, NextApiResponse } from "next";
import { getSessionFromCookies } from "@/lib/auth";
import { agentFetch } from "@/lib/agent-client";
import type { Orbit, OrbitUpdate } from "@orbit/shared";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = getSessionFromCookies(req.headers.cookie);
  if (!session) return res.status(401).json({ error: "not authenticated" });
  const { id } = req.query;
  if (typeof id !== "string") return res.status(400).json({ error: "invalid id" });

  try {
    if (req.method === "PATCH") {
      const body = req.body as OrbitUpdate;
      const orbit = await agentFetch<Orbit>(`/internal/orbits/${id}`, {
        method: "PATCH",
        body,
        wallet: session.wallet,
      });
      return res.status(200).json(orbit);
    }

    if (req.method === "DELETE") {
      await agentFetch<{ ok: boolean }>(`/internal/orbits/${id}`, {
        method: "DELETE",
        wallet: session.wallet,
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}
