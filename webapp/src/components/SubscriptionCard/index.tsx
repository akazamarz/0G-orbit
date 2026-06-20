import Link from "next/link";
import styles from "./index.module.css";
import type { Subscription } from "@orbit/shared";

interface Props {
  subscription: Subscription;
}

function sourceLabel(source: Subscription["source"]): string {
  return source === "list" ? "list" : "topic";
}

export function SubscriptionCard({ subscription }: Props) {
  return (
    <Link href={`/subscriptions/${subscription.id}`} className={styles.card}>
      <div className={styles.title}>{subscription.title}</div>
      <div className={styles.meta}>
        <span className={styles.badge}>{sourceLabel(subscription.source)}</span>
        <span className={styles.badge}>
          {subscription.notifyTelegram ? "telegram" : "feed only"}
        </span>
        {subscription.paused && <span className={styles.paused}>paused</span>}
      </div>
    </Link>
  );
}
