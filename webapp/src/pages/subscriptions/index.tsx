import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { parseListId } from "@orbit/shared";
import { AppShell } from "@/components/AppShell";
import { Loading } from "@/components/Loading";
import { WalletRequiredState } from "@/components/WalletRequiredState";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/components/Toast";
import styles from "./index.module.css";
import type { Subscription, TrackSource } from "@orbit/shared";

export default function NewSubscription() {
  const { isAuthed, loading } = useSession();
  const { toast } = useToast();
  const [source, setSource] = useState<TrackSource>("custom");
  const [orbitName, setOrbitName] = useState("");
  const [topic, setTopic] = useState("");
  const [listInput, setListInput] = useState("");
  const [criteria, setCriteria] = useState("");
  const [notifyTelegram, setNotifyTelegram] = useState(true);
  const [created, setCreated] = useState<Subscription | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (source === "list" && !parseListId(listInput)) {
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
          title: orbitName.trim(),
          topic: source === "custom" ? topic.trim() : undefined,
          criteria: criteria.trim(),
          listId: source === "list" ? listInput.trim() : undefined,
          notifyTelegram,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to create orbit");
      }
      const sub = (await res.json()) as Subscription;
      setCreated(sub);
      setOrbitName("");
      setTopic("");
      setListInput("");
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
          <div className={styles.page}>
            <form className={styles.form} onSubmit={submit}>
              <section className={styles.panel} aria-labelledby="source-heading">
                <div className={styles.panelHead}>
                  <h2 id="source-heading" className={styles.panelTitle}>
                    Source
                  </h2>
                </div>
                <div className={styles.panelBody}>
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
                </div>
              </section>

              <section className={styles.panel} aria-labelledby="details-heading">
                <div className={styles.panelHead}>
                  <h2 id="details-heading" className={styles.panelTitle}>
                    Details
                  </h2>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="orbit-name">
                      Orbit name
                    </label>
                    <input
                      id="orbit-name"
                      className={styles.input}
                      placeholder="e.g. AI releases watch"
                      value={orbitName}
                      onChange={(e) => setOrbitName(e.target.value)}
                      required
                    />
                    <span className={styles.fieldHint}>
                      Shown on your dashboard and in Telegram when you pause or get alerts.
                    </span>
                  </div>

                  {source === "list" ? (
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="list-input">
                        List URL or ID
                      </label>
                      <input
                        id="list-input"
                        className={styles.input}
                        placeholder="https://x.com/i/lists/1234567890"
                        value={listInput}
                        onChange={(e) => setListInput(e.target.value)}
                        required
                      />
                    </div>
                  ) : (
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="topic">
                        Topic
                      </label>
                      <input
                        id="topic"
                        className={styles.input}
                        placeholder="e.g. New AI model releases"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        required
                      />
                      <span className={styles.fieldHint}>
                        What Orbit searches for on X. Used to build your query — separate from the
                        display name.
                      </span>
                    </div>
                  )}

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
                      className={styles.toggleInput}
                      checked={notifyTelegram}
                      onChange={(e) => setNotifyTelegram(e.target.checked)}
                    />
                    <div className={styles.toggleRow}>
                      <span className={styles.toggleSwitch} aria-hidden />
                      <span className={styles.toggleTitle}>Push to Telegram</span>
                    </div>
                    <span className={styles.toggleHint}>
                      {notifyTelegram
                        ? "Matching posts also go to Telegram when linked"
                        : "Feed only — alerts appear on your dashboard"}
                    </span>
                  </label>

                  <button className={styles.submit} type="submit" disabled={busy}>
                    {busy ? "Creating…" : "Create orbit"}
                  </button>
                </div>
              </section>
            </form>

            {created && (
              <section className={styles.panel} aria-label="Orbit created">
                <div className={styles.panelHead}>
                  <h2 className={styles.panelTitle}>Orbit created</h2>
                </div>
                <div className={styles.panelBody}>
                  <p className={styles.createdName}>
                    <strong>{created.title}</strong> is live.
                  </p>
                  {created.source === "custom" && created.generatedQuery ? (
                    <>
                      <p className={styles.queryLabel}>AI-generated query</p>
                      <code className={styles.query}>{created.generatedQuery}</code>
                    </>
                  ) : (
                    <p className={styles.queryLabel}>Polling list {created.listId}</p>
                  )}
                  <div className={styles.successActions}>
                    <Link href={`/subscriptions/${created.id}`} className={styles.btnPrimary}>
                      View orbit
                    </Link>
                    {created.notifyTelegram && (
                      <Link href="/connect" className={styles.btnGhost}>
                        Set up alerts
                      </Link>
                    )}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </AppShell>
    </>
  );
}
