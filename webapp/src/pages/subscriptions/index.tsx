import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/components/Toast";
import { ORBIT_TEMPLATES } from "@/lib/templates";
import styles from "./index.module.css";
import type { Subscription } from "@orbit/shared";

export default function NewSubscription() {
  const { isAuthed, loading } = useSession();
  const { toast } = useToast();
  const [intent, setIntent] = useState("");
  const [watchType, setWatchType] = useState<"accounts" | "lists" | "topics">("topics");
  const [mode, setMode] = useState<"live" | "digest">("live");
  const [created, setCreated] = useState<Subscription | null>(null);
  const [busy, setBusy] = useState(false);

  function applyTemplate(templateId: string) {
    const t = ORBIT_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return;
    setIntent(t.intent);
    setWatchType(t.watchType);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent, watchType, mode }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to create orbit");
      }
      const sub = (await res.json()) as Subscription;
      setCreated(sub);
      setIntent("");
      toast("Orbit created", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>New orbit - Orbit</title>
      </Head>
      <AppShell title="Create orbit">
        {loading ? (
          <p className={styles.muted}>Loading…</p>
        ) : !isAuthed ? (
          <p className={styles.muted}>Connect your wallet from the header to get started.</p>
        ) : (
          <>
            <p className={styles.templatesLabel}>Quick start</p>
            <div className={styles.templates}>
              {ORBIT_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={styles.template}
                  onClick={() => applyTemplate(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <form className={styles.form} onSubmit={submit}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="intent">
                  What do you want to track?
                </label>
                <textarea
                  id="intent"
                  className={styles.textarea}
                  placeholder="e.g. funding rounds in African fintech"
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  required
                  rows={4}
                />
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="watchType">
                    Watch
                  </label>
                  <select
                    id="watchType"
                    className={styles.select}
                    value={watchType}
                    onChange={(e) => setWatchType(e.target.value as typeof watchType)}
                  >
                    <option value="topics">Topics</option>
                    <option value="accounts">Accounts</option>
                    <option value="lists">Lists</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="mode">
                    Mode
                  </label>
                  <select
                    id="mode"
                    className={styles.select}
                    value={mode}
                    onChange={(e) => setMode(e.target.value as typeof mode)}
                  >
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
              <div className={styles.success}>
                <p className={styles.successTitle}>Orbit created</p>
                <p className={styles.queryLabel}>AI-generated query:</p>
                <code className={styles.query}>{created.generatedQuery}</code>
                <div className={styles.successActions}>
                  <Link href={`/subscriptions/${created.id}`} className={styles.linkBtn}>
                    View orbit
                  </Link>
                  <Link href="/connect" className={styles.linkSecondary}>
                    Connect Telegram
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </AppShell>
    </>
  );
}
