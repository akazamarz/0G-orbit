import Head from "next/head";
import Link from "next/link";
import styles from "./index.module.css";

export default function Home() {
  return (
    <>
      <Head>
        <title>Orbit — X intelligence, on-chain</title>
        <meta name="description" content="AI-powered X intelligence agent with decentralised storage on 0G." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.container}>
        <div className={styles.hero}>
          <h1 className={styles.title}>
            Your <span className={styles.gradient}>orbit</span> around X.
          </h1>
          <p className={styles.subtitle}>
            Subscribe to accounts, lists, or topics. AI scores the signal, briefs the noise, and alerts you on
            Telegram — all stored on 0G decentralised infrastructure.
          </p>
          <div className={styles.ctas}>
            <Link href="/dashboard" className={styles.primary}>
              Open dashboard
            </Link>
            <Link href="/connect" className={styles.secondary}>
              Connect Telegram
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
