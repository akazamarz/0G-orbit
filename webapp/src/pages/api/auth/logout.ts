import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  res.setHeader("Set-Cookie", "orbit_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  res.status(200).json({ ok: true });
}
