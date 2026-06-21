import { createAuthenticationAdapter } from "@rainbow-me/rainbowkit";
import { SiweMessage } from "siwe";
import type { AuthenticationStatus } from "@rainbow-me/rainbowkit";

interface AuthAdapterHandlers {
  setAuthStatus: (status: AuthenticationStatus) => void;
  setWallet: (wallet: string | null) => void;
  onAuthFailed?: () => void;
}

export function createOrbitAuthAdapter({
  setAuthStatus,
  setWallet,
  onAuthFailed,
}: AuthAdapterHandlers) {
  return createAuthenticationAdapter({
    getNonce: async () => {
      const res = await fetch("/api/auth/nonce", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Could not get sign-in nonce");
      const { nonce } = (await res.json()) as { nonce: string };
      return nonce;
    },
    createMessage: ({ nonce, address, chainId }) => {
      return new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to Orbit",
        uri: window.location.origin,
        version: "1",
        chainId,
        nonce,
        issuedAt: new Date().toISOString(),
      }).toMessage();
    },
    verify: async ({ message, signature }) => {
      setAuthStatus("loading");
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ message, signature }),
      });
      if (!verifyRes.ok) {
        setWallet(null);
        setAuthStatus("unauthenticated");
        onAuthFailed?.();
        return false;
      }
      const { wallet } = (await verifyRes.json()) as { wallet: string };
      setWallet(wallet);
      setAuthStatus("authenticated");
      return true;
    },
    signOut: async () => {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      setWallet(null);
      setAuthStatus("unauthenticated");
    },
  });
}
