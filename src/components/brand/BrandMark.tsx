import styles from "./brand.module.css";

interface BrandMarkProps {
  readonly size?: number;
  readonly className?: string;
}

/** Dama düzeninde domates kareler: hem kareli masa örtüsü hem QR kodun kareleri */
const CHECKS: readonly (readonly [number, number])[] = [
  [0, 0], [2, 0],
  [1, 1],
  [0, 2], [2, 2],
];
const CELL = 8;
const PAD = 3;
const SIZE = PAD * 2 + CELL * 3;

/** Logo işareti: koyu çerçeveli krem kare içinde 3×3 kareli örtü */
export default function BrandMark({ size = 28, className = "" }: BrandMarkProps) {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={size}
      height={size}
      className={`${styles.mark} ${className}`.trim()}
      aria-hidden="true"
      focusable="false"
    >
      <rect x={1} y={1} width={SIZE - 2} height={SIZE - 2} rx={7} className={styles.markBase} />
      {CHECKS.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={PAD + x * CELL} y={PAD + y * CELL} width={CELL} height={CELL} rx={1.5} className={styles.markCheck} />
      ))}
    </svg>
  );
}
