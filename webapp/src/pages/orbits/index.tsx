import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { parseListId, getOrbitCreateLimitError } from "@orbit/shared";
import { AppShell } from "@/components/AppShell";
import { OrbitDetailsMeta } from "@/components/OrbitDetailsMeta";
import { Loading } from "@/components/Loading";
import { WalletRequiredState } from "@/components/WalletRequiredState";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/components/Toast";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import styles from "./index.module.css";
import type { Orbit, TrackSource } from "@orbit/shared";

const EMPTY_FORM = {
  source: "custom" as TrackSource,
  orbitName: "",
  topic: "",
  listInput: "",
  criteria: "",
  notifyTelegram: true,
};

export default function OrbitPage() {
  const router = useRouter();
  const { isAuthed, loading } = useSession();
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();

  const editId = typeof router.query.id === "string" ? router.query.id : null;
  const isEdit = Boolean(editId);

  const [orbits, setOrbits] = useState<Orbit[]>([]);
  const [orbitsLoading, setOrbitsLoading] = useState(true);
  const [source, setSource] = useState<TrackSource>(EMPTY_FORM.source);
  const [orbitName, setOrbitName] = useState(EMPTY_FORM.orbitName);
  const [topic, setTopic] = useState(EMPTY_FORM.topic);
  const [listInput, setListInput] = useState(EMPTY_FORM.listInput);
  const [criteria, setCriteria] = useState(EMPTY_FORM.criteria);
  const [notifyTelegram, setNotifyTelegram] = useState(EMPTY_FORM.notifyTelegram);
  const [saved, setSaved] = useState<Orbit | null>(null);
  const [busy, setBusy] = useState(false);

  const resetForm = useCallback(() => {
    setSource(EMPTY_FORM.source);
    setOrbitName(EMPTY_FORM.orbitName);
    setTopic(EMPTY_FORM.topic);
    setListInput(EMPTY_FORM.listInput);
    setCriteria(EMPTY_FORM.criteria);
    setNotifyTelegram(EMPTY_FORM.notifyTelegram);
    setSaved(null);
  }, []);

  const applyOrbit = useCallback((orbit: Orbit) => {
    setSource(orbit.source);
    setOrbitName(orbit.title);
    setTopic(orbit.topic ?? "");
    setListInput(orbit.listId ?? "");
    setCriteria(orbit.criteria);
    setNotifyTelegram(orbit.notifyTelegram);
    setSaved(orbit);
  }, []);

  const loadOrbits = useCallback(async () => {
    const res = await fetch("/api/orbits");
    const data = await res.json();
    if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to load orbits");
    return Array.isArray(data) ? (data as Orbit[]) : [];
  }, []);

  useEffect(() => {
    if (!isAuthed) {
      setOrbitsLoading(false);
      return;
    }
    setOrbitsLoading(true);
    void loadOrbits()
      .then(setOrbits)
      .catch((err) => toast((err as Error).message, "error"))
      .finally(() => setOrbitsLoading(false));
  }, [isAuthed, loadOrbits, toast]);

  useEffect(() => {
    if (!router.isReady || orbitsLoading) return;
    if (editId) {
      const orbit = orbits.find((o) => o.id === editId);
      if (orbit) {
        applyOrbit(orbit);
      } else if (orbits.length > 0 || !orbitsLoading) {
        toast("Orbit not found", "error");
        void router.replace("/orbits");
      }
    } else {
      resetForm();
    }
  }, [editId, orbits, orbitsLoading, router, applyOrbit, resetForm, toast]);

  function selectOrbit(id: string | null) {
    if (id) {
      void router.push(`/orbits?id=${id}`, undefined, { shallow: true });
    } else {
      void router.push("/orbits", undefined, { shallow: true });
    }
  }

  function selectSource(next: TrackSource) {
    if (isEdit) return;
    const limitError = getOrbitCreateLimitError(orbits, next);
    if (limitError) {
      toast(limitError, "error");
      return;
    }
    setSource(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (source === "list" && !parseListId(listInput)) {
      toast("Enter a valid X list URL or numeric list ID", "error");
      return;
    }
    if (!isEdit) {
      const limitError = getOrbitCreateLimitError(orbits, source);
      if (limitError) {
        toast(limitError, "error");
        return;
      }
    }
    setBusy(true);
    try {
      if (isEdit && editId) {
        const res = await fetch(`/api/orbits/${editId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: orbitName.trim(),
            topic: source === "custom" ? topic.trim() : undefined,
            criteria: criteria.trim(),
            listId: source === "list" ? listInput.trim() : undefined,
            notifyTelegram,
          }),
        });
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error ?? "Failed to update orbit");
        }
        const orbit = (await res.json()) as Orbit;
        setSaved(orbit);
        setOrbits((prev) => prev.map((o) => (o.id === orbit.id ? orbit : o)));
        toast("Orbit updated", "success");
      } else {
        const res = await fetch("/api/orbits", {
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
        const orbit = (await res.json()) as Orbit;
        setOrbits((prev) => [...prev, orbit]);
        toast("Orbit created", "success");
        void router.push(`/orbits?id=${orbit.id}`, undefined, { shallow: true });
      }
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function togglePause() {
    if (!saved) return;
    const res = await fetch(`/api/orbits/${saved.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paused: !saved.paused }),
    });
    if (!res.ok) {
      toast("Failed to update orbit", "error");
      return;
    }
    const orbit = (await res.json()) as Orbit;
    setSaved(orbit);
    setOrbits((prev) => prev.map((o) => (o.id === orbit.id ? orbit : o)));
    toast(orbit.paused ? "Orbit paused" : "Orbit resumed", "success");
  }

  async function remove() {
    if (!saved) return;
    const ok = await confirm({
      title: "Delete this orbit?",
      description: "This cannot be undone. Existing alerts for this orbit stay in your feed.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/orbits/${saved.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete orbit");
      setOrbits((prev) => prev.filter((o) => o.id !== saved.id));
      toast("Orbit deleted", "info");
      void router.push("/orbits");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const shellTitle = isEdit && saved ? saved.title : "Orbit";

  return (
    <>
      <Head>
        <title>{isEdit && saved ? `${saved.title.slice(0, 40)} - Orbit` : "Orbit - Orbit"}</title>
      </Head>
      <AppShell title={shellTitle}>
        {loading || orbitsLoading ? (
          <Loading />
        ) : !isAuthed ? (
          <WalletRequiredState />
        ) : (
          <div className={styles.page}>
            <section className={styles.panel} aria-labelledby="picker-heading">
              <div className={styles.panelHead}>
                <h2 id="picker-heading" className={styles.panelTitle}>
                  Your orbits
                </h2>
              </div>
              <div className={styles.panelBody}>
                <div className={styles.picker}>
                  <button
                    type="button"
                    className={!isEdit ? styles.pickerActive : styles.pickerItem}
                    onClick={() => selectOrbit(null)}
                  >
                    New orbit
                  </button>
                  {orbits.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className={editId === o.id ? styles.pickerActive : styles.pickerItem}
                      onClick={() => selectOrbit(o.id)}
                    >
                      {o.title}
                      {o.paused ? <span className={styles.pickerPaused}>Paused</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <form className={styles.form} onSubmit={submit}>
              <section className={styles.panel} aria-labelledby="source-heading">
                <div className={styles.panelHead}>
                  <h2 id="source-heading" className={styles.panelTitle}>
                    Source
                  </h2>
                  {isEdit ? (
                    <span className={styles.panelHint}>Source cannot be changed after creation</span>
                  ) : null}
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.sourceRow}>
                    <button
                      type="button"
                      className={source === "list" ? styles.sourceActive : styles.source}
                      onClick={() => selectSource("list")}
                      aria-pressed={source === "list"}
                      disabled={isEdit}
                    >
                      <span className={styles.sourceTitle}>X list</span>
                      <span className={styles.sourceHint}>Poll a curated list timeline</span>
                    </button>
                    <button
                      type="button"
                      className={source === "custom" ? styles.sourceActive : styles.source}
                      onClick={() => selectSource("custom")}
                      aria-pressed={source === "custom"}
                      disabled={isEdit}
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
                    {isEdit ? "Edit orbit" : "Create orbit"}
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
                        What Orbit searches for on X. Used to build your query - separate from the
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
                        : "Feed only - alerts appear on your dashboard"}
                    </span>
                  </label>

                  <div className={styles.formActions}>
                    {isEdit && saved ? (
                      <>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={() => void togglePause()}
                          disabled={busy}
                        >
                          {saved.paused ? "Resume" : "Pause"}
                        </button>
                        <button
                          type="button"
                          className={styles.btnDanger}
                          onClick={() => void remove()}
                          disabled={busy}
                        >
                          Delete
                        </button>
                      </>
                    ) : null}
                    <button className={styles.submit} type="submit" disabled={busy}>
                      {busy
                        ? isEdit
                          ? "Saving…"
                          : "Creating…"
                        : isEdit
                          ? "Save changes"
                          : "Create orbit"}
                    </button>
                  </div>
                </div>
              </section>
            </form>

            {saved && isEdit ? (
              <section className={styles.panel} aria-label="Orbit summary">
                <div className={styles.panelHead}>
                  <h2 className={styles.panelTitle}>Current setup</h2>
                  <Link href={`/orbits/${saved.id}`} className={styles.panelAddBtn}>
                    View feed
                  </Link>
                </div>
                <div className={styles.panelBody}>
                  <OrbitDetailsMeta orbit={saved} />
                </div>
              </section>
            ) : null}
          </div>
        )}
      </AppShell>
    </>
  );
}
