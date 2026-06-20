import { SiweMessage } from "siwe";
import { ZG_CHAIN } from "@orbit/shared";

export async function signInWithWallet(
  address: string,
  signMessage: (args: { message: string }) => Promise<string>,
): Promise<string> {
  const nonceRes = await fetch("/api/auth/nonce", { credentials: "same-origin" });
  if (!nonceRes.ok) throw new Error("Could not get sign-in nonce");
  const { nonce } = (await nonceRes.json()) as { nonce: string };

  const message = new SiweMessage({
    domain: window.location.host,
    address,
    statement: "Sign in to Orbit",
    uri: window.location.origin,
    version: "1",
    chainId: ZG_CHAIN.chainId,
    nonce,
    issuedAt: new Date().toISOString(),
  }).toMessage();

  const signature = await signMessage({ message });
  const verifyRes = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ message, signature }),
  });

  if (!verifyRes.ok) {
    const body = (await verifyRes.json()) as { error?: string };
    throw new Error(body.error ?? "Sign-in failed");
  }

  return address;
}
