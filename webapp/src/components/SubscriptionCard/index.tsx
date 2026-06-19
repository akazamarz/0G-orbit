import Link from "next/link";
import styles from "./index.module.css";
import type { Subscription } from "@orbit/shared";

interface Props {
  subscription: Subscription;
}

export function SubscriptionCard({ subscription }: Props) {
  return (
    <Link href={`/subscriptions/${subscription.id}`} className={styles.card}>
      <div className={styles.intent}>{subscription.intent}</div>
      <div className={styles.meta}>
        <span className={styles.badge}>{subscription.watchType}</span>
        <span className={styles.badge}>{subscription.mode}</span>
        {subscription.paused && <span className={styles.paused}>paused</span>}
      </div>
    </Link>
  );
}
