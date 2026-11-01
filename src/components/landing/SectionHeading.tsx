import type { ReactNode } from "react";
import { Reveal } from "./motion";
import styles from "./landing.module.css";

interface SectionHeadingProps {
  readonly id: string;
  readonly eyebrow: string;
  /** İtalik vurgu için <em> içerebilir */
  readonly title: ReactNode;
  readonly desc?: string;
  readonly className?: string;
}

export default function SectionHeading({ id, eyebrow, title, desc, className = "" }: SectionHeadingProps) {
  return (
    <Reveal className={`${styles.heading} ${className}`.trim()}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className={`font-display ${styles.headingTitle}`}>
        {title}
      </h2>
      {desc && <p className={styles.headingDesc}>{desc}</p>}
    </Reveal>
  );
}
