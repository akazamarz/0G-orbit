import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";
import { ZG_CHAIN } from "@orbit/shared";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/components/Toast";
import styles from "./index.module.css";

interface Props {
  onAuthed?: (wallet: string) => void;
}

export function AuthButton({ onAuthed }: Props) {
  const { address, isConnected, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { wallet: sessionWallet, refresh, signOut, loading: sessionLoading } = useSession();
  const { toast } = useToast();
  const [signingIn, setSigningIn] = useState(false);

  async function handleSignIn() {
    if (!address) return;
    setSigningIn(true);
    try {
      const nonceRes = await fetch("/api/auth/nonce");
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
      }).toMessage();

      const signature = await signMessageAsync({ message });
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });

      if (!verifyRes.ok) {
        const body = (await verifyRes.json()) as { error?: string };
        throw new Error(body.error ?? "Sign-in failed");
      }

      await refresh();
      onAuthed?.(address);
      toast("Signed in successfully", "success");
    } catch (err) {
      const msg = (err as Error).message;
      if (!msg.toLowerCase().includes("rejected")) {
        toast(msg, "error");
      }
    } finally {
      setSigningIn(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    disconnect();
    toast("Signed out", "info");
  }

  const wrongChain = isConnected && chain && chain.id !== ZG_CHAIN.chainId;
  const needsSignIn = isConnected && address && !sessionWallet && !sessionLoading;
  const isAuthed = Boolean(sessionWallet);

  return (
    <div className={styles.wrap}>
      {wrongChain && (
        <span className={styles.chainWarn}>Switch to {ZG_CHAIN.name}</span>
      )}

      {isAuthed ? (
        <div className={styles.authed}>
          <span className={styles.address}>
            {sessionWallet!.slice(0, 6)}…{sessionWallet!.slice(-4)}
          </span>
          <button type="button" className={styles.signOut} onClick={() => void handleSignOut()}>
            Sign out
          </button>
        </div>
      ) : needsSignIn ? (
        <button
          type="button"
          className={styles.signIn}
          onClick={() => void handleSignIn()}
          disabled={signingIn || Boolean(wrongChain)}
        >
          {signingIn ? "Signing…" : "Sign in"}
        </button>
      ) : null}

      <ConnectButton
        showBalance={false}
        chainStatus={wrongChain ? "icon" : "none"}
        accountStatus={isAuthed ? "avatar" : "address"}
      />
    </div>
  );
}
