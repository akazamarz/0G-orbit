import Head from "next/head";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { AppShell } from "@/components/AppShell";
import { FeedbackPill } from "@/components/FeedbackPill";
import { Loading } from "@/components/Loading";
import { useToast } from "@/components/Toast";
import styles from "./index.module.css";
import type { Subscription, Alert } from "@orbit/shared";

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
  const [sub, setSub] = useState<Subscription | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    if (typeof id !== "string") return;
    void fetch("/api/subscriptions")
      .then((r) => r.json())
      .then((subs: Subscription[]) => setSub(subs.find((s) => s.id === id) ?? null));
    void fetch("/api/alerts")
      .then((r) => r.json())
      .then((all: Alert[]) => setAlerts(all.filter((a) => a.subscriptionId === id)));
  }, [id]);

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
    if (!sub || !confirm("Delete this orbit? This cannot be undone.")) return;
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
              {alerts.length > 0 ? (
                <span className={styles.panelMeta}>{alerts.length} alert{alerts.length !== 1 ? "s" : ""}</span>
              ) : null}
            </div>

            <div className={styles.panelBody}>
              {alerts.length === 0 ? (
                <p className={styles.empty}>No matching posts yet. Alerts appear when posts pass your criteria.</p>
              ) : (
                <div className={styles.feed}>
                  {alerts.map((a) => (
                    <article key={a.id} className={styles.alert}>
                      <div className={styles.alertTop}>
                        <span className={styles.score}>{Math.round(a.score)}</span>
                        <a
                          className={styles.tweetLink}
                          href={a.tweet.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          @{a.tweet.author}
                        </a>
                        <time className={styles.alertTime} dateTime={new Date(a.createdAt).toISOString()}>
                          {formatWhen(a.createdAt)}
                        </time>
                      </div>
                      <p className={styles.summary}>{a.summary}</p>
                      <FeedbackPill alertId={a.id} />
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </AppShell>
    </>
  );
}
