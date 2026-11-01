import type { ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { enterDelay } from "@/components/landing/motion-style";
import styles from "./auth.module.css";

/** Hesap sayfası yapı taşları: başlık, kart, hata, bağlantılar */

interface AuthHeaderProps {
  readonly eyebrow: string;
  readonly title: ReactNode;
  readonly desc?: ReactNode;
}

/** Başlık yalnız kayar (opaklık hep 1): mobilde LCP adayı */
export function AuthHeader({ eyebrow, title, desc }: AuthHeaderProps) {
  return (
    <div className={`enter-rise ${styles.header}`} style={enterDelay(0.05)}>
      <p className="eyebrow">{eyebrow}</p>
      <h1 className={`font-display ${styles.title}`}>{title}</h1>
      {desc && <p className={styles.desc}>{desc}</p>}
    </div>
  );
}

export function AuthCard({ children }: { readonly children: ReactNode }) {
  return (
    <div className={`enter-rise ${styles.card}`} style={enterDelay(0.12)}>
      {children}
    </div>
  );
}

export function FormAlert({ children }: { readonly children: ReactNode }) {
  return (
    <div role="alert" className={styles.alert}>
      <AlertCircle size={16} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function AuthLinks({ children }: { readonly children: ReactNode }) {
  return <div className={styles.links}>{children}</div>;
}

export function BackHomeLink() {
  return (
    <p className={styles.back}>
      <Link href="/">
        <ArrowLeft size={14} aria-hidden="true" /> Ana sayfaya dön
      </Link>
    </p>
  );
}

export { styles as authStyles };
