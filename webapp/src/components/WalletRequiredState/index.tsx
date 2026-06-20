import styles from "./index.module.css";

export function WalletRequiredState() {
  return (
    <div className={styles.wrap}>
      <div className={styles.icon} aria-hidden>
        🛰️
      </div>
      <h3 className={styles.title}>Connect your wallet</h3>
      <p className={styles.description}>
        Click the Connect Wallet button - you&apos;ll be asked to sign once to verify ownership,
        then you&apos;re in.
      </p>
    </div>
  );
}
