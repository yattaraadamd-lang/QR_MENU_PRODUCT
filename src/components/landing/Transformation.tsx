import SectionHeading from "./SectionHeading";
import { RevealGroup } from "./motion";
import { revealIndex } from "@/components/ui/motion-style";
import { TRANSFORM_STEPS } from "./content";
import styles from "./landing.module.css";

/** "Nasıl çalışır": dört adım, masadan kasaya */
export default function Transformation() {
  return (
    <section id="nasil-calisir" aria-labelledby="nasil-calisir-title" className={styles.section}>
      <div className={styles.container}>
        <SectionHeading
          id="nasil-calisir-title"
          eyebrow="Nasıl çalışır"
          title={
            <>
              Masadan mutfağa, <em>dört adım.</em>
            </>
          }
          desc="Siparişten ödemeye her adım bir öncekinin verisini taşır; kimse not defterine yazmaz."
        />
        <RevealGroup className={styles.steps} gap={0.12}>
          {TRANSFORM_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
            <article key={step.code} className={`reveal-item ${styles.step}`} style={revealIndex(i)}>
              <div className={styles.stepTop}>
                <span className={styles.stepCode} aria-hidden="true">{step.code}</span>
                <span className={styles.stepIcon}>
                  <Icon size={22} aria-hidden="true" />
                </span>
              </div>
              <h3 className={`font-display ${styles.stepTitle}`}>
                {step.from} <span className={styles.stepArrow} aria-hidden="true">→</span> <em>{step.to}</em>
              </h3>
              <p className={styles.stepDesc}>{step.desc}</p>
            </article>
            );
          })}
        </RevealGroup>
      </div>
    </section>
  );
}
