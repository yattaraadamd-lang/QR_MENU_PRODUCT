import type { CSSProperties } from "react";
import { QR_COLUMNS, QR_SIZE, type QrCell } from "./qr-matrix";
import styles from "./brand.module.css";

/** Bu sütundan sonrası köze döner: QR'ın sağ üçte biri menüye "akar" */
const EMBER_FROM = 13;
const FADE_PER_COLUMN = 0.085;
/** Koordinatlar ×100: yol verisinde ondalık yok, HTML ve RSC yükü küçük kalır */
const UNIT = 100;
const INSET = 7;
const SIDE = UNIT - INSET * 2;
/** Köz sütunlarında her dördüncü kare soluk: sönerken dağılan pikseller */
const FAINT_EVERY = 4;

const square = ({ x, y }: QrCell) => `M${x * UNIT + INSET} ${y * UNIT + INSET}h${SIDE}v${SIDE}h-${SIDE}z`;
const path = (cells: readonly QrCell[]) => cells.map(square).join("");

/** Her kare ayrı <rect> olsaydı ≈220 öğe ×2 (DOM + RSC yükü); burada en çok 17 yol */
const QR_PART = path(QR_COLUMNS.slice(0, EMBER_FROM).flat());
const EMBER_COLUMNS = QR_COLUMNS.slice(EMBER_FROM).map((cells, step) => ({
  step,
  solid: path(cells.filter((_, i) => i % FAINT_EVERY !== 0)),
  faint: path(cells.filter((_, i) => i % FAINT_EVERY === 0)),
}));

interface PixelMorphProps {
  readonly className?: string;
  /** false: dönüşüm oynamaz, doğrudan son durum (ekranın altındaki kopyalar için) */
  readonly animated?: boolean;
}

/** Marka motifi: QR kodu sağa doğru köz piksellere dönüşüp söner. Dekoratif. */
export default function PixelMorph({ className = "", animated = true }: PixelMorphProps) {
  const size = QR_SIZE * UNIT;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={`${styles.morph} ${animated ? "" : styles.still} ${className}`.replace(/\s+/g, " ").trim()}
      aria-hidden="true"
      focusable="false"
    >
      <path d={QR_PART} />
      {EMBER_COLUMNS.map(({ step, solid, faint }) => (
        <g
          key={step}
          className={styles.emberCol}
          opacity={1 - step * FADE_PER_COLUMN}
          style={{ "--step": step } as CSSProperties}
        >
          <path d={solid} />
          {faint && <path d={faint} className={styles.faint} />}
        </g>
      ))}
    </svg>
  );
}
