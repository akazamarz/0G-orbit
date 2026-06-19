import type { NextApiRequest, NextApiResponse } from "next";
import { generateNonce } from "@/lib/auth";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });
  const nonce = generateNonce();
  res.status(200).json({ nonce });
}
