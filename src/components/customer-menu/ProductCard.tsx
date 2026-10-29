"use client";

import { memo } from "react";
import { formatTRY } from "@/lib/format";
import { BRAND, BRAND_DARK, BRAND_RGB, foodTile } from "./constants";
import { orderable, stockLabel, type Product } from "./types";

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
  const mediaDim = ok ? undefined : { opacity: 0.55, filter: "grayscale(0.6)" };

  return (
    <div className="prod-card card lift" style={{
      padding: 0, display: "flex", flexDirection: p.image ? "column" : "row", cursor: "pointer", overflow: "hidden", position: "relative", transition: "transform 0.2s, box-shadow 0.2s", borderRadius: 20,
    }}>
      {/* Stoksuz ürünün ayrıntısı da açılır: alerjen/içerik bilgisi her zaman okunabilmeli */}
      <button
        type="button"
        className="card-hit"
        onClick={() => onOpen(p)}
        aria-label={`${p.name}, ${formatTRY(p.price)}${ok ? "" : ", şu an mevcut değil"} — ayrıntıları gör`}
      />
      {p.image ? (
        <div style={{ width: "100%", height: 168, position: "relative", overflow: "hidden", background: "var(--bg-hover)" }}>
          {/* Arka plan görseli yerine <img>: tarayıcı ekran dışındakileri indirmez (loading="lazy") */}
          <img
            src={p.image}
            alt=""
            width={600}
            height={168}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...mediaDim }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 55%, rgba(42,26,18,0.35) 100%)" }} />
          <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {p.isPopular && <span className="badge" style={{ background: "rgba(255,255,255,0.92)", color: "#B3261E", backdropFilter: "blur(4px)" }}>🔥 Popüler</span>}
            {sl && <span className="badge" style={{ background: sl.solid, color: "white" }}>{sl.text}</span>}
          </div>
        </div>
      ) : (
        <div aria-hidden style={{
          width: 88, minHeight: 88, margin: "12px 0 12px 12px", borderRadius: 16, flexShrink: 0,
          background: foodTile(p.id), display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 38, boxShadow: "inset 0 -14px 24px rgba(0,0,0,0.1)", ...mediaDim,
        }}>
          {categoryIcon || "🍽️"}
        </div>
      )}
      <div style={{ padding: 14, flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)", lineHeight: 1.3, flex: 1 }}>{p.name}</span>
          {!p.image && (<>
            {p.isPopular && <span className="badge badge-accent">🔥 Popüler</span>}
            {sl && <span className="badge" style={{ background: sl.bg, color: sl.fg }}>{sl.text}</span>}
          </>)}
        </div>
        {p.description && (
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.description}</p>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: "auto" }}>
          <span style={{ fontSize: 19, fontWeight: 800, color: "var(--primary)", letterSpacing: "-0.01em" }}>{formatTRY(p.price)}</span>
          <button type="button" onClick={() => onAdd(p)} disabled={!ok} aria-label={ok ? `${p.name} sepete ekle` : `${p.name} şu an yok`} className="btn btn-sm card-actions" style={{
            background: ok ? `linear-gradient(135deg, #D24521, ${BRAND} 60%, ${BRAND_DARK})` : "var(--bg-hover)",
            color: ok ? "white" : "var(--text-muted)", borderRadius: 99, padding: "8px 16px", fontSize: 13, fontWeight: 700, minHeight: 38,
            boxShadow: ok ? `0 4px 12px rgba(${BRAND_RGB},0.3)` : "none",
          }}>
            {ok ? "+ Ekle" : "Yok"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(ProductCard);
