import type { ReactNode } from "react";
import Link from "next/link";
import BrandLogo from "@/components/brand/BrandLogo";
import QrGlyph from "@/components/brand/QrGlyph";
import type { AuthAside } from "./asides";
import styles from "./auth.module.css";

interface AuthShellProps {
  readonly aside: AuthAside;
  readonly children: ReactNode;
}

const pointCode = (i: number) => String(i + 1);

/**
 * Hesap sayfalarının ortak kabuğu: solda yeşil tahta marka paneli (≥1024px), sağda
 * form sütunu. Sunucu bileşeni; form istemci bileşeni olarak children'dan gelir.
 */
export default function AuthShell({ aside, children }: AuthShellProps) {
  return (
    <div className={`landing-theme min-h-viewport ${styles.shell}`}>
      <aside className={`board ${styles.aside}`} aria-label="QR Menü">
        <Link href="/" aria-label="QR Menü ana sayfa" className={styles.asideLogo}>
          <BrandLogo />
        </Link>

        <div className={`enter-rise ${styles.asideBody}`}>
          <p className="eyebrow">{aside.eyebrow}</p>
          <p className={`font-display ${styles.asideTitle}`}>
            {aside.title} <em>{aside.accent}</em>
          </p>
          <ul className={styles.asidePoints}>
            {aside.points.map((point, i) => (
              <li key={point}>
                <span aria-hidden="true">{pointCode(i)}</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.asideQr} aria-hidden="true">
          <QrGlyph />
        </div>
        <p className={styles.asideFoot}>© {new Date().getFullYear()} QR Menü Platformu</p>
      </aside>

      <main id="main-content" className={styles.main}>
        <div className={styles.column}>
          <Link href="/" aria-label="QR Menü ana sayfa" className={styles.mobileLogo}>
            <BrandLogo />
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
