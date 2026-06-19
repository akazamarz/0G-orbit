import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import type { ReactNode } from "react";
import styles from "./index.module.css";

const AuthButton = dynamic(
  () => import("@/components/AuthButton").then((m) => m.AuthButton),
  { ssr: false },
);

interface Props {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: React.ReactNode;
}

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/subscriptions", label: "New orbit" },
  { href: "/connect", label: "Telegram" },
];

export function AppShell({ title, subtitle, actions, children }: Props) {
  const router = useRouter();

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarBrand}>
          <Link href="/dashboard" className={styles.brand}>
            <Image src="/images/orbit-logo.png" alt="" width={40} height={40} className={styles.logo} />
            <span className={styles.brandName}>Orbit</span>
          </Link>
        </div>
        <nav className={styles.nav} aria-label="Main">
          {NAV.map((item) => {
            const active =
              router.pathname === item.href ||
              (item.href !== "/dashboard" && router.pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? styles.navActive : styles.navLink}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <h1 className={styles.pageTitle}>{title}</h1>
            {subtitle ? <div className={styles.pageSubtitle}>{subtitle}</div> : null}
          </div>
          <div className={styles.headerActions}>
            {actions}
            <AuthButton />
          </div>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
