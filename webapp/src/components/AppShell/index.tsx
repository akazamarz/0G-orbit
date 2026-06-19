import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import styles from "./index.module.css";

const AuthButton = dynamic(
  () => import("@/components/AuthButton").then((m) => m.AuthButton),
  { ssr: false },
);

interface Props {
  children: React.ReactNode;
}

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/subscriptions", label: "New orbit" },
  { href: "/connect", label: "Telegram" },
];

export function AppShell({ children }: Props) {
  const router = useRouter();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/dashboard" className={styles.brand}>
          <Image src="/images/orbit-logo.png" alt="Orbit" width={48} height={48} className={styles.logo} />
          <span className={styles.brandName}>Orbit</span>
        </Link>
        <nav className={styles.nav} aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={router.pathname === item.href ? styles.navActive : styles.navLink}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.headerActions}>
          <AuthButton />
        </div>
      </header>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
