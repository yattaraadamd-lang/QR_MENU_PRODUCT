import { FEED_STATUS_LABEL, LIVE_FEED } from "./content";
import { enterDelay } from "./motion-style";
import styles from "./landing.module.css";

const FEED_DELAY_START = 0.6;
const FEED_DELAY_STEP = 0.12;

/** Örnek canlı sipariş akışı: ürünün "her sipariş bir sinyal" fikri */
export default function SignalStrip() {
  return (
    <section aria-labelledby="signal-title" className={styles.signal}>
      <div className={styles.signalInner}>
        <h2 id="signal-title" className={styles.signalLabel}>
          <span className={styles.liveDot} aria-hidden="true" />
          Canlı akış örneği
        </h2>
        <ol className={styles.signalList}>
          {LIVE_FEED.map((entry, i) => (
            <li key={entry.time} className="enter-fade" style={enterDelay(FEED_DELAY_START + i * FEED_DELAY_STEP)}>
              <time className={styles.signalTime}>{entry.time}</time>
              <span className={styles.signalTable}>{entry.table}</span>
              <span className={styles.signalText}>{entry.text}</span>
              <span className={styles.signalStatus} data-status={entry.status}>
                {FEED_STATUS_LABEL[entry.status]}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
