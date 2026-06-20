import Link from "next/link";
import { FeedbackPill } from "@/components/FeedbackPill";
import styles from "./index.module.css";
import type { Alert } from "@orbit/shared";

interface Props {
  alerts: Alert[];
  /** orbitId → display title; when set, each card shows its orbit name */
  orbitTitles?: Record<string, string>;
}

function formatWhen(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AlertList({ alerts, orbitTitles }: Props) {
  return (
    <div className={styles.list}>
      {alerts.map((a) => {
        const orbitTitle = orbitTitles?.[a.orbitId];
        return (
          <article key={a.id} className={styles.alert}>
            {orbitTitle ? (
              <Link href={`/orbits/${a.orbitId}`} className={styles.orbitTitle}>
                {orbitTitle}
              </Link>
            ) : null}
            <div className={styles.alertTop}>
              <span className={styles.score}>{Math.round(a.score)}</span>
              <a
                className={styles.tweetLink}
                href={a.tweet.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                @{a.tweet.author}
              </a>
              <time className={styles.alertTime} dateTime={new Date(a.createdAt).toISOString()}>
                {formatWhen(a.createdAt)}
              </time>
            </div>
            <p className={styles.summary}>{a.summary}</p>
            <FeedbackPill alertId={a.id} />
          </article>
        );
      })}
    </div>
  );
}
