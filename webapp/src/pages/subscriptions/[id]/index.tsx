import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import styles from "./index.module.css";
import { FeedbackPill } from "@/components/FeedbackPill";
import type { Subscription, Alert } from "@orbit/shared";

export default function SubscriptionDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [sub, setSub] = useState<Subscription | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    if (typeof id !== "string") return;
    void fetch("/api/subscriptions").then((r) => r.json()).then((subs: Subscription[]) => {
      setSub(subs.find((s) => s.id === id) ?? null);
    });
    void fetch(`/api/alerts`).then((r) => r.json()).then((all: Alert[]) => {
      setAlerts(all.filter((a) => a.subscriptionId === id));
    });
  }, [id]);

  async function togglePause() {
    if (!sub) return;
    await fetch(`/api/subscriptions/${sub.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paused: !sub.paused }),
    });
    setSub({ ...sub, paused: !sub.paused });
  }

  async function remove() {
    if (!sub) return;
    await fetch(`/api/subscriptions/${sub.id}`, { method: "DELETE" });
    void router.push("/dashboard");
  }

  if (!sub) return <main className={styles.page}>Loading…</main>;

  return (
    <>
      <Head>
        <title>{sub.intent.slice(0, 40)} — Orbit</title>
      </Head>
      <main className={styles.page}>
        <Link href="/dashboard" className={styles.back}>
          ← Dashboard
        </Link>
        <header className={styles.header}>
          <h1>{sub.intent}</h1>
          <p className={styles.intent}>
            {sub.watchType} · {sub.mode} · {sub.paused ? "paused" : "active"}
          </p>
          <div className={styles.query}>{sub.generatedQuery}</div>
        </header>
        <div className={styles.controls}>
          <button className={styles.btn} onClick={togglePause}>
            {sub.paused ? "Resume" : "Pause"}
          </button>
          <button className={`${styles.btn} ${styles.btnDanger}`} onClick={remove}>
            Delete
          </button>
        </div>
        <div className={styles.alerts}>
          {alerts.map((a) => (
            <article key={a.id} className={styles.alert}>
              <span className={styles.score}>{Math.round(a.score)}</span>
              <p className={styles.summary}>{a.summary}</p>
              <FeedbackPill alertId={a.id} />
            </article>
          ))}
        </div>
      </main>
    </>
  );
}
