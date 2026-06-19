import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./index.module.css";

interface LinkResult {
  nonce: string;
  deeplink: string;
}

export default function Connect() {
  const [authed, setAuthed] = useState(false);
  const [link, setLink] = useState<LinkResult | null>(null);

  useEffect(() => {
    void fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAuthed(true));
  }, []);

  async function getDeeplink() {
    const res = await fetch("/api/telegram/link", { method: "POST" });
    setLink((await res.json()) as LinkResult);
  }

  return (
    <>
      <Head>
        <title>Connect Telegram — Orbit</title>
      </Head>
      <main className={styles.page}>
        <Link href="/dashboard" className={styles.back}>
          ← Dashboard
        </Link>
        <div className={styles.card}>
          <h1>Connect Telegram</h1>
          {!authed ? (
            <p className={styles.muted}>Sign in with your wallet first.</p>
          ) : (
            <>
              <p>Link your Telegram to receive orbit alerts.</p>
              <button onClick={getDeeplink}>Generate link</button>
              {link && (
                <a className={styles.deeplink} href={link.deeplink} target="_blank" rel="noopener noreferrer">
                  Open Telegram
                </a>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
