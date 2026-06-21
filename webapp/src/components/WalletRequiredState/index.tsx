import { ZG_CHAIN } from "@orbit/shared";
import { OrbitLogo } from "@/components/OrbitLogo";
import styles from "./index.module.css";

export function WalletRequiredState() {
  return (
    <div className={styles.wrap}>
      {/* 🛰️ */}
      <div className={styles.icon}>
        <OrbitLogo size="lg" />
      </div>
      <h3 className={styles.title}>Connect your wallet</h3>
      <p className={styles.description}>
        Orbit runs on {ZG_CHAIN.name}. Connect your wallet - you&apos;ll be prompted to switch
        network if needed, then sign to verify ownership. If sign-in fails, you can connect a
        different wallet.
      </p>
    </div>
  );
}
