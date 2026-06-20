import styles from "./index.module.css";
import { displayCriteria, formatWhen } from "@/lib/subscription-display";
import type { Subscription } from "@orbit/shared";

interface Props {
  subscription: Subscription;
}

export function OrbitDetailsMeta({ subscription: sub }: Props) {
  const criteria = displayCriteria(sub);
  const showOriginalCriteria =
    Boolean(sub.upgradedCriteria?.trim()) &&
    sub.upgradedCriteria!.trim() !== sub.criteria.trim();

  return (
    <dl className={styles.meta}>
      <div className={styles.metaRow}>
        <dt>Status</dt>
        <dd>
          <span className={sub.paused ? styles.statusPaused : styles.statusActive}>
            {sub.paused ? "Paused" : "Active"}
          </span>
        </dd>
      </div>

      <div className={styles.metaRow}>
        <dt>Criteria</dt>
        <dd className={styles.metaValue}>{criteria}</dd>
      </div>

      {showOriginalCriteria ? (
        <div className={styles.metaRow}>
          <dt>Your input</dt>
          <dd className={styles.metaMuted}>{sub.criteria.trim()}</dd>
        </div>
      ) : null}

      <div className={styles.metaRow}>
        <dt>Source</dt>
        <dd>{sub.source === "list" ? "X list" : "Custom topic"}</dd>
      </div>

      {sub.source === "custom" && sub.topic ? (
        <div className={styles.metaRow}>
          <dt>Topic</dt>
          <dd>{sub.topic}</dd>
        </div>
      ) : null}

      {sub.source === "list" && sub.listId ? (
        <div className={styles.metaRow}>
          <dt>List</dt>
          <dd className={styles.metaMono}>{sub.listId}</dd>
        </div>
      ) : null}

      {sub.generatedQuery ? (
        <div className={styles.metaRow}>
          <dt>Search query</dt>
          <dd>
            <code className={styles.query}>{sub.generatedQuery}</code>
          </dd>
        </div>
      ) : null}

      <div className={styles.metaRow}>
        <dt>Alerts</dt>
        <dd>{sub.notifyTelegram ? "Telegram + dashboard" : "Dashboard only"}</dd>
      </div>

      <div className={styles.metaRow}>
        <dt>Last polled</dt>
        <dd>{formatWhen(sub.lastPolledAt)}</dd>
      </div>

      <div className={styles.metaRow}>
        <dt>Created</dt>
        <dd>{formatWhen(sub.createdAt)}</dd>
      </div>
    </dl>
  );
}
