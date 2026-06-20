import Link from "next/link";
import styles from "./index.module.css";
import type { Orbit } from "@orbit/shared";

interface Props {
  orbit: Orbit;
}

function displayCriteria(orbit: Orbit): string {
  const upgraded = orbit.upgradedCriteria?.trim();
  if (upgraded) return upgraded;
  return orbit.criteria.trim();
}

export function OrbitCard({ orbit }: Props) {
  const criteria = displayCriteria(orbit);

  return (
    <Link href={`/orbits/${orbit.id}`} className={styles.card}>
      <div className={styles.main}>
        <div className={styles.header}>
          <span className={styles.title}>{orbit.title}</span>
          {orbit.paused && (
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
