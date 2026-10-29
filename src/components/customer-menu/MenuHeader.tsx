"use client";

import type { Ref } from "react";
import { BRAND, BRAND_DARK, BRAND_RGB } from "./constants";
import type { AuthStatus, Business, TableInfo } from "./types";

type Props = {
  business: Business;
  table: TableInfo | null;
  status: AuthStatus;
  onOpenService: () => void;
  /** Yükseklik ölçümü (--header-h) */
  ref?: Ref<HTMLElement>;
};

export default function MenuHeader({ business, table, status, onOpenService, ref }: Props) {
  return (
    <header ref={ref} style={{
      background: `radial-gradient(420px 180px at 92% -30%, rgba(244,166,35,0.55), transparent 70%), linear-gradient(150deg, #D24521 0%, ${BRAND} 45%, ${BRAND_DARK} 100%)`,
      padding: "16px 16px 24px",
      color: "white",
      position: "sticky",
      top: 0,
      zIndex: 40,
      borderRadius: "0 0 22px 22px",
      boxShadow: `0 10px 28px rgba(${BRAND_RGB},0.28)`,
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, flexShrink: 0,
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}>
            {business.logo ? (
              <img src={business.logo} alt="" width={48} height={48} decoding="async" style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover" }} />
            ) : <span aria-hidden="true">🏪</span>}
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 className="font-display" style={{ fontSize: 21, fontWeight: 600, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {business.name}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 12, background: "rgba(255,255,255,0.2)", padding: "2px 10px", borderRadius: 99, fontWeight: 600, backdropFilter: "blur(4px)" }}>
                🪑 {table?.tableName || `Masa ${table?.tableNumber}`}
              </span>
              {/* Yetki durumu rozeti */}
              {status === "AUTHORIZED" && (
                <span style={{ fontSize: 10, background: "rgba(34,197,94,0.3)", padding: "2px 8px", borderRadius: 99, fontWeight: 700 }}>✓ Aktif</span>
              )}
              {status === "PENDING" && (
                <span style={{ fontSize: 10, background: "rgba(244,166,35,0.3)", padding: "2px 8px", borderRadius: 99, fontWeight: 700 }}>⏳ Onay</span>
              )}
            </div>
          </div>
        </div>
        {/* Masaüstü hizmet butonu — yalnız AUTHORIZED ise */}
        {status === "AUTHORIZED" && (
          <div className="hidden lg:block">
            <button
              type="button"
              onClick={onOpenService}
              className="btn btn-ghost"
              style={{
                background: "rgba(255,255,255,0.15)", color: "white",
                borderColor: "rgba(255,255,255,0.25)", borderRadius: 99,
                backdropFilter: "blur(8px)", fontSize: 13, padding: "8px 16px",
              }}
            >
              🔔 Hizmet
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
