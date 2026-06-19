import Head from "next/head";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { AlertList } from "@/components/AlertList";
import { EmptyState } from "@/components/EmptyState";
import { PendingAttestations } from "@/components/PendingAttestations";
import { useSession } from "@/hooks/useSession";
import styles from "./index.module.css";
import type { Subscription, Alert, PendingAttestation, EIP712Domain } from "@orbit/shared";

export default function Dashboard() {
  const { loading: sessionLoading, isAuthed } = useSession();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [pendingAtts, setPendingAtts] = useState<PendingAttestation[]>([]);
  const [domain, setDomain] = useState<EIP712Domain | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const fetchPending = useCallback(() => {
    void fetch("/api/attestations/pending")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setPendingAtts(d.pending);
          setDomain(d.domain);
        }
      });
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    setDataLoading(true);
    Promise.all([
      fetch("/api/subscriptions").then((r) => r.json()),
      fetch("/api/alerts").then((r) => r.json()),
    ])
      .then(([s, a]) => {
        setSubs(s as Subscription[]);
        setAlerts(a as Alert[]);
      })
      .finally(() => setDataLoading(false));
    fetchPending();
    const interval = setInterval(() => {
      void fetch("/api/alerts")
        .then((r) => r.json())
        .then(setAlerts);
      fetchPending();
    }, 15000);
    return () => clearInterval(interval);
  }, [isAuthed, fetchPending]);

  const pendingCount = pendingAtts.filter((p) => p.status === "pending").length;

  return (
    <>
      <Head>
        <title>Dashboard - Orbit</title>
      </Head>
      <AppShell>
        {sessionLoading ? (
          <div className={styles.loading}>Loading…</div>
        ) : !isAuthed ? (
          <EmptyState
            title="Connect your wallet"
            description="Use the Connect Wallet button in the header, then sign in with Ethereum to access your dashboard."
          />
        ) : (
          <>
            <div className={styles.top}>
              <div>
                <h1 className={styles.title}>Dashboard</h1>
                <p className={styles.subtitle}>
                  {subs.length} orbit{subs.length !== 1 ? "s" : ""} · {alerts.length} alert
                  {alerts.length !== 1 ? "s" : ""}
                  {pendingCount > 0 && ` · ${pendingCount} pending attestation${pendingCount !== 1 ? "s" : ""}`}
                </p>
              </div>
              <Link href="/subscriptions" className={styles.createBtn}>
                + New orbit
              </Link>
            </div>

            <section className={styles.section}>
              <h2 className={styles.heading}>Your orbits</h2>
              {dataLoading ? (
                <div className={styles.loading}>Loading orbits…</div>
              ) : subs.length === 0 ? (
                <EmptyState
                  title="No orbits yet"
                  description="Create your first orbit to start tracking X with AI-filtered alerts."
                  actionLabel="Create orbit"
                  actionHref="/subscriptions"
                />
              ) : (
                <div className={styles.grid}>
                  {subs.map((s) => (
                    <SubscriptionCard key={s.id} subscription={s} />
                  ))}
                </div>
              )}
            </section>

            {pendingAtts.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.heading}>Pending attestations</h2>
                <PendingAttestations pending={pendingAtts} domain={domain} onAttested={fetchPending} />
              </section>
            )}

            <section className={styles.section}>
              <h2 className={styles.heading}>Recent alerts</h2>
              {alerts.length === 0 ? (
                <EmptyState
                  title="No alerts yet"
                  description="Alerts appear when your orbits find high-signal tweets. Make sure Telegram is connected for notifications."
                  actionLabel="Connect Telegram"
                  actionHref="/connect"
                />
              ) : (
                <AlertList alerts={alerts.slice(0, 15)} />
              )}
            </section>
          </>
        )}
      </AppShell>
    </>
  );
}
