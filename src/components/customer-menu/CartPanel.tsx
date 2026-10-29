"use client";

import { useId } from "react";
import { formatTRY } from "@/lib/format";
import type { AuthStatus, CartItem } from "./types";

type Props = {
  items: CartItem[];
  total: number;
  status: AuthStatus;
  /** Canonical oturum durumu öğrenilmeden sipariş butonu açılmaz */
  hydrated: boolean;
  verificationCode: string | null;
  submitting: boolean;
  orderNote: string;
  onOrderNoteChange: (v: string) => void;
  onQty: (productId: string, note: string | undefined, delta: number) => void;
  onSubmit: () => void;
};

// ✅ Sipariş butonunun duruma göre metni ve etkinliği
function orderButton(status: AuthStatus, hydrated: boolean, submitting: boolean) {
  if (!hydrated) return { label: "⏳ Oturum kontrol ediliyor...", disabled: true };
  const labels: Record<AuthStatus, string> = {
    VIEW_ONLY: "Sipariş Talebi Oluştur",
    PENDING: "⏳ Garson Onayı Bekleniyor...",
    AUTHORIZED: "Siparişi Gönder 🚀",
    REVOKED: "🔒 Masa Başka Oturuma Ait",
    TABLE_ALREADY_CLAIMED: "🔒 Masa Başka Oturuma Ait",
  };
  const blocked = status === "REVOKED" || status === "TABLE_ALREADY_CLAIMED" || status === "PENDING";
  return { label: labels[status], disabled: blocked || submitting };
}

/** Sepet içeriği: masaüstünde yan panelde, mobilde alttan açılan sayfada aynı bileşen */
export default function CartPanel(p: Props) {
  // Bileşen iki yerde çizildiği için sabit id çakışırdı
  const noteId = useId();
  const btn = orderButton(p.status, p.hydrated, p.submitting);

  return (
    <>
      {/* PENDING durumunda doğrulama kodu göster */}
      {p.status === "PENDING" && p.verificationCode && (
        <div style={{
          padding: "16px", marginBottom: 16,
          background: "linear-gradient(135deg, rgba(244,166,35,0.12), rgba(244,166,35,0.06))",
          borderRadius: 14, border: "1px solid rgba(244,166,35,0.25)",
          textAlign: "center",
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#8C2A14", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Masa Doğrulama Kodunuz
          </p>
          <p style={{ fontSize: 36, fontWeight: 900, color: "#CF411E", letterSpacing: "0.2em", fontFamily: "monospace" }}>
            {p.verificationCode}
          </p>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
            Garson masanıza geldiğinde bu kodu söyleyin.
          </p>
        </div>
      )}

      {/* REVOKED/TABLE_ALREADY_CLAIMED mesajı */}
      {(p.status === "REVOKED" || p.status === "TABLE_ALREADY_CLAIMED") && (
        <div style={{
          padding: "14px 16px", marginBottom: 16,
          background: "rgba(239,68,68,0.08)", borderRadius: 12,
          border: "1px solid rgba(239,68,68,0.25)",
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--danger-text)" }}>
            🔒 Bu masa başka bir aktif oturuma ait.
          </p>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            Personelden yardım isteyin.
          </p>
        </div>
      )}

      {p.items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
          <div aria-hidden="true" style={{ fontSize: 48, marginBottom: 8 }}>🛒</div>
          <p style={{ fontSize: 14 }}>Sepetiniz boş</p>
        </div>
      ) : (
        <>
          <ul style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 16, listStyle: "none" }}>
            {p.items.map(item => (
              <li key={`${item.product.id}-${item.customerNote ?? ""}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>{item.product.name}</p>
                  {item.customerNote && <p style={{ fontSize: 11, color: "var(--accent)", marginTop: 2 }}>📝 {item.customerNote}</p>}
                  <p style={{ fontSize: 13, color: "var(--primary)", fontWeight: 700, marginTop: 2 }}>{formatTRY(Number(item.product.price) * item.quantity)}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <button type="button" aria-label={`${item.product.name} adedini azalt`} className="tap-target" onClick={() => p.onQty(item.product.id, item.customerNote, -1)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border-color)", background: "white", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>−</button>
                  <span style={{ fontWeight: 700, fontSize: 15, width: 24, textAlign: "center", color: "var(--text-primary)" }}>{item.quantity}</span>
                  <button type="button" aria-label={`${item.product.name} adedini artır`} className="tap-target" onClick={() => p.onQty(item.product.id, item.customerNote, 1)} style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "var(--primary)", color: "white", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                </div>
              </li>
            ))}
          </ul>
          {p.status === "AUTHORIZED" && (
            <>
              <label htmlFor={noteId} className="sr-only">Sipariş notu</label>
              <textarea id={noteId} value={p.orderNote} onChange={e => p.onOrderNoteChange(e.target.value)} placeholder="Sipariş notu (opsiyonel)..." className="input" style={{ resize: "none", height: 56, marginBottom: 16 }} />
            </>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, padding: "12px 0", borderTop: "2px solid var(--border-subtle)" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Toplam</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: "var(--primary)" }}>{formatTRY(p.total)}</span>
          </div>
          <button
            type="button"
            onClick={p.onSubmit}
            disabled={btn.disabled}
            className="btn btn-primary"
            style={{ width: "100%", padding: "15px 0", borderRadius: 14, fontSize: 16, opacity: btn.disabled ? 0.6 : 1 }}
          >
            {p.submitting ? "Gönderiliyor..." : btn.label}
          </button>
        </>
      )}
    </>
  );
}
