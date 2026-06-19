import Head from "next/head";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { AlertList } from "@/components/AlertList";
import { EmptyState } from "@/components/EmptyState";
import dynamic from "next/dynamic";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/components/Toast";
import styles from "./index.module.css";
import type { Subscription, Alert, PendingAttestation, EIP712Domain } from "@orbit/shared";

const PendingAttestations = dynamic(
  () => import("@/components/PendingAttestations").then((m) => m.PendingAttestations),
  { ssr: false },
);

export default function Dashboard() {
  const { loading: sessionLoading, isAuthed } = useSession();
  const { toast } = useToast();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [pendingAtts, setPendingAtts] = useState<PendingAttestation[]>([]);
  const [domain, setDomain] = useState<EIP712Domain | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const fetchPending = useCallback(() => {
    void fetch("/api/attestations/pending")
      .then(async (r) => {
        if (!r.ok) return null;
        return r.json() as Promise<{
          enabled: boolean;
          pending: PendingAttestation[];
          domain: EIP712Domain | null;
        }>;
      })
      .then((d) => {
        if (!d?.enabled) {
          setPendingAtts([]);
          setDomain(null);
          return;
        }
        setPendingAtts(Array.isArray(d.pending) ? d.pending : []);
        setDomain(d.domain ?? null);
      });
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    setDataLoading(true);
    Promise.all([
      fetch("/api/subscriptions").then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error((data as { error?: string }).error ?? "Failed to load orbits");
        return data;
      }),
      fetch("/api/alerts").then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error((data as { error?: string }).error ?? "Failed to load alerts");
        return data;
      }),
    ])
      .then(([s, a]) => {
        setSubs(Array.isArray(s) ? s : []);
        setAlerts(Array.isArray(a) ? a : []);
      })
      .catch((err) => {
        toast((err as Error).message, "error");
        setSubs([]);
        setAlerts([]);
      })
      .finally(() => setDataLoading(false));
    fetchPending();
    const interval = setInterval(() => {
      void fetch("/api/alerts")
        .then(async (r) => {
          if (!r.ok) return;
          const data = await r.json();
          if (Array.isArray(data)) setAlerts(data);
        });
      fetchPending();
    }, 15000);
    return () => clearInterval(interval);
  }, [isAuthed, fetchPending, toast]);

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
