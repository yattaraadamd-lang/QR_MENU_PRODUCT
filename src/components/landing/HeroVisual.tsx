import PixelMorph from "@/components/brand/PixelMorph";
import { enterDelay } from "./motion-style";
import { MENU_PREVIEW } from "./content";
import styles from "./landing.module.css";

const ITEM_DELAY_START = 1.25;
const ITEM_DELAY_STEP = 0.1;

/** QR kodu sağa doğru köze dönüşür; dönüştüğü yerden menü kartı çıkar */
export default function HeroVisual() {
  return (
    <div
      role="img"
      aria-label="Masadaki QR kodun menüye ve siparişe dönüşmesini gösteren çizim"
      className={`enter-fade ${styles.visual}`}
      style={enterDelay(0.2)}
    >
      <p className={styles.visualCaption}>
        <span>QR · 21×21</span>
        <span>→ Menü</span>
      </p>
      <div className={styles.qrFrame}>
        <PixelMorph />
        <span className={styles.scan} />
      </div>

      <div className={`theme-paper enter-from-right ${styles.menuCard}`} style={enterDelay(1.1)}>
        <p className={styles.menuCardHead}>
          <span>Masa 05</span>
          <span>Lezzet Durağı</span>
        </p>
        <ul className={styles.menuCardList}>
          {MENU_PREVIEW.map((item, i) => (
            <li key={item.name} className="enter-fade" style={enterDelay(ITEM_DELAY_START + i * ITEM_DELAY_STEP)}>
              <span className={styles.menuCardName}>{item.name}</span>
              <span className={styles.menuCardNote}>{item.note}</span>
              <span className={styles.menuCardPrice}>{item.price} ₺</span>
            </li>
          ))}
        </ul>
        <p className={styles.menuCardCart}>
          <span>Sepet · 3</span>
          <span>715,00 ₺</span>
        </p>
      </div>
    </div>
  );
}
