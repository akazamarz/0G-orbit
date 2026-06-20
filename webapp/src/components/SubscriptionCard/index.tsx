import Link from "next/link";
import styles from "./index.module.css";
import type { Subscription } from "@orbit/shared";

interface Props {
  subscription: Subscription;
}

function displayCriteria(subscription: Subscription): string {
  const upgraded = subscription.upgradedCriteria?.trim();
  if (upgraded) return upgraded;
  return subscription.criteria.trim();
}

export function SubscriptionCard({ subscription }: Props) {
  const criteria = displayCriteria(subscription);

  return (
    <Link href={`/subscriptions/${subscription.id}`} className={styles.card}>
      <div className={styles.main}>
        <div className={styles.header}>
          <span className={styles.title}>{subscription.title}</span>
          {subscription.paused && (
            <span className={`${styles.badge} ${styles.paused}`}>Paused</span>
          )}
        </div>
        <div className={styles.criteriaBlock}>
          <span className={styles.criteriaLabel}>Criteria</span>
          <p className={styles.criteriaText}>{criteria}</p>
        </div>
      </div>
    </Link>
  );
}
