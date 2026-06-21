import { useCallback, useEffect, useRef } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect } from "wagmi";
import { useSession } from "@/hooks/useSession";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import styles from "./index.module.css";

export function AuthButton() {
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { signOut } = useSession();
  const { confirm } = useConfirmDialog();
  const wasConnected = useRef(false);

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
      <ConnectButton.Custom>
        {({
          account,
          chain,
          openChainModal,
          openConnectModal,
          authenticationStatus,
          mounted,
        }) => {
          if (!mounted) return null;

          if (authenticationStatus === "loading") {
            return (
              <button type="button" className={styles.btn} disabled>
                {account ? "Signing…" : "…"}
              </button>
            );
          }

          if (!account || !chain) {
            return (
              <button type="button" className={styles.btn} onClick={openConnectModal}>
                Connect Wallet
              </button>
            );
          }

          if (chain.unsupported) {
            return (
              <button type="button" className={styles.btn} onClick={openChainModal}>
                Wrong network
              </button>
            );
          }

          if (authenticationStatus !== "authenticated") {
            return (
              <button type="button" className={styles.btn} onClick={openConnectModal}>
                Connect Wallet
              </button>
            );
          }

          return (
            <button
              type="button"
              className={styles.btn}
              onClick={() => void handleDisconnect()}
              title={account.address}
            >
              {account.displayName}
            </button>
          );
        }}
      </ConnectButton.Custom>
    </div>
  );
}
