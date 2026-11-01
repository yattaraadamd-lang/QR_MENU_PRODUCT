import Link from "next/link";
import BrandLogo from "@/components/brand/BrandLogo";
import DemoButton from "./DemoButton";
import styles from "./landing.module.css";

const NAV_LINKS = [
  { href: "#nasil-calisir", label: "Nasıl çalışır" },
  { href: "#ozellikler", label: "Özellikler" },
  { href: "#demo", label: "Demo" },
] as const;

export default function LandingNav() {
  return (
    <nav aria-label="Ana menü" className={`enter-drop ${styles.nav}`}>
      <div className={styles.navInner}>
        <Link href="/" aria-label="QRMenü ana sayfa" className={styles.navLogo}>
          <BrandLogo />
        </Link>

        <ul className={styles.navLinks}>
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href}>{link.label}</a>
            </li>
          ))}
        </ul>

        <div className={styles.navActions}>
          {/* Gizleme sarmalayıcıda: .btn'nin display'i Tailwind'in "hidden"ını ezer */}
          <span className="hidden sm:inline-flex">
            <DemoButton className="btn btn-ghost">Demoyu deneyin</DemoButton>
          </span>
          <Link href="/auth/signin" className="btn btn-primary">
            Giriş yapın
          </Link>
        </div>
      </div>
    </nav>
  );
}
