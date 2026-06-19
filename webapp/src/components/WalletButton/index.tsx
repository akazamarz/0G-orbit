import { useState } from "react";
import { SiweMessage } from "siwe";
import styles from "./index.module.css";
import { getWalletAddress, getSigner } from "@/lib/0g/chain";

interface Props {
  onWallet?: (wallet: string) => void;
}

export function WalletButton({ onWallet }: Props) {
  const [wallet, setWallet] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function connect() {
    setBusy(true);
    try {
      const address = await getWalletAddress();
      if (!address) return;
      const signer = await getSigner();
      if (!signer) return;

      const nonceRes = await fetch("/api/auth/nonce");
      const { nonce } = (await nonceRes.json()) as { nonce: string };

      const message = new SiweMessage({
        domain: "localhost",
        address,
        statement: "Sign in to Orbit",
        uri: "http://localhost:3000",
        version: "1",
        chainId: 16602,
        nonce,
      }).toMessage();

      const signature = await signer.signMessage(message);

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });

      if (verifyRes.ok) {
        setWallet(address);
        onWallet?.(address);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className={styles.button} onClick={connect} disabled={busy}>
      {wallet ? (
        <span className={styles.address}>
          {wallet.slice(0, 6)}…{wallet.slice(-4)}
        </span>
      ) : (
        "Connect wallet"
      )}
    </button>
  );
}
