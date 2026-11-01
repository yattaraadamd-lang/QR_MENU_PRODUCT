import BrandMark from "./BrandMark";
import styles from "./brand.module.css";

interface BrandLogoProps {
  readonly size?: "sm" | "md";
  readonly className?: string;
}

const MARK_SIZE = { sm: 22, md: 26 } as const;

/** İşaret + kelime işareti. Bağlantıya sarmak çağıranın işi (Link/a). */
export default function BrandLogo({ size = "md", className = "" }: BrandLogoProps) {
  return (
    <span className={`${styles.logo} ${size === "sm" ? styles.logoSm : styles.logoMd} ${className}`.trim()}>
      <BrandMark size={MARK_SIZE[size]} />
      <span className={styles.wordmark}>
        QR <em>Menü</em>
      </span>
    </span>
  );
}
