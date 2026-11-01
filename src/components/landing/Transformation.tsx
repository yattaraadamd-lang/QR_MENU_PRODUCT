import PixelGlyph from "@/components/brand/PixelGlyph";
import SectionHeading from "./SectionHeading";
import { RevealGroup } from "./motion";
import { revealIndex } from "./motion-style";
import { TRANSFORM_STEPS } from "./content";
import styles from "./landing.module.css";

/** "Nasıl çalışır": dört dönüşüm, piksel glifi her adımda biraz daha köze döner */
export default function Transformation() {
  return (
    <section id="nasil-calisir" aria-labelledby="nasil-calisir-title" className={styles.section}>
      <div className={styles.container}>
        <SectionHeading
          id="nasil-calisir-title"
          eyebrow="Nasıl çalışır"
          title={
            <>
              Dört dönüşüm, <em>tek akış.</em>
            </>
          }
          desc="Masadan mutfağa, siparişten ödemeye: her adım bir öncekinin verisini taşır."
        />
        <RevealGroup className={styles.steps} gap={0.12}>
          {TRANSFORM_STEPS.map((step, i) => (
            <article key={step.code} className={`reveal-item ${styles.step}`} style={revealIndex(i)}>
              <div className={styles.stepTop}>
                <span className={styles.stepCode}>{step.code}</span>
                <PixelGlyph filled={step.progress} />
              </div>
              <h3 className={`font-display ${styles.stepTitle}`}>
                {step.from} <span className={styles.stepArrow} aria-hidden="true">→</span> <em>{step.to}</em>
              </h3>
              <p className={styles.stepDesc}>{step.desc}</p>
            </article>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
