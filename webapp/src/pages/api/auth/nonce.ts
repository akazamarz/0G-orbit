import type { NextApiRequest, NextApiResponse } from "next";
import { generateNonce } from "@/lib/auth";

const NONCE_COOKIE = "orbit_siwe_nonce";
const NONCE_MAX_AGE = 300;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });
  const nonce = generateNonce();
  res.setHeader(
    "Set-Cookie",
    `${NONCE_COOKIE}=${nonce}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${NONCE_MAX_AGE}`,
  );
  res.status(200).json({ nonce });
}
