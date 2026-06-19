import styles from "./index.module.css";
import type { Alert } from "@orbit/shared";

interface Props {
  alerts: Alert[];
}

export function AlertList({ alerts }: Props) {
  return (
    <div className={styles.list}>
      {alerts.map((a) => (
        <article key={a.id} className={styles.item}>
          <div className={styles.top}>
            <span className={styles.score}>{Math.round(a.score)}</span>
            <span className={styles.time}>{new Date(a.createdAt).toLocaleString()}</span>
          </div>
          <p className={styles.summary}>{a.summary}</p>
          <a className={styles.link} href={a.tweet.url} target="_blank" rel="noopener noreferrer">
            @{a.tweet.author}
          </a>
        </article>
      ))}
    </div>
  );
}
