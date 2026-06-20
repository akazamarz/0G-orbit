import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/components/Toast";
import styles from "./index.module.css";

interface LinkResult {
  nonce: string;
  deeplink: string;
}

export default function Connect() {
  const { isAuthed, loading } = useSession();
  const { toast } = useToast();
  const [link, setLink] = useState<LinkResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function getDeeplink() {
    setBusy(true);
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate link");
      setLink((await res.json()) as LinkResult);
      toast("Telegram link generated", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Connect Telegram - Orbit</title>
      </Head>
      <AppShell title="Connect Telegram">
        <div className={styles.steps}>
          <div className={`${styles.step} ${isAuthed ? styles.stepDone : styles.stepActive}`}>
            <span className={styles.stepNum}>1</span>
            <span>Wallet</span>
          </div>
          <div className={styles.stepLine} />
          <div className={`${styles.step} ${link ? styles.stepDone : isAuthed ? styles.stepActive : ""}`}>
            <span className={styles.stepNum}>2</span>
            <span>Telegram</span>
          </div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.title}>Generate link</h2>
          {loading ? (
            <p className={styles.muted}>Loading…</p>
          ) : !isAuthed ? (
            <EmptyState
              title="Connect your wallet"
              description="Connect your wallet from the header — signing in happens automatically — then return here to link Telegram."
            />
          ) : (
            <>
              <p className={styles.desc}>
                Link your Telegram account to receive live alerts and daily digests from your orbits.
              </p>
              <button type="button" className={styles.btn} onClick={() => void getDeeplink()} disabled={busy}>
                {busy ? "Generating…" : "Generate Telegram link"}
              </button>
              {link && (
                <div className={styles.linkBox}>
                  <p className={styles.hint}>Link expires in 10 minutes. Tap below to open Telegram.</p>
                  <a className={styles.deeplink} href={link.deeplink} target="_blank" rel="noopener noreferrer">
                    Open in Telegram
                  </a>
                </div>
              )}
              <Link href="/subscriptions" className={styles.secondary}>
                Create an orbit →
              </Link>
            </>
          )}
        </div>
      </AppShell>
    </>
  );
}
