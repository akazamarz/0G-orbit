import styles from "./index.module.css";

interface Props {
  /** full = center in viewport (Web3Provider); inline = content area */
  variant?: "full" | "inline";
}

export function Loading({ variant = "inline" }: Props) {
  return (
    <div
      className={variant === "full" ? styles.full : styles.inline}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading"
    >
      <span className={styles.spinner} aria-hidden />
    </div>
  );
}
