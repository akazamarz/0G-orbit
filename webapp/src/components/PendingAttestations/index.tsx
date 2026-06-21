import { useState } from "react";
import { useSignTypedData, useAccount } from "wagmi";
import styles from "./index.module.css";
import type { AttestationStatusResponse } from "@orbit/shared";
import { ZG_CHAIN, zgStorageFileUrl } from "@orbit/shared";
import { ATTESTATION_TYPES } from "@/lib/attestation-types";
import { useToast } from "@/components/Toast";

interface Props {
  status: AttestationStatusResponse;
  onRefresh: () => void;
}

export function PendingAttestations({ status, onRefresh }: Props) {
  const { isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  if (!status.enabled) return null;

  const batch = status.pendingBatch;
  const readyToSign = batch?.status === "pending";
  const count = status.unattestedCount;

  if (count === 0 && !readyToSign) return null;

  async function handleSign(): Promise<void> {
    if (!batch || !status.domain) return;
    if (!isConnected) {
      toast("Connect your wallet first", "error");
      return;
    }

    setBusy(true);
    try {
      const signature = await signTypedDataAsync({
        domain: {
          name: status.domain!.name,
          version: status.domain!.version,
          chainId: status.domain!.chainId,
          verifyingContract: status.domain!.verifyingContract as `0x${string}`,
        },
        types: ATTESTATION_TYPES,
        primaryType: "AttestationRequest",
        message: {
          contentHash: batch.contentHash as `0x${string}`,
          storageRoot: batch.storageRoot,
          deadline: BigInt(batch.deadline),
        },
      });

      const res = await fetch("/api/attestations/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contentHash: batch.contentHash,
          storageRoot: batch.storageRoot,
          deadline: batch.deadline,
          signature,
        }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Attestation failed");
      }

      const result = (await res.json()) as { txHash: string };
      toast(`Attested ${batch.alertCount} alert${batch.alertCount !== 1 ? "s" : ""} on-chain`, "success");
      onRefresh();
      window.open(`${ZG_CHAIN.explorer}/tx/${result.txHash}`, "_blank");
    } catch (err) {
      const msg = (err as Error).message;
      if (!msg.toLowerCase().includes("rejected")) {
        toast(msg, "error");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handlePrepareAndSign(): Promise<void> {
    if (readyToSign) {
      await handleSign();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/attestations/batch", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to prepare batch");
      }
      const prepared = (await res.json()) as NonNullable<AttestationStatusResponse["pendingBatch"]>;
      onRefresh();

      if (!status.domain || !isConnected) {
        toast("Batch prepared - connect wallet and tap Attest when ready", "success");
        return;
      }

      const signature = await signTypedDataAsync({
        domain: {
          name: status.domain.name,
          version: status.domain.version,
          chainId: status.domain.chainId,
          verifyingContract: status.domain.verifyingContract as `0x${string}`,
        },
        types: ATTESTATION_TYPES,
        primaryType: "AttestationRequest",
        message: {
          contentHash: prepared.contentHash as `0x${string}`,
          storageRoot: prepared.storageRoot,
          deadline: BigInt(prepared.deadline),
        },
      });

      const signRes = await fetch("/api/attestations/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contentHash: prepared.contentHash,
          storageRoot: prepared.storageRoot,
          deadline: prepared.deadline,
          signature,
        }),
      });

      if (!signRes.ok) {
        const body = (await signRes.json()) as { error?: string };
        throw new Error(body.error ?? "Attestation failed");
      }

      const result = (await signRes.json()) as { txHash: string };
      toast(`Attested ${prepared.alertCount} alert${prepared.alertCount !== 1 ? "s" : ""} on-chain`, "success");
      onRefresh();
      window.open(`${ZG_CHAIN.explorer}/tx/${result.txHash}`, "_blank");
    } catch (err) {
      const msg = (err as Error).message;
      if (!msg.toLowerCase().includes("rejected")) {
        toast(msg, "error");
      }
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  const summaries = batch?.alertSummaries ?? [];
  const displayCount = batch?.alertCount ?? count;

  const introCopy =
    displayCount === 1
      ? (
          <>
            Alerts are already on <strong>0G Storage</strong>. Attesting is optional -{" "}
            <strong>one wallet signature</strong> records that alert on-chain via a single manifest on 0G.
          </>
        )
      : (
          <>
            Alerts are already on <strong>0G Storage</strong>. Attesting is optional -{" "}
            <strong>one wallet signature</strong> covers all {displayCount} alerts in a single batch manifest
            on 0G.
          </>
        );

  return (
    <div className={styles.wrap}>
      <p className={styles.intro}>{introCopy}</p>

      <div className={styles.toolbar}>
        <span className={styles.count}>
          {readyToSign
            ? `${displayCount} alert${displayCount !== 1 ? "s" : ""} ready to sign`
            : `${count} alert${count !== 1 ? "s" : ""} not yet attested`}
        </span>
        {readyToSign ? (
          <button type="button" className={styles.primaryBtn} onClick={() => void handleSign()} disabled={busy}>
            {busy ? "Confirm in wallet…" : `Attest ${displayCount} on-chain`}
          </button>
        ) : (
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => void handlePrepareAndSign()}
            disabled={busy}
          >
            {busy ? "Preparing batch…" : `Attest ${count} on-chain`}
          </button>
        )}
      </div>

      {readyToSign && batch ? (
        <div className={styles.metaRow}>
          <a
            className={styles.storageLink}
            href={zgStorageFileUrl(batch.storageRoot)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Batch manifest on 0G
          </a>
        </div>
      ) : null}

      {summaries.length > 0 ? (
        <ul className={styles.summaryList}>
          {summaries.slice(0, 8).map((summary, index) => (
            <li key={`${index}-${summary.slice(0, 24)}`} className={styles.summaryItem}>
              {summary}
            </li>
          ))}
          {summaries.length > 8 ? (
            <li className={styles.summaryMore}>+{summaries.length - 8} more in this batch</li>
          ) : null}
        </ul>
      ) : null}

      {readyToSign ? (
        <p className={styles.hint}>
          Batch prepared. If you closed MetaMask, use <button type="button" className={styles.linkBtn} onClick={() => void handleSign()} disabled={busy}>Attest {displayCount} on-chain</button> when ready.
        </p>
      ) : null}
    </div>
  );
}
