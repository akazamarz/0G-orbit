import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { AppShell } from "@/components/AppShell";
import { AlertList } from "@/components/AlertList";
import { AlertFeedFooter } from "@/components/AlertFeedFooter";
import { Loading } from "@/components/Loading";
import { useAlertFeed } from "@/hooks/useAlertFeed";
import { OrbitDetailsMeta } from "@/components/OrbitDetailsMeta";
import styles from "./index.module.css";
import type { Orbit } from "@orbit/shared";

export default function OrbitDetail() {
  const { query } = useRouter();
  const { id } = query;
  const [orbit, setOrbit] = useState<Orbit | null>(null);
  const orbitId = typeof id === "string" ? id : undefined;

  const {
    items: alerts,
    total: alertTotal,
    hasMore: alertsHasMore,
    loading: alertsLoading,
    loadingMore: alertsLoadingMore,
    loadMore: loadMoreAlerts,
  } = useAlertFeed({
    orbitId,
    enabled: Boolean(orbitId),
    pollIntervalMs: 15_000,
  });

  useEffect(() => {
    if (!orbitId) return;
    void fetch("/api/orbits")
      .then((r) => r.json())
      .then((orbits: Orbit[]) => setOrbit(orbits.find((o) => o.id === orbitId) ?? null));
  }, [orbitId]);

  if (!orbit) {
    return (
      <AppShell title="Orbit">
        <Loading />
      </AppShell>
    );
  }

  return (
    <>
      <Head>
        <title>{orbit.title.slice(0, 40)} - Orbit</title>
      </Head>
      <AppShell title={orbit.title}>
        <div className={styles.page}>
          <section className={styles.panel} aria-labelledby="details-heading">
            <div className={styles.panelHead}>
              <h2 id="details-heading" className={styles.panelTitle}>
                Orbit details
              </h2>
              <Link href={`/orbits?id=${orbit.id}`} className={styles.panelLink}>
                Edit orbit
              </Link>
            </div>

            <div className={styles.panelBody}>
              <OrbitDetailsMeta orbit={orbit} />
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="feed-heading">
            <div className={styles.panelHead}>
              <h2 id="feed-heading" className={styles.panelTitle}>
                Signal feed
              </h2>
              {alertTotal > 0 ? (
                <span className={styles.panelMeta}>
                  {alerts.length < alertTotal
                    ? `Showing ${alerts.length} of ${alertTotal}`
                    : `${alertTotal} alert${alertTotal !== 1 ? "s" : ""}`}
                </span>
              ) : null}
            </div>

            <div className={styles.panelBody}>
              {alertsLoading ? (
                <Loading />
              ) : alerts.length === 0 ? (
                <p className={styles.empty}>No matching posts yet. Alerts appear when posts pass your criteria.</p>
              ) : (
                <>
                  <AlertList alerts={alerts} />
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
      </AppShell>
    </>
  );
}
