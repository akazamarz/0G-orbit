import Head from "next/head";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import styles from "./index.module.css";
import { WalletButton } from "@/components/WalletButton";
import { PendingAttestations } from "@/components/PendingAttestations";
import type { Subscription, Alert, PendingAttestation, EIP712Domain } from "@orbit/shared";

export default function Dashboard() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [pendingAtts, setPendingAtts] = useState<PendingAttestation[]>([]);
  const [domain, setDomain] = useState<EIP712Domain | null>(null);

  useEffect(() => {
    void fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setWallet(d.wallet));
  }, []);

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
    if (!wallet) return;
    void fetch("/api/subscriptions").then((r) => r.json()).then(setSubs);
    void fetch("/api/alerts").then((r) => r.json()).then(setAlerts);
    fetchPending();
    const interval = setInterval(() => {
      void fetch("/api/alerts").then((r) => r.json()).then(setAlerts);
      fetchPending();
    }, 15000);
    return () => clearInterval(interval);
  }, [wallet, fetchPending]);

  return (
    <>
      <Head>
        <title>Dashboard — Orbit</title>
      </Head>
      <main className={styles.page}>
        <header className={styles.header}>
          <span className={styles.brand}>Orbit</span>
          <div className={styles.actions}>
            <Link href="/connect" className={styles.createBtn}>
              Connect Telegram
            </Link>
            <WalletButton onWallet={setWallet} />
          </div>
        </header>

        <section className={styles.section}>
          <h2 className={styles.heading}>Orbits</h2>
          {subs.length === 0 ? (
            <div className={styles.empty}>No orbits yet. Create one to start tracking.</div>
          ) : (
            subs.map((s) => (
              <Link key={s.id} href={`/subscriptions/${s.id}`}>
                {s.intent.slice(0, 60)}
              </Link>
            ))
          )}
        </section>

        {pendingAtts.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.heading}>Pending Attestations</h2>
            <PendingAttestations pending={pendingAtts} domain={domain} onAttested={fetchPending} />
          </section>
        )}

        <section className={styles.section}>
          <h2 className={styles.heading}>Recent alerts</h2>
          {alerts.length === 0 ? (
            <div className={styles.empty}>No alerts yet.</div>
          ) : (
            alerts.slice(0, 10).map((a) => (
              <article key={a.id}>
                <strong>{Math.round(a.score)}</strong> — {a.summary}
              </article>
            ))
          )}
        </section>
      </main>
    </>
  );
}
