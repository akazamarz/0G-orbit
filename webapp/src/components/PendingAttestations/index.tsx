import { useState } from "react";
import styles from "./index.module.css";
import type { EIP712Domain, PendingAttestation } from "@orbit/shared";
import { ZG_CHAIN } from "@orbit/shared";
import { signAttestation } from "@/lib/0g/attestation";

interface Props {
  pending: PendingAttestation[];
  domain: EIP712Domain | null;
  onAttested: () => void;
}

export function PendingAttestations({ pending, domain, onAttested }: Props) {
  const [signing, setSigning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successTx, setSuccessTx] = useState<string | null>(null);

  if (pending.length === 0) return null;

  async function handleSign(att: PendingAttestation) {
    if (!domain) return;
    setSigning(att.id);
    setError(null);
    setSuccessTx(null);

    try {
      const signature = await signAttestation(domain, att.contentHash, att.storageRoot, att.deadline);

      const res = await fetch("/api/attestations/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contentHash: att.contentHash,
          storageRoot: att.storageRoot,
          deadline: att.deadline,
          signature,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "attestation failed");
      }
      const result = await res.json();
      setSuccessTx(result.txHash);
      onAttested();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSigning(null);
    }
  }

  return (
    <div className={styles.list}>
      {pending.map((att) => {
        const isExpired = att.status === "expired";
        const isAttested = att.status === "attested";
        const isPending = att.status === "pending";

        return (
          <article key={att.id} className={styles.item}>
            <div className={styles.top}>
              <span
                className={`${styles.badge} ${
                  isAttested ? styles.badgeAttested : isExpired ? styles.badgeExpired : styles.badgePending
                }`}
              >
                {isAttested ? "Attested" : isExpired ? "Expired" : "Pending"}
              </span>
              <span className={styles.time}>{new Date(att.createdAt).toLocaleString()}</span>
            </div>
            <p className={styles.briefing}>{att.briefing}</p>
            <div className={styles.meta}>
              <span className={styles.hash}>root: {att.storageRoot.slice(0, 12)}...</span>
            </div>

            {isPending && (
              <button
                className={styles.signBtn}
                onClick={() => void handleSign(att)}
                disabled={signing === att.id}
              >
                {signing === att.id ? "Sign in MetaMask..." : "Attest on-chain"}
              </button>
            )}

            {isAttested && att.txHash && (
              <a
                className={styles.txLink}
                href={`${ZG_CHAIN.explorer}/tx/${att.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on explorer
              </a>
            )}

            {successTx && signing === null && (
              <a
                className={styles.txLink}
                href={`${ZG_CHAIN.explorer}/tx/${successTx}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Attested! View on explorer
              </a>
            )}

            {error && signing === null && <p className={styles.error}>{error}</p>}
          </article>
        );
      })}
    </div>
  );
}
