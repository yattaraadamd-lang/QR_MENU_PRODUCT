import BrandMark from "./BrandMark";
import styles from "./brand.module.css";

interface BrandLogoProps {
  readonly size?: "sm" | "md";
  readonly className?: string;
}

const MARK_SIZE = { sm: 32, md: 36 } as const;

/** İlk tasarımın logosu: işaret + "QRMenü" kelime işareti. Bağlantıya sarmak çağıranın işi. */
export default function BrandLogo({ size = "md", className = "" }: BrandLogoProps) {
  return (
    <span className={`${styles.logo} ${size === "sm" ? styles.logoSm : styles.logoMd} ${className}`.trim()}>
      <BrandMark size={MARK_SIZE[size]} />
      <span className={styles.wordmark}>
        QR<em>Menü</em>
      </span>
    </span>
  );
}
