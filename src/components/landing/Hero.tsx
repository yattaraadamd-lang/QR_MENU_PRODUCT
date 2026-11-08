import Link from "next/link";
import { ArrowRight } from "lucide-react";
import DemoButton from "./DemoButton";
import HeroVisual from "./HeroVisual";
import { enterDelay } from "@/components/ui/motion-style";
import { HERO_FACTS } from "./content";
import styles from "./landing.module.css";

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroGrid}>
        {/* Giriş CSS'te (.enter-*): başlık ve paragraf LCP adayı, yalnız kayar (opaklık hep 1) */}
        <div>
          <h1 className={`enter-rise ${styles.heroTitle}`} style={enterDelay(0.08)}>
            {/* Arama için ürün adı başlığın içinde; görsel olarak etiket */}
            <span className={`eyebrow ${styles.heroEyebrow}`}>QR menü ve sipariş sistemi</span>
            <span className="font-display">
              Menünüz masada, <em>siparişiniz mutfakta.</em>
            </span>
          </h1>

          <p className={`enter-rise ${styles.heroLead}`} style={enterDelay(0.18)}>
            Misafir QR kodu okutur, fotoğraflı menüden seçer, siparişi saniyeler içinde iletir. Garson ve
            mutfak her şeyi tek ekrandan takip eder; siz ciroyu canlı görürsünüz.
          </p>

          <div className={`enter-fade ${styles.heroActions}`} style={enterDelay(0.3)}>
            <DemoButton className="btn btn-primary btn-lg">
              Demoyu başlat <ArrowRight size={18} aria-hidden="true" />
            </DemoButton>
            <Link href="/auth/signup" className="btn btn-ghost btn-lg">
              Ücretsiz başlayın
            </Link>
          </div>

          <dl className={`enter-fade ${styles.facts}`} style={enterDelay(0.42)}>
            {HERO_FACTS.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd className="font-display">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}
