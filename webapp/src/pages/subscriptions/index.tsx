import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { parseListId } from "@orbit/shared";
import { AppShell } from "@/components/AppShell";
import { Loading } from "@/components/Loading";
import { WalletRequiredState } from "@/components/WalletRequiredState";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/components/Toast";
import { ORBIT_TEMPLATES } from "@/lib/templates";
import styles from "./index.module.css";
import type { Subscription, TrackSource } from "@orbit/shared";

export default function NewSubscription() {
  const { isAuthed, loading } = useSession();
  const { toast } = useToast();
  const [source, setSource] = useState<TrackSource>("custom");
  const [title, setTitle] = useState("");
  const [criteria, setCriteria] = useState("");
  const [notifyTelegram, setNotifyTelegram] = useState(true);
  const [created, setCreated] = useState<Subscription | null>(null);
  const [busy, setBusy] = useState(false);

  function applyTemplate(templateId: string) {
    const t = ORBIT_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return;
    setSource(t.source);
    setTitle(t.title);
    setCriteria(t.criteria);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (source === "list" && !parseListId(title)) {
      toast("Enter a valid X list URL or numeric list ID", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source,
          title: title.trim(),
          criteria: criteria.trim(),
          listId: source === "list" ? title.trim() : undefined,
          notifyTelegram,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to create orbit");
      }
      const sub = (await res.json()) as Subscription;
      setCreated(sub);
      setTitle("");
      setCriteria("");
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
      <AppShell title="New orbit">
        {loading ? (
          <Loading />
        ) : !isAuthed ? (
          <WalletRequiredState />
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
              <fieldset className={styles.field}>
                <legend className={styles.label}>Source</legend>
                <div className={styles.sourceRow}>
                  <button
                    type="button"
                    className={source === "list" ? styles.sourceActive : styles.source}
                    onClick={() => setSource("list")}
                    aria-pressed={source === "list"}
                  >
                    <span className={styles.sourceTitle}>X list</span>
                    <span className={styles.sourceHint}>Poll a curated list timeline</span>
                  </button>
                  <button
                    type="button"
                    className={source === "custom" ? styles.sourceActive : styles.source}
                    onClick={() => setSource("custom")}
                    aria-pressed={source === "custom"}
                  >
                    <span className={styles.sourceTitle}>Custom topic</span>
                    <span className={styles.sourceHint}>AI-built search across X</span>
                  </button>
                </div>
              </fieldset>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="title">
                  {source === "list" ? "List URL or ID" : "Topic"}
                </label>
                <input
                  id="title"
                  className={styles.input}
                  placeholder={
                    source === "list"
                      ? "https://x.com/i/lists/1234567890"
                      : "e.g. New AI model releases"
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="criteria">
                  Criteria
                </label>
                <textarea
                  id="criteria"
                  className={styles.textarea}
                  placeholder="What should count in your feed and alerts? Be specific about signals, accounts, and exclusions."
                  value={criteria}
                  onChange={(e) => setCriteria(e.target.value)}
                  required
                  rows={4}
                />
              </div>

              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={notifyTelegram}
                  onChange={(e) => setNotifyTelegram(e.target.checked)}
                />
                <span className={styles.toggleText}>
                  <span className={styles.toggleTitle}>Push to Telegram</span>
                  <span className={styles.toggleHint}>
                    {notifyTelegram
                      ? "Matching posts also go to Telegram when linked"
                      : "Feed only - alerts appear on your dashboard"}
                  </span>
                </span>
              </label>

              <button className={styles.submit} type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create orbit"}
              </button>
            </form>

            {created && (
              <div className={styles.success}>
                <p className={styles.successTitle}>Orbit created</p>
                {created.source === "custom" && created.generatedQuery ? (
                  <>
                    <p className={styles.queryLabel}>AI-generated query:</p>
                    <code className={styles.query}>{created.generatedQuery}</code>
                  </>
                ) : (
                  <p className={styles.queryLabel}>Polling list {created.listId}</p>
                )}
                <div className={styles.successActions}>
                  <Link href={`/subscriptions/${created.id}`} className={styles.linkBtn}>
                    View orbit
                  </Link>
                  {created.notifyTelegram && (
                    <Link href="/connect" className={styles.linkSecondary}>
                      Connect Telegram
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </AppShell>
    </>
  );
}
