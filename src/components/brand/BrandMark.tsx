import type { CSSProperties } from "react";
import { QrCode } from "lucide-react";
import styles from "./brand.module.css";

interface BrandMarkProps {
  readonly size?: number;
  readonly className?: string;
}

/** Orijinal tasarımdaki oranlar: 36px karede 12px köşe, 19px ikon */
const RADIUS_RATIO = 1 / 3;
const ICON_RATIO = 19 / 36;

/** Logo işareti: kırmızı-turuncu degrade kare içinde beyaz QR ikonu (ilk tasarımın logosu) */
export default function BrandMark({ size = 36, className = "" }: BrandMarkProps) {
  const style: CSSProperties = { width: size, height: size, borderRadius: Math.round(size * RADIUS_RATIO) };
  return (
    <span className={`${styles.mark} ${className}`.trim()} style={style} aria-hidden="true">
      <QrCode size={Math.round(size * ICON_RATIO)} />
    </span>
  );
}
