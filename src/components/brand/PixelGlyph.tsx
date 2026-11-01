import styles from "./brand.module.css";

const GLYPH_CELLS = 16;

interface PixelGlyphProps {
  /** 0–16 arası dolu (köz) kare sayısı */
  readonly filled: number;
  readonly className?: string;
}

/** 4×4 piksel ilerleme işareti; dekoratif */
export default function PixelGlyph({ filled, className = "" }: PixelGlyphProps) {
  return (
    <span className={`${styles.glyph} ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: GLYPH_CELLS }, (_, i) => (
        <span key={i} data-on={i < filled} />
      ))}
    </span>
  );
}
