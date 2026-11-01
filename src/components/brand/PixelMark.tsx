import styles from "./brand.module.css";

interface PixelMarkProps {
  readonly size?: number;
  readonly className?: string;
}

/** 3×3 bulucu desen; sağ alt kare köze dönmüş: QR'ın dönüşen pikseli */
const CELLS: readonly (readonly [number, number])[] = [
  [0, 0], [1, 0], [2, 0],
  [0, 1],         [2, 1],
  [0, 2], [1, 2],
];

export default function PixelMark({ size = 28, className = "" }: PixelMarkProps) {
  return (
    <svg
      viewBox="0 0 3 3"
      width={size}
      height={size}
      className={`${styles.mark} ${className}`.trim()}
      aria-hidden="true"
      focusable="false"
    >
      {CELLS.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x + 0.08} y={y + 0.08} width={0.84} height={0.84} rx={0.14} />
      ))}
      <rect className={styles.markEmber} x={2.08} y={2.08} width={0.84} height={0.84} rx={0.14} />
    </svg>
  );
}
