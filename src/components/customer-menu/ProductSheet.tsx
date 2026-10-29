"use client";

import { useId, useRef } from "react";
import Dialog from "@/components/ui/Dialog";
import { formatTRY } from "@/lib/format";
import { orderable, type Product } from "./types";

type Props = {
  product: Product;
  onClose: () => void;
  onAdd: (p: Product, note?: string) => void;
};

/** Ürün ayrıntısı (alttan açılan sayfa): açıklama, içerik, alerjen, özel not */
export default function ProductSheet({ product, onClose, onAdd }: Props) {
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const noteId = useId();
  const ok = orderable(product);

  return (
    <Dialog onClose={onClose} overlayStyle={{ alignItems: "flex-end" }} contentClassName="modal-content modal-sheet" contentStyle={{ borderRadius: "20px 20px 0 0", padding: "0 0 24px", margin: 0, maxWidth: 600 }}>
      <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>{product.name}</h2>
        <button type="button" aria-label="Kapat" className="tap-target" onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-hover)", border: "none", fontSize: 16, cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ padding: "16px 20px" }}>
        {product.description && <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>{product.description}</p>}
        {product.ingredients && (
          <div style={{ marginBottom: 12, padding: "10px 14px", background: "var(--bg-hover)", borderRadius: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>İçindekiler</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{product.ingredients}</p>
          </div>
        )}
        {product.allergens && (
          <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(217,68,31,0.05)", borderRadius: 10, border: "1px solid rgba(217,68,31,0.2)" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>⚠️ Alerjenler</p>
            <p style={{ fontSize: 13, color: "var(--accent)" }}>{product.allergens}</p>
          </div>
        )}
        {ok && (
          <div style={{ marginBottom: 16 }}>
            <label htmlFor={noteId} style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>📝 Özel Not (opsiyonel)</label>
            <textarea id={noteId} ref={noteRef} placeholder="Örn: Soğansız, az pişmiş..." className="input" style={{ resize: "none", height: 60 }} />
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: "var(--primary)" }}>{formatTRY(product.price)}</span>
          <button
            type="button"
            disabled={!ok}
            onClick={() => {
              onAdd(product, noteRef.current?.value.trim() || undefined);
              onClose();
            }}
            className="btn btn-primary btn-lg"
          >
            {ok ? "Sepete Ekle" : "Şu an mevcut değil"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
