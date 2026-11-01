import type { ReactNode } from "react";
import Link from "next/link";
import BrandLogo from "@/components/brand/BrandLogo";
import PixelMorph from "@/components/brand/PixelMorph";
import type { AuthAside } from "./asides";
import styles from "./auth.module.css";

interface AuthShellProps {
  readonly aside: AuthAside;
  readonly children: ReactNode;
}

const pointCode = (i: number) => `0${i + 1}`;

/**
 * Hesap sayfalarının ortak kabuğu: solda marka paneli (≥1024px), sağda form sütunu.
 * Sunucu bileşeni; form istemci bileşeni olarak children'dan gelir.
 */
export default function AuthShell({ aside, children }: AuthShellProps) {
  return (
    <div className={`landing-theme min-h-viewport ${styles.shell}`}>
      <aside className={styles.aside} aria-label="QR Menü">
        <PixelMorph animated={false} className={styles.asidePixels} />
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
