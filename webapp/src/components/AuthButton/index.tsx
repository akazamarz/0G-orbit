import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { ZG_CHAIN } from "@orbit/shared";
import { useSession } from "@/hooks/useSession";
import { signInWithWallet } from "@/lib/siwe-client";
import { useToast } from "@/components/Toast";
import { useConfirmDialog } from "@/components/ConfirmDialog";
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
  const { confirm } = useConfirmDialog();
  const [signing, setSigning] = useState(false);
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
    setSigning(true);
    try {
      await signInWithWallet(address, (args) => signMessageAsync(args));
      await refresh();
      onAuthed?.(address);
      return true;
    } catch (err) {
      const msg = (err as Error).message;
      if (!msg.toLowerCase().includes("rejected")) {
        toast(msg, "error");
      }
      return false;
    } finally {
      signingRef.current = false;
      setSigning(false);
    }
  }, [address, wrongChain, signMessageAsync, refresh, onAuthed, toast]);

  const handleDisconnect = useCallback(async () => {
    const ok = await confirm({
      title: "Disconnect wallet?",
      description: "You will be signed out of Orbit until you connect and sign in again.",
      confirmLabel: "Disconnect",
      tone: "danger",
    });
    if (!ok) return;
    await signOut();
    disconnect();
  }, [confirm, signOut, disconnect]);

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

      <ConnectButton.Custom>
        {({ openConnectModal, mounted }) => {
          if (!mounted) return null;

          if (!isConnected) {
            return (
              <button type="button" className={styles.btn} onClick={openConnectModal}>
                Connect Wallet
              </button>
            );
          }

          if (sessionLoading) {
            return (
              <button type="button" className={styles.btn} disabled>
                …
              </button>
            );
          }

          if (needsSignIn) {
            return (
              <button
                type="button"
                className={styles.btn}
                onClick={() => void handleSignIn()}
                disabled={signing || wrongChain}
              >
                {signing ? "Signing…" : "Sign"}
              </button>
            );
          }

          return (
            <button type="button" className={styles.btn} onClick={() => void handleDisconnect()}>
              Disconnect
            </button>
          );
        }}
      </ConnectButton.Custom>
    </div>
  );
}
