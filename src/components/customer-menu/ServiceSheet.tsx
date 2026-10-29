"use client";

import Dialog from "@/components/ui/Dialog";
import type { ActiveRequests } from "./types";

type Props = {
  activeRequests: ActiveRequests;
  sending: boolean;
  onClose: () => void;
  onCallWaiter: () => void;
  onPayment: () => void;
  onHelp: () => void;
};

/** Hizmet talepleri menüsü: garson çağır, ödeme iste, yardım iste */
export default function ServiceSheet({ activeRequests, sending, onClose, onCallWaiter, onPayment, onHelp }: Props) {
  const items = [
    {
      type: "CALL_WAITER", icon: "🙋", title: "Garson Çağır", desc: "Garsonun masanıza gelmesini sağlayın",
      action: onCallWaiter,
      blocked: !!(activeRequests["CALL_WAITER"] || activeRequests["CALL_WAITER_BLOCKED"]),
      activeMsg: activeRequests["CALL_WAITER"] ? "Çağrınız iletildi, bekleniyor..." : undefined,
    },
    {
      type: "PAYMENT_REQUEST", icon: "💳", title: "Ödeme İste", desc: "Hesabınızı kapatmak için garson çağırın",
      action: onPayment,
      blocked: !!(activeRequests["PAYMENT_REQUEST"] || activeRequests["PAYMENT_REQUEST_BLOCKED"]) || sending,
      activeMsg: activeRequests["PAYMENT_REQUEST"] ? "Ödeme talebiniz iletildi, bekleniyor..." : undefined,
    },
    {
      type: "HELP_REQUEST", icon: "ℹ️", title: "Yardım İste", desc: "Bilgi veya destek talebi oluşturun",
      action: onHelp,
      blocked: false, activeMsg: undefined,
    },
  ];

  return (
    <Dialog onClose={onClose} overlayStyle={{ alignItems: "flex-end" }} contentClassName="modal-content modal-sheet" contentStyle={{ borderRadius: "20px 20px 0 0", padding: "0 0 24px", margin: 0, maxWidth: 600 }}>
      <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>Hizmet Talepleri</h2>
        <button type="button" aria-label="Kapat" className="tap-target" onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-hover)", border: "none", fontSize: 16, cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map(item => {
          const unavailable = item.blocked || sending;
          return (
            // aria-disabled: odaklanabilir kalır, ekran okuyucu durumunu "bekliyor" metniyle birlikte okur
            <button
              key={item.type}
              type="button"
              className="service-btn card"
              aria-disabled={unavailable || undefined}
              onClick={unavailable ? undefined : item.action}
              style={{
                display: "flex", alignItems: "center", gap: 14, padding: "16px", borderRadius: 16,
                border: `1px solid ${item.blocked ? "rgba(220,38,38,0.3)" : "var(--border-color)"}`,
                background: item.blocked ? "rgba(220,38,38,0.04)" : "var(--bg-card)",
                cursor: item.blocked ? "not-allowed" : "pointer", textAlign: "left",
                transition: "all 0.15s", width: "100%", opacity: item.blocked ? 0.8 : 1, boxShadow: "var(--shadow-sm)",
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 32, flexShrink: 0 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontWeight: 700, fontSize: 16, color: item.blocked ? "var(--text-muted)" : "var(--text-primary)" }}>{item.title}</span>
                <span style={{ display: "block", fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{item.activeMsg || item.desc}</span>
              </span>
              {item.blocked ? (
                <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, flexShrink: 0 }}>⏳ Bekliyor</span>
              ) : (
                <span aria-hidden="true" style={{ color: "var(--text-muted)", fontSize: 20 }}>›</span>
              )}
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}
