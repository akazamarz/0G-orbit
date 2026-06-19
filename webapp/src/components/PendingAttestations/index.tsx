import { useState } from "react";
import { useSignTypedData, useAccount } from "wagmi";
import styles from "./index.module.css";
import type { EIP712Domain, PendingAttestation } from "@orbit/shared";
import { ZG_CHAIN } from "@orbit/shared";
import { ATTESTATION_TYPES } from "@/lib/attestation-types";
import { useToast } from "@/components/Toast";

interface Props {
  pending: PendingAttestation[];
  domain: EIP712Domain | null;
  onAttested: () => void;
}

export function PendingAttestations({ pending, domain, onAttested }: Props) {
  const { isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { toast } = useToast();
  const [signing, setSigning] = useState<string | null>(null);

  if (pending.length === 0) return null;

  async function handleSign(att: PendingAttestation) {
    if (!domain) return;
    if (!isConnected) {
      toast("Connect your wallet first", "error");
      return;
    }

    setSigning(att.id);
    try {
      const signature = await signTypedDataAsync({
        domain: {
          name: domain.name,
          version: domain.version,
          chainId: BigInt(domain.chainId),
          verifyingContract: domain.verifyingContract as `0x${string}`,
        },
        types: ATTESTATION_TYPES,
        primaryType: "AttestationRequest",
        message: {
          contentHash: att.contentHash as `0x${string}`,
          storageRoot: att.storageRoot,
          deadline: BigInt(att.deadline),
        },
      });

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
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Attestation failed");
      }

      const result = (await res.json()) as { txHash: string };
      toast("Attestation confirmed on-chain", "success");
      onAttested();
      window.open(`${ZG_CHAIN.explorer}/tx/${result.txHash}`, "_blank");
    } catch (err) {
      const msg = (err as Error).message;
      if (!msg.toLowerCase().includes("rejected")) {
        toast(msg, "error");
      }
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
              <span className={styles.hash}>root: {att.storageRoot.slice(0, 16)}…</span>
            </div>

            {isPending && (
              <button
                type="button"
                className={styles.signBtn}
                onClick={() => void handleSign(att)}
                disabled={signing === att.id}
              >
                {signing === att.id ? "Confirm in wallet…" : "Attest on-chain"}
              </button>
            )}

            {isAttested && att.txHash && (
              <a
                className={styles.txLink}
                href={`${ZG_CHAIN.explorer}/tx/${att.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on explorer →
              </a>
            )}
          </article>
        );
      })}
    </div>
  );
}
