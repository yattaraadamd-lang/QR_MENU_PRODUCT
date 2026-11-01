"use client";

import { memo } from "react";
import { formatTRY } from "@/lib/format";
import { foodTile } from "./constants";
import { orderable, stockLabel, type Product } from "./types";
import styles from "./customer-menu.module.css";

type Props = {
  product: Product;
  categoryIcon: string | null;
  /** İlk ekrandaki kartlar: görsel hemen ve yüksek öncelikle iner */
  priority?: boolean;
  onOpen: (p: Product) => void;
  onAdd: (p: Product) => void;
};

// memo: sepete ekleme yalnız sepet ve alt barı yeniden çizer, ürün listesini değil
function ProductCard({ product: p, categoryIcon, priority = false, onOpen, onAdd }: Props) {
  const sl = stockLabel(p);
  const ok = orderable(p);
  // Stoksuz üründe yalnız görsel soluklaşır; metin okunur kalır (kontrast)
  const dim = ok ? "" : styles.dim;

  return (
    <div className={`prod-card card lift ${styles.product}`} data-media={p.image ? "image" : "tile"}>
      {/* Stoksuz ürünün ayrıntısı da açılır: alerjen/içerik bilgisi her zaman okunabilmeli */}
      <button
        type="button"
        className="card-hit"
        onClick={() => onOpen(p)}
        aria-label={`${p.name}, ${formatTRY(p.price)}${ok ? "" : ", şu an mevcut değil"} — ayrıntıları gör`}
      />
      {p.image ? (
        <div className={styles.media}>
          {/* Arka plan görseli yerine <img>: tarayıcı ekran dışındakileri indirmez (loading="lazy") */}
          <img
            src={p.image}
            alt=""
            width={600}
            height={168}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            className={dim}
          />
          <div className={styles.mediaShade} />
          <div className={styles.mediaBadges}>
            {p.isPopular && <span className={`badge ${styles.popular}`}>Popüler</span>}
            {sl && <span className="badge" style={{ background: sl.solid, color: "white" }}>{sl.text}</span>}
          </div>
        </div>
      ) : (
        <div aria-hidden className={`${styles.tile} ${dim}`} style={{ background: foodTile(p.id) }}>
          {categoryIcon || "🍽️"}
        </div>
      )}
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <span className={styles.name}>{p.name}</span>
          {!p.image && (
            <>
              {p.isPopular && <span className={`badge ${styles.popular}`}>Popüler</span>}
              {sl && <span className="badge" style={{ background: sl.bg, color: sl.fg }}>{sl.text}</span>}
            </>
          )}
        </div>
        {p.description && <p className={styles.desc}>{p.description}</p>}
        <div className={styles.footer}>
          <span className={styles.price}>{formatTRY(p.price)}</span>
          <button
            type="button"
            onClick={() => onAdd(p)}
            disabled={!ok}
            aria-label={ok ? `${p.name} sepete ekle` : `${p.name} şu an yok`}
            className={`btn ${ok ? "btn-primary" : "btn-subtle"} btn-sm card-actions ${styles.addBtn}`}
          >
            {ok ? "+ Ekle" : "Yok"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(ProductCard);
