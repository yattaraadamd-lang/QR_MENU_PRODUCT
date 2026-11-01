import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import SectionHeading from "./SectionHeading";
import { RevealGroup } from "./motion";
import { revealIndex } from "./motion-style";
import { DEMO_ROLES } from "./content";
import styles from "./landing.module.css";

/** Canlı demo: üç rol, üç kapı */
export default function RoleDoors() {
  return (
    <section id="demo" aria-labelledby="demo-title" className={styles.section}>
      <div className={styles.container}>
        <SectionHeading
          id="demo-title"
          eyebrow="Canlı demo"
          title={
            <>
              Bir kapı seçin, <em>içeri girin.</em>
            </>
          }
          desc="Demo hesabıyla sistemi gerçek veriyle deneyin; kayıt gerekmez."
        />
        <RevealGroup className={styles.doors} gap={0.1}>
          {DEMO_ROLES.map((role, i) => (
            <div key={role.code} className="reveal-item" style={revealIndex(i)}>
              <Link href={role.href} prefetch={role.prefetch} className={styles.door}>
                <span className={styles.doorTop}>
                  <span>{role.code}</span>
                  <span>{role.role}</span>
                </span>
                <span className={`font-display ${styles.doorTitle}`}>{role.title}</span>
                <span className={styles.doorDesc}>{role.desc}</span>
                <span className={styles.doorCta}>
                  Deneyimle <ArrowUpRight size={16} aria-hidden="true" />
                </span>
              </Link>
            </div>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
