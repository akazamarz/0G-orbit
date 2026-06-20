import styles from "./index.module.css";

interface Props {
  label?: string;
  /** full = center in viewport (Web3Provider); inline = content area */
  variant?: "full" | "inline";
}

export function Loading({ label = "Loading…", variant = "inline" }: Props) {
  return (
    <div
      className={variant === "full" ? styles.full : styles.inline}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className={styles.spinner} aria-hidden />
      <span className={styles.label}>{label}</span>
    </div>
  );
}
