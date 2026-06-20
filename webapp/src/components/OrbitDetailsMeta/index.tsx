import styles from "./index.module.css";
import { displayCriteria, formatWhen } from "@/lib/orbit-display";
import type { Orbit } from "@orbit/shared";

interface Props {
  orbit: Orbit;
}

export function OrbitDetailsMeta({ orbit }: Props) {
  const criteria = displayCriteria(orbit);
  const showOriginalCriteria =
    Boolean(orbit.upgradedCriteria?.trim()) &&
    orbit.upgradedCriteria!.trim() !== orbit.criteria.trim();

  return (
    <dl className={styles.meta}>
      <div className={styles.metaRow}>
        <dt>Status</dt>
        <dd>
          <span className={orbit.paused ? styles.statusPaused : styles.statusActive}>
            {orbit.paused ? "Paused" : "Active"}
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
          <dd className={styles.metaMuted}>{orbit.criteria.trim()}</dd>
        </div>
      ) : null}

      <div className={styles.metaRow}>
        <dt>Source</dt>
        <dd>{orbit.source === "list" ? "X list" : "Custom topic"}</dd>
      </div>

      {orbit.source === "custom" && orbit.topic ? (
        <div className={styles.metaRow}>
          <dt>Topic</dt>
          <dd>{orbit.topic}</dd>
        </div>
      ) : null}

      {orbit.source === "list" && orbit.listId ? (
        <div className={styles.metaRow}>
          <dt>List</dt>
          <dd className={styles.metaMono}>{orbit.listId}</dd>
        </div>
      ) : null}

      {orbit.generatedQuery ? (
        <div className={styles.metaRow}>
          <dt>{orbit.source === "list" ? "List feed query" : "Search query"}</dt>
          <dd>
            <code className={styles.query}>{orbit.generatedQuery}</code>
          </dd>
        </div>
      ) : null}

      <div className={styles.metaRow}>
        <dt>Alerts</dt>
        <dd>{orbit.notifyTelegram ? "Telegram + dashboard" : "Dashboard only"}</dd>
      </div>

      <div className={styles.metaRow}>
        <dt>Last polled</dt>
        <dd>{formatWhen(orbit.lastPolledAt)}</dd>
      </div>

      <div className={styles.metaRow}>
        <dt>Created</dt>
        <dd>{formatWhen(orbit.createdAt)}</dd>
      </div>
    </dl>
  );
}
