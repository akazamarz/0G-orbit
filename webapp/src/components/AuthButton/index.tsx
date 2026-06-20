import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";
import { ZG_CHAIN } from "@orbit/shared";
import { useSession } from "@/hooks/useSession";
import { signInWithWallet } from "@/lib/siwe-client";
import { useToast } from "@/components/Toast";
import styles from "./index.module.css";

interface Props {
  onAuthed?: (wallet: string) => void;
}

export function AuthButton({ onAuthed }: Props) {
  const { address, isConnected, chain } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { wallet: sessionWallet, refresh, signOut, loading: sessionLoading } = useSession();
  const { toast } = useToast();
  const [signInDeclined, setSignInDeclined] = useState(false);
  const wasConnected = useRef(false);
  const signingRef = useRef(false);

  const wrongChain = isConnected && chain && chain.id !== ZG_CHAIN.chainId;
  const sessionMatches =
    Boolean(address && sessionWallet) &&
    address!.toLowerCase() === sessionWallet!.toLowerCase();
  const needsSignIn = isConnected && address && !sessionMatches && !sessionLoading;

  const handleSignIn = useCallback(async () => {
    if (!address || signingRef.current || wrongChain) return false;
    signingRef.current = true;
    setSignInDeclined(false);
    try {
      await signInWithWallet(address, (args) => signMessageAsync(args));
      await refresh();
      onAuthed?.(address);
      return true;
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.toLowerCase().includes("rejected")) {
        setSignInDeclined(true);
      } else {
        toast(msg, "error");
      }
      return false;
    } finally {
      signingRef.current = false;
    }
  }, [address, wrongChain, signMessageAsync, refresh, onAuthed, toast]);

  useEffect(() => {
    if (!needsSignIn || signInDeclined || wrongChain) return;
    void handleSignIn();
  }, [needsSignIn, signInDeclined, wrongChain, handleSignIn]);

  useEffect(() => {
    setSignInDeclined(false);
  }, [address]);

  useEffect(() => {
    if (wasConnected.current && !isConnected) {
      void signOut();
    }
    wasConnected.current = isConnected;
  }, [isConnected, signOut]);

  return (
    <div className={styles.wrap}>
      {wrongChain && (
        <span className={styles.chainWarn}>Switch to {ZG_CHAIN.name}</span>
      )}

      {signInDeclined && needsSignIn && (
        <button type="button" className={styles.retry} onClick={() => void handleSignIn()}>
          Retry sign-in
        </button>
      )}

      <ConnectButton
        showBalance={false}
        chainStatus={wrongChain ? "icon" : "none"}
        accountStatus={sessionMatches ? "avatar" : "address"}
      />
    </div>
  );
}
