import Head from "next/head";
import Link from "next/link";
import { OrbitLogo } from "@/components/OrbitLogo";
import styles from "./index.module.css";

const STEPS = [
  { title: "Define your orbit", desc: "Describe what you want to track in plain English." },
  { title: "AI filters the noise", desc: "DeepSeek scores tweets and writes briefings." },
  { title: "Get alerted", desc: "Live signals or daily digests on Telegram, stored on 0G." },
];

export default function Home() {
  return (
    <>
      <Head>
        <title>Orbit - X intelligence, on-chain</title>
        <meta name="description" content="AI-powered X intelligence agent with decentralised storage on 0G." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className={styles.page}>
        <div className={styles.bg} aria-hidden />
        <header className={styles.topBar}>
          <div className={styles.brand}>
            <OrbitLogo size="lg" />
            <span>Orbit</span>
          </div>
          <Link href="/dashboard" className={styles.topCta}>
            Launch app
          </Link>
        </header>

        <section className={styles.hero}>
          <h1 className={styles.title}>
            Your <span className={styles.gradient}>orbit</span> around X.
          </h1>
          <p className={styles.subtitle}>
            Subscribe to accounts, lists, or topics. AI scores the signal, briefs the noise, and alerts you on
            Telegram - anchored on 0G decentralised infrastructure.
          </p>
          <div className={styles.ctas}>
            <Link href="/dashboard" className={styles.primary}>
              Open dashboard
            </Link>
            <Link href="/connect" className={styles.secondary}>
              Connect Telegram
            </Link>
          </div>
        </section>

        <section className={styles.steps}>
          {STEPS.map((step, i) => (
            <article key={step.title} className={styles.step}>
              <span className={styles.stepNum}>0{i + 1}</span>
              <div className={styles.stepContent}>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
