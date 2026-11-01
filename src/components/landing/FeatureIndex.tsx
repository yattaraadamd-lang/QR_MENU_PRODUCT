import SectionHeading from "./SectionHeading";
import { RevealGroup } from "./motion";
import { revealIndex } from "./motion-style";
import { FEATURES } from "./content";
import styles from "./landing.module.css";

/** Özellikler: fesleğen yeşili "günün menüsü" tahtası, noktalı fiyat çizgisi düzeninde */
export default function FeatureIndex() {
  return (
    <section id="ozellikler" aria-labelledby="ozellikler-title" className={`board ${styles.section} ${styles.board}`}>
      <div className={`${styles.container} ${styles.featureLayout}`}>
        <SectionHeading
          id="ozellikler-title"
          eyebrow="Özellikler"
          title={
            <>
              Menüden kasaya, <em>her şey tek platformda.</em>
            </>
          }
          desc="Restoranınızı dijitalleştirmek için gereken her parça, aynı veriyle konuşur."
          className={styles.featureHeading}
        />
        <RevealGroup className={styles.featureList} gap={0.05}>
          {FEATURES.map((feature, i) => (
            <article key={feature.code} className={`reveal-item ${styles.feature}`} style={revealIndex(i)}>
              <span className={styles.featureCode}>{feature.code}</span>
              <h3 className={`font-display ${styles.featureTitle}`}>{feature.title}</h3>
              <p className={styles.featureDesc}>{feature.desc}</p>
            </article>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
