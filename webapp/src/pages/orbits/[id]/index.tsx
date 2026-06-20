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
import type { Subscription } from "@orbit/shared";

export default function SubscriptionDetail() {
  const { query } = useRouter();
  const { id } = query;
  const [sub, setSub] = useState<Subscription | null>(null);
  const orbitId = typeof id === "string" ? id : undefined;

  const {
    items: alerts,
    total: alertTotal,
    hasMore: alertsHasMore,
    loading: alertsLoading,
    loadingMore: alertsLoadingMore,
    loadMore: loadMoreAlerts,
  } = useAlertFeed({
    subscriptionId: orbitId,
    enabled: Boolean(orbitId),
    pollIntervalMs: 15_000,
  });

  useEffect(() => {
    if (!orbitId) return;
    void fetch("/api/orbits")
      .then((r) => r.json())
      .then((subs: Subscription[]) => setSub(subs.find((s) => s.id === orbitId) ?? null));
  }, [orbitId]);

  if (!sub) {
    return (
      <AppShell title="Orbit">
        <Loading />
      </AppShell>
    );
  }

  return (
    <>
      <Head>
        <title>{sub.title.slice(0, 40)} - Orbit</title>
      </Head>
      <AppShell title={sub.title}>
        <div className={styles.page}>
          <section className={styles.panel} aria-labelledby="details-heading">
            <div className={styles.panelHead}>
              <h2 id="details-heading" className={styles.panelTitle}>
                Orbit details
              </h2>
              <Link href={`/orbits?id=${sub.id}`} className={styles.panelLink}>
                Edit orbit
              </Link>
            </div>

            <div className={styles.panelBody}>
              <OrbitDetailsMeta subscription={sub} />
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
