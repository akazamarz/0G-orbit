import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import styles from "./index.module.css";
import type { Subscription } from "@orbit/shared";

export default function NewSubscription() {
  const [intent, setIntent] = useState("");
  const [watchType, setWatchType] = useState<"accounts" | "lists" | "topics">("topics");
  const [mode, setMode] = useState<"live" | "digest">("live");
  const [created, setCreated] = useState<Subscription | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent, watchType, mode }),
      });
      const sub = (await res.json()) as Subscription;
      setCreated(sub);
      setIntent("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>New orbit — Orbit</title>
      </Head>
      <main className={styles.page}>
        <Link href="/dashboard" className={styles.back}>
          ← Dashboard
        </Link>
        <h1>Create orbit</h1>
        <form className={styles.form} onSubmit={submit}>
          <div className={styles.field}>
            <label className={styles.label}>What do you want to track?</label>
            <textarea
              className={styles.textarea}
              placeholder="e.g. funding rounds in African fintech"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              required
            />
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Watch</label>
              <select className={styles.select} value={watchType} onChange={(e) => setWatchType(e.target.value as typeof watchType)}>
                <option value="topics">Topics</option>
                <option value="accounts">Accounts</option>
                <option value="lists">Lists</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Mode</label>
              <select className={styles.select} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
                <option value="live">Live alerts</option>
                <option value="digest">Daily digest</option>
              </select>
            </div>
          </div>
          <button className={styles.submit} type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create orbit"}
          </button>
        </form>
        {created && (
          <p>
            Created. AI query: <code>{created.generatedQuery}</code>
          </p>
        )}
      </main>
    </>
  );
}
