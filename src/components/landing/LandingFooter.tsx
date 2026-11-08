import Link from "next/link";
import { ArrowRight } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";
import QrGlyph from "@/components/brand/QrGlyph";
import { SITE_NAME } from "@/lib/site";
import DemoButton from "./DemoButton";
import { Reveal } from "./motion";
import styles from "./landing.module.css";

export default function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <Reveal className={styles.manifesto}>
        <div className={styles.manifestoBody}>
          <p className={styles.manifestoEyebrow}>Hemen başlayın</p>
          <h2 className={`font-display ${styles.manifestoTitle}`}>
            Bugün kurun, <em>bu akşam</em> sipariş alın.
          </h2>
          <p className={styles.manifestoLead}>
            QR menü, masadan sipariş, garson ekranı ve yönetim paneli. Kurulum beş dakika; misafirleriniz bugün
            sipariş vermeye başlasın.
          </p>
          <div className={styles.manifestoActions}>
            <Link href="/auth/signup" className={`btn btn-lg ${styles.btnInverse}`}>
              Ücretsiz başlayın <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <DemoButton className={`btn btn-lg ${styles.btnOutlineLight}`}>Demoyu deneyin</DemoButton>
          </div>
        </div>
        <div className={styles.manifestoQr} aria-hidden="true">
          <QrGlyph />
          <span>Okut, seç, sipariş ver</span>
        </div>
      </Reveal>

      <div className={styles.footerBar}>
        <BrandLogo size="sm" />
        <p className={styles.footerNote}>
          © {new Date().getFullYear()} {SITE_NAME}
        </p>
        <ul className={styles.footerLinks}>
          <li>
            <Link href="/auth/signin">Giriş</Link>
          </li>
          <li>
            <Link href="/auth/signup">Kayıt</Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
