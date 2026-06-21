import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect, useSignMessage, useSwitchChain } from "wagmi";
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
  const { address, isConnected, chain, status } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const { wallet: sessionWallet, refresh, signOut, loading: sessionLoading } = useSession();
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();
  const [signing, setSigning] = useState(false);
  const wasConnected = useRef(false);
  const signingRef = useRef(false);
  const switchingRef = useRef(false);

  const chainKnown = !isConnected || chain != null;
  const wrongChain = isConnected && chainKnown && chain!.id !== ZG_CHAIN.chainId;
  const sessionMatches =
    Boolean(address && sessionWallet) &&
    address!.toLowerCase() === sessionWallet!.toLowerCase();
  const needsSignIn = isConnected && address && !sessionMatches && !sessionLoading;
  const switchingNetwork = isSwitchingChain || wrongChain;
  const signingIn = signing || (needsSignIn && chainKnown && !wrongChain);

  const rollbackToConnect = useCallback(async () => {
    await signOut();
    disconnect();
  }, [signOut, disconnect]);

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

  useEffect(() => {
    if (status !== "connected" || !wrongChain || switchingRef.current || isSwitchingChain) return;

    let cancelled = false;
    switchingRef.current = true;

    void (async () => {
      try {
        await switchChainAsync({ chainId: ZG_CHAIN.chainId });
      } catch (err) {
        if (cancelled) return;
        const msg = (err as Error).message?.toLowerCase() ?? "";
        if (msg.includes("connector not connected")) return;
        if (!msg.includes("rejected") && !msg.includes("denied")) {
          toast(
            `Orbit only works on ${ZG_CHAIN.name}. Approve the network switch in your wallet.`,
            "error",
          );
        }
        await rollbackToConnect();
      } finally {
        switchingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, wrongChain, isSwitchingChain, switchChainAsync, toast, rollbackToConnect]);

  useEffect(() => {
    if (!needsSignIn || wrongChain || !chainKnown) return;

    let cancelled = false;
    void (async () => {
      const ok = await handleSignIn();
      if (cancelled || ok) return;
      await rollbackToConnect();
    })();

    return () => {
      cancelled = true;
    };
  }, [needsSignIn, wrongChain, chainKnown, handleSignIn, rollbackToConnect]);

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

          if (sessionLoading || !chainKnown || switchingNetwork || signingIn) {
            return (
              <button type="button" className={styles.btn} disabled>
                {!chainKnown
                  ? "…"
                  : switchingNetwork
                    ? "Switching network…"
                    : signingIn
                      ? "Signing…"
                      : "…"}
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
