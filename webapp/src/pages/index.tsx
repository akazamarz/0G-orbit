import Head from "next/head";
import Link from "next/link";
import { OrbitLogo } from "@/components/OrbitLogo";
import styles from "./index.module.css";

const STEPS = [
  {
    title: "Define your orbit",
    desc: "Describe what to watch - a topic, keyword, or X list - in plain English.",
  },
  {
    title: "AI filters the noise",
    desc: "Every match is scored for relevance. Only the signal gets through.",
  },
  {
    title: "Get alerted on 0G",
    desc: "Live Telegram alerts plus a dashboard feed. Orbits and alerts persist on 0G Storage; attest in one signature on 0G Chain.",
  },
];

export default function Home() {
  return (
    <>
      <Head>
        <title>Orbit - X intelligence on 0G</title>
        <meta
          name="description"
          content="AI-powered X monitoring with Telegram alerts, 0G Storage, and on-chain attestation on Galileo testnet."
        />
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
            Track lists and topics in plain English. AI scores what matters, delivers sharp alerts on
            Telegram, and anchors every orbit and alert on 0G Storage - with optional on-chain proof on 0G
            Chain.
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
