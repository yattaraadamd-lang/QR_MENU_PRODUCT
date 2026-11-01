import { QR_CELLS, QR_SIZE, type QrCell } from "./qr-matrix";
import styles from "./brand.module.css";

/** Koordinatlar ×100: yol verisinde ondalık yok, HTML ve RSC yükü küçük kalır */
const UNIT = 100;
const INSET = 6;
const SIDE = UNIT - INSET * 2;

const square = ({ x, y }: QrCell) => `M${x * UNIT + INSET} ${y * UNIT + INSET}h${SIDE}v${SIDE}h-${SIDE}z`;
/** Tüm kareler tek yol: ≈220 <rect> yerine tek öğe */
const QR_PATH = QR_CELLS.map(square).join("");

interface QrGlyphProps {
  readonly className?: string;
}

/** Masa kartındaki QR kod çizimi (okunabilir bir kod değil, biçim). Dekoratif. */
export default function QrGlyph({ className = "" }: QrGlyphProps) {
  const size = QR_SIZE * UNIT;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={`${styles.qr} ${className}`.trim()} aria-hidden="true" focusable="false">
      <path d={QR_PATH} />
    </svg>
  );
}
