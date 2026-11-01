import Link from "next/link";
import { ArrowRight } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";
import PixelMorph from "@/components/brand/PixelMorph";
import DemoButton from "./DemoButton";
import { Reveal } from "./motion";
import styles from "./landing.module.css";

export default function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <Reveal className={styles.manifesto}>
        <PixelMorph animated={false} className={styles.manifestoPixels} />
        <div className={styles.manifestoBody}>
          <p className="eyebrow">Vizyon</p>
          <h2 className={`font-display ${styles.manifestoTitle}`}>
            Menünüz artık bir <em>arayüz.</em>
          </h2>
          <p className={styles.manifestoLead}>
            QR menü, masadan sipariş, garson ekranı ve yönetim paneli. Restoranınızı bugünden geleceğe taşıyın.
          </p>
          <div className={styles.manifestoActions}>
            <Link href="/auth/signup" className="btn btn-primary btn-lg">
              Hemen başlayın <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <DemoButton className="btn btn-ghost btn-lg">Demoyu deneyin</DemoButton>
          </div>
        </div>
      </Reveal>

      <div className={styles.footerBar}>
        <BrandLogo size="sm" />
        <p className={styles.footerNote}>© {new Date().getFullYear()} QR Menü Platformu</p>
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
