import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Loading } from "@/components/Loading";
import { WalletRequiredState } from "@/components/WalletRequiredState";
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
        {loading ? (
          <Loading />
        ) : !isAuthed ? (
          <WalletRequiredState />
        ) : (
          <div className={styles.page}>
            <section className={styles.panel} aria-label="Connection progress">
              <div className={styles.panelBody}>
                <div className={styles.steps}>
                  <div className={`${styles.step} ${styles.stepDone}`}>
                    <span className={styles.stepNum}>1</span>
                    <span className={styles.stepLabel}>Wallet connected</span>
                  </div>
                  <div className={styles.stepLine} aria-hidden />
                  <div className={`${styles.step} ${link ? styles.stepDone : styles.stepActive}`}>
                    <span className={styles.stepNum}>2</span>
                    <span className={styles.stepLabel}>
                      {link ? "Link generated" : "Link Telegram"}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className={styles.panel} aria-labelledby="link-heading">
              <div className={styles.panelHead}>
                <h2 id="link-heading" className={styles.panelTitle}>
                  Telegram
                </h2>
              </div>
              <div className={styles.panelBody}>
                <p className={styles.desc}>
                  Link Telegram to get notified in chat when an orbit finds a post on X that fits
                  your criteria. Orbits with push turned off still collect alerts on your dashboard
                  only.
                </p>

                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => void getDeeplink()}
                  disabled={busy}
                >
                  {busy ? "Generating…" : "Generate Telegram link"}
                </button>

                {link && (
                  <div className={styles.linkResult}>
                    <p className={styles.linkHint}>
                      Link expires in 10 minutes. Open Telegram and tap <strong>Start</strong> when
                      prompted.
                    </p>
                    <a
                      className={styles.btnPrimary}
                      href={link.deeplink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open in Telegram
                    </a>
                  </div>
                )}
              </div>
            </section>

            <section className={styles.panel} aria-labelledby="how-heading">
              <div className={styles.panelHead}>
                <h2 id="how-heading" className={styles.panelTitle}>
                  How it works
                </h2>
              </div>
              <div className={styles.panelBody}>
                <ol className={styles.howList}>
                  <li className={styles.howItem}>
                    <span className={styles.howNum}>1</span>
                    <span>Generate a one-time link above</span>
                  </li>
                  <li className={styles.howItem}>
                    <span className={styles.howNum}>2</span>
                    <span>Open Telegram and confirm the connection</span>
                  </li>
                  <li className={styles.howItem}>
                    <span className={styles.howNum}>3</span>
                    <span>New alerts from push-enabled orbits are delivered to your chat</span>
                  </li>
                </ol>
                <Link href="/subscriptions" className={styles.btnGhost}>
                  Create an orbit
                </Link>
              </div>
            </section>
          </div>
        )}
      </AppShell>
    </>
  );
}
