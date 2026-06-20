import Head from "next/head";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { AppShell } from "@/components/AppShell";
import { AlertList } from "@/components/AlertList";
import { AlertFeedFooter } from "@/components/AlertFeedFooter";
import { Loading } from "@/components/Loading";
import { useToast } from "@/components/Toast";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { useAlertFeed } from "@/hooks/useAlertFeed";
import styles from "./index.module.css";
import type { Subscription } from "@orbit/shared";

function displayCriteria(sub: Subscription): string {
  const upgraded = sub.upgradedCriteria?.trim();
  if (upgraded) return upgraded;
  return sub.criteria.trim();
}

function formatWhen(ts?: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function SubscriptionDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();
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
    void fetch("/api/subscriptions")
      .then((r) => r.json())
      .then((subs: Subscription[]) => setSub(subs.find((s) => s.id === orbitId) ?? null));
  }, [orbitId]);

  async function togglePause() {
    if (!sub) return;
    const res = await fetch(`/api/subscriptions/${sub.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paused: !sub.paused }),
    });
    if (!res.ok) {
      toast("Failed to update orbit", "error");
      return;
    }
    setSub({ ...sub, paused: !sub.paused });
    toast(sub.paused ? "Orbit resumed" : "Orbit paused", "success");
  }

  async function remove() {
    if (!sub) return;
    const ok = await confirm({
      title: "Delete this orbit?",
      description: "This cannot be undone. Existing alerts for this orbit stay in your feed.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/subscriptions/${sub.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Failed to delete orbit", "error");
      return;
    }
    toast("Orbit deleted", "info");
    void router.push("/dashboard");
  }

  if (!sub) {
    return (
      <AppShell title="Orbit">
        <Loading />
      </AppShell>
    );
  }

  const criteria = displayCriteria(sub);
  const showOriginalCriteria =
    Boolean(sub.upgradedCriteria?.trim()) &&
    sub.upgradedCriteria!.trim() !== sub.criteria.trim();

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
              <div className={styles.panelActions}>
                <button type="button" className={styles.btn} onClick={() => void togglePause()}>
                  {sub.paused ? "Resume" : "Pause"}
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnDanger}`}
                  onClick={() => void remove()}
                >
                  Delete
                </button>
              </div>
            </div>

            <div className={styles.panelBody}>
              <dl className={styles.meta}>
                <div className={styles.metaRow}>
                  <dt>Status</dt>
                  <dd>
                    <span className={sub.paused ? styles.statusPaused : styles.statusActive}>
                      {sub.paused ? "Paused" : "Active"}
                    </span>
                  </dd>
                </div>

                <div className={styles.metaRow}>
                  <dt>Criteria</dt>
                  <dd className={styles.metaValue}>{criteria}</dd>
                </div>

                {showOriginalCriteria ? (
                  <div className={styles.metaRow}>
                    <dt>Your input</dt>
                    <dd className={styles.metaMuted}>{sub.criteria.trim()}</dd>
                  </div>
                ) : null}

                <div className={styles.metaRow}>
                  <dt>Source</dt>
                  <dd>{sub.source === "list" ? "X list" : "Custom topic"}</dd>
                </div>

                {sub.source === "custom" && sub.topic ? (
                  <div className={styles.metaRow}>
                    <dt>Topic</dt>
                    <dd>{sub.topic}</dd>
                  </div>
                ) : null}

                {sub.source === "list" && sub.listId ? (
                  <div className={styles.metaRow}>
                    <dt>List</dt>
                    <dd className={styles.metaMono}>{sub.listId}</dd>
                  </div>
                ) : null}

                {sub.generatedQuery ? (
                  <div className={styles.metaRow}>
                    <dt>Search query</dt>
                    <dd>
                      <code className={styles.query}>{sub.generatedQuery}</code>
                    </dd>
                  </div>
                ) : null}

                <div className={styles.metaRow}>
                  <dt>Alerts</dt>
                  <dd>{sub.notifyTelegram ? "Telegram + dashboard" : "Dashboard only"}</dd>
                </div>

                <div className={styles.metaRow}>
                  <dt>Last polled</dt>
                  <dd>{formatWhen(sub.lastPolledAt)}</dd>
                </div>

                <div className={styles.metaRow}>
                  <dt>Created</dt>
                  <dd>{formatWhen(sub.createdAt)}</dd>
                </div>
              </dl>
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
