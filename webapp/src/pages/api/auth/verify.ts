import type { NextApiRequest, NextApiResponse } from "next";
import { createSiweMessage, verifySiwe, createSessionToken } from "@/lib/auth";

interface VerifyBody {
  message: string;
  signature: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const { message, signature } = req.body as VerifyBody;
  if (!message || !signature) return res.status(400).json({ error: "missing fields" });

  try {
    const wallet = await verifySiwe(message, signature);
    const token = createSessionToken(wallet);
    res.setHeader("Set-Cookie", `orbit_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
    res.status(200).json({ wallet });
  } catch (err) {
    res.status(401).json({ error: (err as Error).message });
  }
}

export function createMessageForWallet(wallet: string, nonce: string): string {
  return createSiweMessage(wallet, nonce);
}
