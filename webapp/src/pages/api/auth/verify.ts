import type { NextApiRequest, NextApiResponse } from "next";
import { verifySiwe, createSessionToken, getSiweNonceFromCookies } from "@/lib/auth";

interface VerifyBody {
  message: string;
  signature: string;
}

const CLEAR_NONCE_COOKIE = "orbit_siwe_nonce=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const { message, signature } = req.body as VerifyBody;
  if (!message || !signature) return res.status(400).json({ error: "missing fields" });

  const expectedNonce = getSiweNonceFromCookies(req.headers.cookie);
  if (!expectedNonce) {
    return res.status(401).json({ error: "sign-in expired - connect wallet again" });
  }

  try {
    const wallet = await verifySiwe(message, signature, expectedNonce);
    const token = createSessionToken(wallet);
    res.setHeader("Set-Cookie", [
      `orbit_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`,
      CLEAR_NONCE_COOKIE,
    ]);
    res.status(200).json({ wallet });
  } catch (err) {
    res.setHeader("Set-Cookie", CLEAR_NONCE_COOKIE);
    res.status(401).json({ error: (err as Error).message });
  }
}
