import Head from "next/head";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { AlertList } from "@/components/AlertList";
import { Loading } from "@/components/Loading";
import { WalletRequiredState } from "@/components/WalletRequiredState";
import dynamic from "next/dynamic";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/components/Toast";
import styles from "./index.module.css";
import type { Subscription, Alert, PendingAttestation, EIP712Domain } from "@orbit/shared";

const PendingAttestations = dynamic(
  () => import("@/components/PendingAttestations").then((m) => m.PendingAttestations),
  { ssr: false },
);

export default function Dashboard() {
  const { loading: sessionLoading, isAuthed } = useSession();
  const { toast } = useToast();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [pendingAtts, setPendingAtts] = useState<PendingAttestation[]>([]);
  const [domain, setDomain] = useState<EIP712Domain | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const fetchPending = useCallback(() => {
    void fetch("/api/attestations/pending")
      .then(async (r) => {
        if (!r.ok) return null;
        return r.json() as Promise<{
          enabled: boolean;
          pending: PendingAttestation[];
          domain: EIP712Domain | null;
        }>;
      })
      .then((d) => {
        if (!d?.enabled) {
          setPendingAtts([]);
          setDomain(null);
          return;
        }
        setPendingAtts(Array.isArray(d.pending) ? d.pending : []);
        setDomain(d.domain ?? null);
      });
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    setDataLoading(true);
    Promise.all([
      fetch("/api/subscriptions").then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error((data as { error?: string }).error ?? "Failed to load orbits");
        return data;
      }),
      fetch("/api/alerts").then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error((data as { error?: string }).error ?? "Failed to load alerts");
        return data;
      }),
    ])
      .then(([s, a]) => {
        setSubs(Array.isArray(s) ? s : []);
        setAlerts(Array.isArray(a) ? a : []);
      })
      .catch((err) => {
        toast((err as Error).message, "error");
        setSubs([]);
        setAlerts([]);
      })
      .finally(() => setDataLoading(false));
    fetchPending();
    const interval = setInterval(() => {
      void fetch("/api/alerts")
        .then(async (r) => {
          if (!r.ok) return;
          const data = await r.json();
          if (Array.isArray(data)) setAlerts(data);
        });
      fetchPending();
    }, 15000);
    return () => clearInterval(interval);
  }, [isAuthed, fetchPending, toast]);

  const pendingCount = pendingAtts.filter((p) => p.status === "pending").length;
  const activeOrbits = subs.filter((s) => !s.paused).length;

  return (
    <>
      <Head>
        <title>Dashboard - Orbit</title>
      </Head>
      <AppShell title="Dashboard">
        {sessionLoading ? (
          <Loading />
        ) : !isAuthed ? (
          <WalletRequiredState />
        ) : (
          <div className={styles.dashboard}>
            <header className={styles.overview}>
              <div className={styles.metrics}>
                <div className={styles.metric}>
                  <span className={styles.metricValue}>{subs.length}</span>
                  <span className={styles.metricLabel}>
                    orbit{subs.length !== 1 ? "s" : ""}
                    {subs.length > 0 && (
                      <span className={styles.metricSub}> · {activeOrbits} active</span>
                    )}
                  </span>
                </div>
                <div className={styles.metricDivider} aria-hidden />
                <div className={styles.metric}>
                  <span className={styles.metricValue}>{alerts.length}</span>
                  <span className={styles.metricLabel}>alert{alerts.length !== 1 ? "s" : ""}</span>
                </div>
                {pendingCount > 0 && (
                  <>
                    <div className={styles.metricDivider} aria-hidden />
                    <div className={styles.metric}>
                      <span className={`${styles.metricValue} ${styles.metricWarn}`}>{pendingCount}</span>
                      <span className={styles.metricLabel}>pending</span>
                    </div>
                  </>
                )}
              </div>
              <div className={styles.overviewActions}>
                <Link href="/subscriptions" className={styles.ghostBtn}>
                  + New orbit
                </Link>
                <Link href="/connect" className={styles.ghostBtn}>
                  Alerts
                </Link>
              </div>
            </header>

            {pendingAtts.length > 0 && (
              <section className={styles.attestBanner}>
                <h2 className={styles.panelTitle}>Pending attestations</h2>
                <PendingAttestations pending={pendingAtts} domain={domain} onAttested={fetchPending} />
              </section>
            )}

            <div className={styles.columns}>
              <section className={styles.panel} aria-labelledby="orbits-heading">
                <div className={styles.panelHead}>
                  <h2 id="orbits-heading" className={styles.panelTitle}>
                    Orbits
                  </h2>
                  {subs.length > 0 && (
                    <Link href="/subscriptions" className={styles.panelAddBtn}>
                      + Add
                    </Link>
                  )}
                </div>
                <div className={styles.panelBody}>
                  {dataLoading ? (
                    <Loading />
                  ) : subs.length === 0 ? (
                    <div className={styles.panelEmpty}>
                      <span className={styles.panelEmptyIcon} aria-hidden>
                        ◯
                      </span>
                      <div className={styles.panelEmptyText}>
                        <p className={styles.panelEmptyTitle}>No orbits yet</p>
                        <p className={styles.panelEmptyDesc}>
                          Watch a list or topic - criteria decide what counts.
                        </p>
                      </div>
                      <Link
                        href="/subscriptions"
                        className={`${styles.panelEmptyAction} ${styles.panelEmptyActionPrimary}`}
                      >
                        Create orbit
                      </Link>
                    </div>
                  ) : (
                    <div className={styles.orbitList}>
                      {subs.map((s) => (
                        <SubscriptionCard key={s.id} subscription={s} />
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className={styles.panel} aria-labelledby="feed-heading">
                <div className={styles.panelHead}>
                  <h2 id="feed-heading" className={styles.panelTitle}>
                    Signal feed
                  </h2>
                  {alerts.length > 0 && (
                    <span className={styles.panelMeta}>Latest {Math.min(alerts.length, 15)}</span>
                  )}
                </div>
                <div className={styles.panelBody}>
                  {dataLoading ? (
                    <Loading />
                  ) : alerts.length === 0 ? (
                    <div className={styles.panelEmpty}>
                      <span className={styles.panelEmptyIcon} aria-hidden>
                        ···
                      </span>
                      <div className={styles.panelEmptyText}>
                        <p className={styles.panelEmptyTitle}>Quiet for now</p>
                        <p className={styles.panelEmptyDesc}>
                          Posts that pass your orbit criteria appear here. Telegram is optional.
                        </p>
                      </div>
                      <Link href="/connect" className={styles.panelEmptyAction}>
                        Set up alerts
                      </Link>
                    </div>
                  ) : (
                    <AlertList alerts={alerts.slice(0, 15)} />
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </AppShell>
    </>
  );
}
