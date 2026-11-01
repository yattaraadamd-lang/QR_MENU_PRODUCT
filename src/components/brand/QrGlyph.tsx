import styles from "./brand.module.css";

/** Statik QR çizimi (public/brand/qr-card.svg, 4 KB). Sayfaya gömülseydi her kopyası
 *  HTML'e ve RSC yüküne ≈6 KB ekliyordu; dosya olarak bir kez iner ve önbelleğe girer. */
const SRC = "/brand/qr-card.svg";
const SIZE = 210;

interface QrGlyphProps {
  readonly className?: string;
}

/** Masa kartındaki QR kod çizimi (okunabilir bir kod değil, biçim). Dekoratif. */
export default function QrGlyph({ className = "" }: QrGlyphProps) {
  return (
    <img
      src={SRC}
      alt=""
      width={SIZE}
      height={SIZE}
      decoding="async"
      className={`${styles.qr} ${className}`.trim()}
    />
  );
}
