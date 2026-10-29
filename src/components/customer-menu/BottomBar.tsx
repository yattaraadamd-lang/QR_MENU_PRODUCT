"use client";

import type { Ref } from "react";
import { formatTRY } from "@/lib/format";
import { BRAND, BRAND_DARK, BRAND_RGB } from "./constants";
import type { AuthStatus, LiveBill } from "./types";

type Props = {
  status: AuthStatus;
  liveBill: LiveBill;
  activeCount: number;
  cartCount: number;
  cartTotal: number;
  onOpenService: () => void;
  onOpenCart: () => void;
  /** Yükseklik ölçümü (--bottombar-h): menünün alt boşluğu bar kadar olur */
  ref?: Ref<HTMLDivElement>;
};

/** Mobil alt bar: canlı adisyon, hizmet menüsü ve sepet */
export default function BottomBar({ status, liveBill, activeCount, cartCount, cartTotal, onOpenService, onOpenCart, ref }: Props) {
  const remaining = (liveBill.total ?? 0) - liveBill.paid;

  return (
    <div ref={ref} className="lg:hidden" style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: "var(--bg-card)", borderTop: "1px solid var(--border-color)",
      paddingBottom: "max(0px, env(safe-area-inset-bottom))",
      zIndex: 40, boxShadow: "0 -8px 24px rgba(68,34,18,0.08)", borderRadius: "20px 20px 0 0",
    }}>
      {/* ✅ Canlı Adisyon Barı — AUTHORIZED ve aktif hesap varsa */}
      {status === "AUTHORIZED" && liveBill.total !== null && liveBill.total > 0 && (
        <div style={{
          padding: "8px 16px",
          background: "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(59,165,92,0.06))",
          borderBottom: "1px solid rgba(34,197,94,0.15)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden="true" style={{ fontSize: 16 }}>🧾</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Adisyon</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {liveBill.paid > 0 && (
              <span style={{ fontSize: 12, color: "var(--success-text)", fontWeight: 600 }}>
                ✓ {formatTRY(liveBill.paid)} ödendi
              </span>
            )}
            <span style={{ fontSize: 15, fontWeight: 800, color: remaining > 0 ? "var(--danger-text)" : "var(--success-text)" }}>
              {remaining > 0 ? formatTRY(remaining) : "Ödendi ✓"}
            </span>
          </div>
        </div>
      )}
      {/* ── Buton Satırı ── */}
      <div style={{ padding: "10px 12px", display: "flex", gap: 10 }}>
        {status === "AUTHORIZED" && (
          <button
            type="button"
            onClick={onOpenService}
            aria-label={activeCount > 0 ? `Hizmet, ${activeCount} bekleyen talep` : "Hizmet"}
            style={{
              flex: 1, padding: "12px 8px", borderRadius: 12,
              border: "1px solid var(--border-color)", background: "var(--bg-hover)",
              cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              position: "relative",
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 22 }}>🔔</span>
            <span style={{ fontSize: 11 }}>Hizmet</span>
            {/* ✅ Aktif talep sayısı rozeti */}
            {activeCount > 0 && (
              <span aria-hidden="true" className="animate-pulse-soft" style={{
                position: "absolute", top: 4, right: 6,
                background: "var(--danger)", color: "white",
                borderRadius: 99, minWidth: 18, height: 18,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800, padding: "0 4px",
                boxShadow: "0 2px 6px rgba(239,68,68,0.4)",
              }}>
                {activeCount}
              </span>
            )}
          </button>
        )}
        <button type="button" onClick={onOpenCart} disabled={cartCount === 0} style={{
          flex: status === "AUTHORIZED" ? 3 : 4,
          padding: "12px 16px", borderRadius: 12, border: "none",
          background: cartCount > 0 ? `linear-gradient(135deg, #D24521, ${BRAND} 55%, ${BRAND_DARK})` : "var(--bg-hover)",
          color: cartCount > 0 ? "white" : "var(--text-muted)",
          cursor: cartCount > 0 ? "pointer" : "not-allowed",
          fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          boxShadow: cartCount > 0 ? `0 8px 22px rgba(${BRAND_RGB},0.4)` : "none",
          transition: "all 0.2s",
        }}>
          {cartCount > 0 ? (
            <>
              <span key={cartCount} className="animate-bump" style={{ background: "rgba(255,255,255,0.25)", borderRadius: 99, padding: "2px 10px", fontSize: 14, fontWeight: 800, display: "inline-block" }}>{cartCount}</span>
              Sepet · {formatTRY(cartTotal)}
            </>
          ) : "🛒 Sepet Boş"}
        </button>
      </div>
    </div>
  );
}
