"use client";

import type { RefObject } from "react";
import { BRAND, BRAND_RGB } from "./constants";
import type { Category } from "./types";

type Props = {
  categories: Category[];
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Mobil yatay şerit: aktif çip gözlemciden burada ortalanır */
  stripRef: RefObject<HTMLDivElement | null>;
};

export default function CategoryNav({ categories, activeId, onSelect, stripRef }: Props) {
  return (
    // Mobilde yapışkan olan nav'ın kendisi (iç div'deki sticky, nav şerit kadar yüksek
    // olduğu için tutunmuyordu). Masaüstünde static; oradaki liste kendi sticky'si.
    <nav aria-label="Kategoriler" className="lg:w-64 flex-shrink-0 sticky lg:static" style={{ top: 80, zIndex: 30 }}>
      {/* sticky sarmalayıcıda: iç kutu kendi kadar yüksek sarmalayıcıda tutunamıyordu */}
      <div className="hidden lg:block sticky" style={{ top: 96 }}>
        <div className="bg-white rounded-xl shadow-sm border p-2 flex flex-col gap-2" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          {categories.map(cat => {
            const active = activeId === cat.id;
            return (
              <button key={cat.id} type="button" data-tab-id={cat.id} aria-current={active ? "true" : undefined} onClick={() => onSelect(cat.id)} style={{
                padding: "12px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", border: "none", cursor: "pointer", transition: "all 0.2s", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                background: active ? "var(--primary)" : "transparent",
                color: active ? "white" : "var(--text-secondary)",
                transform: active ? "translateX(4px)" : "translateX(0)",
                boxShadow: active ? `0 6px 16px rgba(${BRAND_RGB},0.3)` : "none",
              }}>
                {cat.icon && <span aria-hidden="true" style={{ fontSize: 18 }}>{cat.icon}</span>}
                <span style={{ flex: 1 }}>{cat.name}</span>
                {active && <span aria-hidden="true" style={{ fontSize: 12 }}>→</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="lg:hidden bg-[var(--bg-primary)]" style={{ marginLeft: -16, marginRight: -16, padding: "12px 0" }}>
        <div ref={stripRef} className="relative flex gap-2 overflow-x-auto cat-scroll px-4" style={{ scrollPaddingLeft: 16 }}>
          {categories.map(cat => {
            const active = activeId === cat.id;
            return (
              <button key={cat.id} type="button" data-tab-id={cat.id} aria-current={active ? "true" : undefined} onClick={() => onSelect(cat.id)} style={{
                padding: "10px 18px", borderRadius: 99, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
                border: active ? "1.5px solid var(--primary)" : "1.5px solid var(--border-color)",
                cursor: "pointer", transition: "all 0.2s",
                background: active ? `linear-gradient(135deg, #D24521, ${BRAND})` : "var(--bg-card)",
                color: active ? "white" : "var(--text-secondary)",
                boxShadow: active ? `0 6px 16px rgba(${BRAND_RGB},0.3)` : "0 1px 3px rgba(68,34,18,0.05)",
                transform: active ? "scale(1.05)" : "scale(1)",
              }}>
                {cat.icon && <span aria-hidden="true" style={{ marginRight: 6 }}>{cat.icon}</span>}
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
