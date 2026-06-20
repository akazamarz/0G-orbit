import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WalletTelegramStatus } from "@orbit/shared";
import { AppShell } from "@/components/AppShell";
import { Loading } from "@/components/Loading";
import { WalletRequiredState } from "@/components/WalletRequiredState";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/components/Toast";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import styles from "./index.module.css";

interface LinkResult {
  nonce: string;
  deeplink: string;
}

function formatProfile(status: WalletTelegramStatus): string {
  if (status.displayName && status.username) {
    return `${status.displayName} (@${status.username})`;
  }
  if (status.username) return `@${status.username}`;
  if (status.displayName) return status.displayName;
  return "Telegram account";
}

function formatLinkedAt(ts?: number): string | null {
  if (!ts) return null;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Connect() {
  const { isAuthed, loading } = useSession();
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();
  const [status, setStatus] = useState<WalletTelegramStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [link, setLink] = useState<LinkResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStatus = useCallback(async (): Promise<WalletTelegramStatus | null> => {
    const res = await fetch("/api/telegram");
    if (!res.ok) throw new Error("Failed to load alerts status");
    return (await res.json()) as WalletTelegramStatus;
  }, []);

  useEffect(() => {
    if (!isAuthed) {
      setStatusLoading(false);
      return;
    }
    let cancelled = false;
    setStatusLoading(true);
    void loadStatus()
      .then((s) => {
        if (!cancelled && s) setStatus(s);
      })
      .catch((err) => toast((err as Error).message, "error"))
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthed, loadStatus, toast]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  }

  function startPolling() {
    stopPolling();
    setPolling(true);
    let attempts = 0;
    pollRef.current = setInterval(() => {
      attempts += 1;
      void loadStatus()
        .then((s) => {
          if (!s) return;
          setStatus(s);
          if (s.linked) {
            stopPolling();
            setLink(null);
            toast("Telegram linked", "success");
          } else if (attempts >= 60) {
            stopPolling();
          }
        })
        .catch(() => {
          if (attempts >= 60) stopPolling();
        });
    }, 2000);
  }

  async function getDeeplink() {
    setBusy(true);
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      if (res.status === 409) {
        const next = await loadStatus();
        if (next) setStatus(next);
        toast("Telegram is already linked", "error");
        return;
      }
      if (!res.ok) throw new Error("Failed to generate link");
      const result = (await res.json()) as LinkResult;
      setLink(result);
      startPolling();
      toast("Telegram link generated", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function updateAlertsEnabled(alertsEnabled: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/telegram", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ alertsEnabled }),
      });
      if (!res.ok) throw new Error("Failed to update alerts");
      const next = (await res.json()) as WalletTelegramStatus;
      setStatus(next);
      toast(alertsEnabled ? "Telegram alerts enabled" : "Telegram alerts paused", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    const ok = await confirm({
      title: "Unlink Telegram?",
      description: "Push-enabled orbits will stop delivering alerts to this chat.",
      confirmLabel: "Unlink",
      tone: "danger",
    });
    if (!ok) return;  
    setBusy(true);
    try {
      const res = await fetch("/api/telegram/unlink", { method: "POST" });
      if (!res.ok) throw new Error("Failed to unlink");
      setStatus({ linked: false, alertsEnabled: true });
      setLink(null);
      stopPolling();
      toast("Telegram unlinked", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const linked = status?.linked ?? false;
  const linkedAt = formatLinkedAt(status?.linkedAt);

  return (
    <>
      <Head>
        <title>Alerts - Orbit</title>
      </Head>
      <AppShell title="Alerts">
        {loading || statusLoading ? (
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
                  <div
                    className={`${styles.step} ${linked ? styles.stepDone : link || polling ? styles.stepActive : ""}`}
                  >
                    <span className={styles.stepNum}>2</span>
                    <span className={styles.stepLabel}>
                      {linked ? "Telegram linked" : link || polling ? "Confirm in Telegram" : "Link Telegram"}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {linked && status ? (
              <section className={styles.panel} aria-labelledby="linked-heading">
                <div className={styles.panelHead}>
                  <h2 id="linked-heading" className={styles.panelTitle}>
                    Linked account
                  </h2>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.profileCard}>
                    <span className={styles.profileIcon} aria-hidden>
                      ✓
                    </span>
                    <div className={styles.profileInfo}>
                      <p className={styles.profileName}>{formatProfile(status)}</p>
                      {linkedAt && <p className={styles.profileMeta}>Linked {linkedAt}</p>}
                    </div>
                  </div>

                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      className={styles.toggleInput}
                      checked={status.alertsEnabled}
                      disabled={busy}
                      onChange={(e) => void updateAlertsEnabled(e.target.checked)}
                    />
                    <div className={styles.toggleRow}>
                      <span className={styles.toggleSwitch} aria-hidden />
                      <span className={styles.toggleTitle}>Telegram alerts</span>
                    </div>
                    <span className={styles.toggleHint}>
                      {status.alertsEnabled
                        ? "Push-enabled orbits deliver matching posts to your chat"
                        : "Alerts are muted globally — feed and dashboard still work"}
                    </span>
                  </label>

                  <button
                    type="button"
                    className={styles.btnDanger}
                    onClick={() => void unlink()}
                    disabled={busy}
                  >
                    Unlink Telegram
                  </button>
                </div>
              </section>
            ) : (
              <section className={styles.panel} aria-labelledby="link-heading">
                <div className={styles.panelHead}>
                  <h2 id="link-heading" className={styles.panelTitle}>
                    Link Telegram
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
                        {polling ? " Waiting for confirmation…" : null}
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
            )}

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
                    <span>Generate a one-time link and open it in Telegram</span>
                  </li>
                  <li className={styles.howItem}>
                    <span className={styles.howNum}>2</span>
                    <span>Confirm the connection — your wallet is linked to that chat</span>
                  </li>
                  <li className={styles.howItem}>
                    <span className={styles.howNum}>3</span>
                    <span>
                      New alerts from push-enabled orbits are delivered here. Pause all Telegram
                      alerts anytime without unlinking.
                    </span>
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
