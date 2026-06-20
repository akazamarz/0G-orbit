import Head from "next/head";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { AppShell } from "@/components/AppShell";
import { FeedbackPill } from "@/components/FeedbackPill";
import { Loading } from "@/components/Loading";
import { useToast } from "@/components/Toast";
import styles from "./index.module.css";
import type { Subscription, Alert } from "@orbit/shared";

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

  return (
    <>
      <Head>
        <title>{sub.title.slice(0, 40)} - Orbit</title>
      </Head>
      <AppShell
        title={sub.title}
        subtitle={
          <div className={styles.badges}>
            <span className={styles.badge}>{sub.source === "list" ? "X list" : "Custom topic"}</span>
            <span className={styles.badge}>
              {sub.notifyTelegram ? "Telegram + feed" : "Feed only"}
            </span>
            <span className={sub.paused ? styles.paused : styles.active}>
              {sub.paused ? "Paused" : "Active"}
            </span>
          </div>
        }
        actions={
          <>
            <button type="button" className={styles.btn} onClick={() => void togglePause()}>
              {sub.paused ? "Resume" : "Pause"}
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => void remove()}>
              Delete
            </button>
          </>
        }
      >
        {sub.source === "custom" && sub.topic ? (
          <p className={styles.listMeta}>Topic: {sub.topic}</p>
        ) : null}
        <p className={styles.criteria}>{sub.criteria}</p>
        {sub.source === "custom" && sub.generatedQuery ? (
          <code className={styles.query}>{sub.generatedQuery}</code>
        ) : sub.listId ? (
          <p className={styles.listMeta}>List ID: {sub.listId}</p>
        ) : null}

        <section className={styles.alerts}>
          <h2 className={styles.heading}>Feed ({alerts.length})</h2>
          {alerts.length === 0 ? (
            <p className={styles.empty}>No matching posts yet.</p>
          ) : (
            alerts.map((a) => (
              <article key={a.id} className={styles.alert}>
                <div className={styles.alertTop}>
                  <span className={styles.score}>{Math.round(a.score)}</span>
                  <a className={styles.tweetLink} href={a.tweet.url} target="_blank" rel="noopener noreferrer">
                    @{a.tweet.author}
                  </a>
                </div>
                <p className={styles.summary}>{a.summary}</p>
                <FeedbackPill alertId={a.id} />
              </article>
            ))
          )}
        </section>
      </AppShell>
    </>
  );
}
