import QrGlyph from "@/components/brand/QrGlyph";
import { enterDelay } from "@/components/ui/motion-style";
import { MENU_PREVIEW } from "./content";
import styles from "./landing.module.css";

const ITEM_DELAY_START = 0.75;
const ITEM_DELAY_STEP = 0.1;

/** Kareli örtülü masada QR masa kartı, yanında açılan menü ve mutfağa düşen fiş */
export default function HeroVisual() {
  return (
    <div
      role="img"
      aria-label="Kareli örtülü masada QR kodlu masa kartı, telefondaki menü ve mutfağa giden sipariş fişi"
      className={`enter-fade ${styles.visual}`}
      style={enterDelay(0.2)}
    >
      <div className={styles.tablecloth} />

      <div className={styles.tent}>
        <p className={styles.tentTable}>Masa 5</p>
        <QrGlyph className={styles.tentQr} />
        <p className={styles.tentHint}>Menü için okutun</p>
      </div>

      <div className={`enter-from-right ${styles.menuCard}`} style={enterDelay(0.55)}>
        <p className={styles.menuCardHead}>Günün menüsü</p>
        <ul className={styles.menuCardList}>
          {MENU_PREVIEW.map((item, i) => (
            <li key={item.name} className="enter-fade" style={enterDelay(ITEM_DELAY_START + i * ITEM_DELAY_STEP)}>
              <span className={styles.menuCardName}>{item.name}</span>
              <span className={styles.menuCardDots} />
              <span className={styles.menuCardPrice}>{item.price} ₺</span>
              <span className={styles.menuCardNote}>{item.note}</span>
            </li>
          ))}
        </ul>
        <p className={styles.menuCardCart}>
          <span>Sepet · 3 ürün</span>
          <span>715 ₺</span>
        </p>
      </div>

      <div className={`enter-fade ${styles.ticket}`} style={enterDelay(1.1)}>
        <span className={styles.ticketDot} />
        <span>
          <strong>Yeni sipariş</strong>
          <span>Masa 5 · mutfakta</span>
        </span>
      </div>
    </div>
  );
}
