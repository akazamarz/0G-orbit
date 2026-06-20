import Head from "next/head";
import Link from "next/link";
import { useEffect, useState, useCallback, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { OrbitCard } from "@/components/OrbitCard";
import { AlertList } from "@/components/AlertList";
import { AlertFeedFooter } from "@/components/AlertFeedFooter";
import { Loading } from "@/components/Loading";
import { WalletRequiredState } from "@/components/WalletRequiredState";
import dynamic from "next/dynamic";
import { useSession } from "@/hooks/useSession";
import { useAlertFeed } from "@/hooks/useAlertFeed";
import { useToast } from "@/components/Toast";
import styles from "./index.module.css";
import type { Orbit, AttestationStatusResponse } from "@orbit/shared";

const PendingAttestations = dynamic(
  () => import("@/components/PendingAttestations").then((m) => m.PendingAttestations),
  { ssr: false },
);

export default function Dashboard() {
  const { loading: sessionLoading, isAuthed } = useSession();
  const { toast } = useToast();
  const [orbits, setOrbits] = useState<Orbit[]>([]);
  const [attestationStatus, setAttestationStatus] = useState<AttestationStatusResponse | null>(null);
  const [subsLoading, setSubsLoading] = useState(false);

  const {
    items: alerts,
    total: alertTotal,
    hasMore: alertsHasMore,
    loading: alertsLoading,
    loadingMore: alertsLoadingMore,
    loadMore: loadMoreAlerts,
  } = useAlertFeed({
    enabled: isAuthed,
    pollIntervalMs: 15_000,
  });

  const fetchAttestationStatus = useCallback(() => {
    void fetch("/api/attestations/status")
      .then(async (r) => {
        if (!r.ok) return null;
        return r.json() as Promise<AttestationStatusResponse>;
      })
      .then((d) => {
        if (!d?.enabled) {
          setAttestationStatus(null);
          return;
        }
        setAttestationStatus(d);
      });
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    setSubsLoading(true);
    void fetch("/api/orbits")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error((data as { error?: string }).error ?? "Failed to load orbits");
        return data;
      })
      .then((s) => setOrbits(Array.isArray(s) ? s : []))
      .catch((err) => {
        toast((err as Error).message, "error");
        setOrbits([]);
      })
      .finally(() => setSubsLoading(false));
    fetchAttestationStatus();
    const interval = setInterval(() => fetchAttestationStatus(), 15_000);
    return () => clearInterval(interval);
  }, [isAuthed, fetchAttestationStatus, toast]);

  const attestableCount = attestationStatus?.unattestedCount ?? 0;
  const showAttestationPanel =
    Boolean(attestationStatus?.enabled) &&
    (attestableCount > 0 || attestationStatus?.pendingBatch?.status === "pending");
  const activeOrbits = orbits.filter((o) => !o.paused).length;
  const orbitTitles = useMemo(
    () => Object.fromEntries(orbits.map((o) => [o.id, o.title])),
    [orbits],
  );

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
                  <span className={styles.metricValue}>{orbits.length}</span>
                  <span className={styles.metricLabel}>
                    orbit{orbits.length !== 1 ? "s" : ""}
                    {orbits.length > 0 && (
                      <span className={styles.metricSub}> · {activeOrbits} active</span>
                    )}
                  </span>
                </div>
                <div className={styles.metricDivider} aria-hidden />
                <div className={styles.metric}>
                  <span className={styles.metricValue}>{alertTotal}</span>
                  <span className={styles.metricLabel}>alert{alertTotal !== 1 ? "s" : ""}</span>
                </div>
                {attestableCount > 0 && (
                  <>
                    <div className={styles.metricDivider} aria-hidden />
                    <div className={styles.metric}>
                      <span className={`${styles.metricValue} ${styles.metricWarn}`}>{attestableCount}</span>
                      <span className={styles.metricLabel}>to attest</span>
                    </div>
                  </>
                )}
              </div>
              <div className={styles.overviewActions}>
                <Link href="/orbits" className={styles.ghostBtn}>
                  Orbit
                </Link>
                <Link href="/connect" className={styles.ghostBtn}>
                  Alerts
                </Link>
              </div>
            </header>

            {showAttestationPanel && attestationStatus ? (
              <section className={styles.panel} aria-labelledby="attest-heading">
                <div className={styles.panelHead}>
                  <h2 id="attest-heading" className={styles.panelTitle}>
                    On-chain attestations
                  </h2>
                  <span className={styles.panelMeta}>
                    {attestationStatus.pendingBatch?.status === "pending"
                      ? "ready to sign"
                      : `${attestableCount} in batch`}
                  </span>
                </div>
                <div className={styles.panelBody}>
                  <PendingAttestations
                    status={attestationStatus}
                    onRefresh={fetchAttestationStatus}
                  />
                </div>
              </section>
            ) : null}

            <div className={styles.columns}>
              <section className={styles.panel} aria-labelledby="orbits-heading">
                <div className={styles.panelHead}>
                  <h2 id="orbits-heading" className={styles.panelTitle}>
                    Orbits
                  </h2>
                  {orbits.length > 0 && (
                    <Link href="/orbits" className={styles.panelAddBtn}>
                      + Orbit
                    </Link>
                  )}
                </div>
                <div className={styles.panelBody}>
                  {subsLoading ? (
                    <Loading />
                  ) : orbits.length === 0 ? (
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
                        href="/orbits"
                        className={`${styles.panelEmptyAction} ${styles.panelEmptyActionPrimary}`}
                      >
                        Create orbit
                      </Link>
                    </div>
                  ) : (
                    <div className={styles.orbitList}>
                      {orbits.map((o) => (
                        <OrbitCard key={o.id} orbit={o} />
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
                  {alertTotal > 0 && (
                    <span className={styles.panelMeta}>
                      {alerts.length < alertTotal
                        ? `Showing ${alerts.length} of ${alertTotal}`
                        : `${alertTotal} alert${alertTotal !== 1 ? "s" : ""}`}
                    </span>
                  )}
                </div>
                <div className={styles.panelBody}>
                  {alertsLoading ? (
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
                    <>
                      <AlertList alerts={alerts} orbitTitles={orbitTitles} />
                      <AlertFeedFooter
                        hasMore={alertsHasMore}
                        loadingMore={alertsLoadingMore}
                        onLoadMore={() => void loadMoreAlerts()}
                      />
                    </>
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
