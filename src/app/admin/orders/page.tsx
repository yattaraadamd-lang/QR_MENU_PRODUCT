"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const statusLabels: Record<string, string> = {
  PENDING: "Bekliyor", ACCEPTED: "Kabul Edildi", PREPARING: "Hazırlanıyor",
  SERVED: "Tamamlandı", CANCELLED: "İptal", REJECTED: "Reddedildi",
};
const statusColors: Record<string, string> = {
  PENDING: "badge-warning", ACCEPTED: "badge-info", PREPARING: "badge-primary",
  SERVED: "badge-success", CANCELLED: "badge-danger", REJECTED: "badge-danger",
};
const paymentLabels: Record<string, string> = {
  UNPAID: "Ödenmedi", PAYMENT_REQUESTED: "Ödeme Bekleniyor", PAID: "Ödendi", CANCELLED: "İptal",
};
const paymentColors: Record<string, string> = {
  UNPAID: "#f59e0b", PAYMENT_REQUESTED: "#8b5cf6", PAID: "#10b981", CANCELLED: "#ef4444",
};

// Sekme tanımları
const TABS = [
  { key: "all",      label: "Tümü",           badgeColor: null },
  { key: "active",   label: "Aktif",           badgeColor: "#f59e0b" },
  { key: "pending_payment", label: "Bekleyen Ödeme", badgeColor: "#8b5cf6" },
  { key: "completed",label: "Tamamlanan",      badgeColor: "#10b981" },
  { key: "cancelled",label: "İptal Edilen",    badgeColor: "#ef4444" },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function AdminOrdersPage() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TabKey>("all");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user.businessId) {
      fetchOrders();
      const iv = setInterval(fetchOrders, 10000);
      return () => clearInterval(iv);
    }
  }, [session]);

  const fetchOrders = async () => {
    try {
      const res = await fetch(`/api/orders?businessId=${session?.user.businessId}`);
      const data = await res.json();
      if (res.ok) setOrders(data.orders || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder || !cancelReason.trim()) return;
    setCancellingId(selectedOrder.id);
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}?reason=${encodeURIComponent(cancelReason)}`, { method: "DELETE" });
      if (res.ok) { fetchOrders(); setShowCancelModal(false); setCancelReason(""); setSelectedOrder(null); }
      else { const d = await res.json(); alert(d.error || "İptal edilemedi"); }
    } catch { alert("Bağlantı hatası"); }
    finally { setCancellingId(null); }
  };

  // Filtre mantığı — "Bekleyen Ödeme" = servis edilmiş ama ödenmemiş
  const filtered = orders.filter((o) => {
    if (filter === "active") return ["PENDING", "ACCEPTED", "PREPARING"].includes(o.status);
    if (filter === "pending_payment") return o.status === "SERVED" && o.paymentStatus === "UNPAID";
    if (filter === "completed") return o.status === "SERVED" && o.paymentStatus === "PAID";
    if (filter === "cancelled") return ["CANCELLED", "REJECTED"].includes(o.status);
    return true;
  });

  // Sayaçlar
  const counts: Record<TabKey, number> = {
    all: orders.length,
    active: orders.filter(o => ["PENDING", "ACCEPTED", "PREPARING"].includes(o.status)).length,
    pending_payment: orders.filter(o => o.status === "SERVED" && o.paymentStatus === "UNPAID").length,
    completed: orders.filter(o => o.status === "SERVED" && o.paymentStatus === "PAID").length,
    cancelled: orders.filter(o => ["CANCELLED", "REJECTED"].includes(o.status)).length,
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>Sipariş Yönetimi</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 3 }}>{orders.length} sipariş</p>
        </div>
      </div>

      {/* Sekmeler — sayılar her zaman görünür */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {TABS.map(tab => {
          const isActive = filter === tab.key;
          const count = counts[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: isActive ? "none" : "1px solid var(--border-color)",
                background: isActive ? "var(--primary)" : "transparent",
                color: isActive ? "white" : "var(--text-secondary)",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {tab.label}
              {/* ✅ Badge: her zaman görünür, aktif sekmede de kaybolmaz */}
              {count > 0 && (
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  minWidth: 20, height: 20, borderRadius: 99, fontSize: 11, fontWeight: 800,
                  padding: "0 5px",
                  // Aktif sekmede: yarı saydam beyaz arka plan, beyaz metin
                  // Pasif sekmede: renkli arka plan, beyaz metin
                  background: isActive
                    ? "rgba(255,255,255,0.25)"
                    : (tab.badgeColor ? `${tab.badgeColor}22` : "var(--bg-hover)"),
                  color: isActive
                    ? "white"
                    : (tab.badgeColor || "var(--text-secondary)"),
                  border: isActive ? "1px solid rgba(255,255,255,0.3)" : "none",
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bekleyen Ödeme uyarısı */}
      {filter === "pending_payment" && counts.pending_payment > 0 && (
        <div style={{
          padding: "12px 16px", background: "rgba(139,92,246,0.08)",
          border: "1px solid rgba(139,92,246,0.2)", borderRadius: 10,
          marginBottom: 16, fontSize: 13, color: "#c4b5fd",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          💳 Bu siparişler servis edilmiş ancak henüz ödeme alınmamış. Ödeme almak için admin/kasa panelinden işlem yapın.
        </div>
      )}

      {/* İptal Modal */}
      {showCancelModal && selectedOrder && (
        <div className="modal-overlay" onClick={() => setShowCancelModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: 24, maxWidth: 440 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Siparişi İptal Et</h3>
            <div style={{ marginBottom: 16, padding: 12, background: "var(--bg-secondary)", borderRadius: 8 }}>
              <p style={{ fontSize: 14, marginBottom: 4 }}><strong>Masa:</strong> {selectedOrder.table?.tableName || `Masa ${selectedOrder.table?.tableNumber}`}</p>
              <p style={{ fontSize: 14, marginBottom: 4 }}><strong>Toplam:</strong> {Number(selectedOrder.totalPrice).toFixed(2)} ₺</p>
              <p style={{ fontSize: 14 }}><strong>Durum:</strong> {statusLabels[selectedOrder.status]}</p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>İptal Nedeni *</label>
              <textarea className="input" value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                placeholder="Örn: Müşteri vazgeçti, Ürün stokta yok..." style={{ height: 80, resize: "none" }} autoFocus />
            </div>
            <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, marginBottom: 16, fontSize: 13, color: "#fca5a5" }}>
              ⚠️ Bu işlem geri alınamaz.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleCancelOrder} disabled={cancellingId === selectedOrder.id || !cancelReason.trim()} className="btn btn-danger" style={{ flex: 1, opacity: (!cancelReason.trim() || cancellingId) ? 0.5 : 1 }}>
                {cancellingId === selectedOrder.id ? "İptal Ediliyor..." : "Siparişi İptal Et"}
              </button>
              <button onClick={() => setShowCancelModal(false)} className="btn btn-ghost">Vazgeç</button>
            </div>
          </div>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 12 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Bu kategoride sipariş bulunamadı</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(order => (
            <div key={order.id} className="card" style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 16 }}>{order.table?.tableName || `Masa ${order.table?.tableNumber}`}</p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                    {new Date(order.createdAt).toLocaleString("tr-TR")}
                  </p>
                  {order.waiter && <p style={{ fontSize: 11, color: "var(--primary-light)", marginTop: 2 }}>👤 {order.waiter.name}</p>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                  <span className={`badge ${statusColors[order.status] || "badge-info"}`}>
                    {statusLabels[order.status] || order.status}
                  </span>
                  {order.paymentStatus && !["CANCELLED", "REJECTED"].includes(order.status) && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                      color: paymentColors[order.paymentStatus] || "#666",
                      background: `${paymentColors[order.paymentStatus] || "#666"}18`,
                    }}>
                      💰 {paymentLabels[order.paymentStatus] || order.paymentStatus}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                {order.items?.map((item: any, i: number) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                    <div style={{ flex: 1 }}>
                      <span>{item.quantity}× {item.productName || item.product?.name}</span>
                      {item.customerNote && <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 2 }}>📝 {item.customerNote}</div>}
                    </div>
                    <span style={{ fontWeight: 600 }}>{Number(item.totalPrice).toFixed(2)} ₺</span>
                  </div>
                ))}
              </div>

              {order.note && (
                <div style={{ padding: "8px 12px", background: "rgba(245,158,11,0.08)", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                  <strong>Sipariş Notu:</strong> {order.note}
                </div>
              )}
              {order.cancelReason && (
                <div style={{ padding: "8px 12px", background: "rgba(239,68,68,0.08)", color: "#fca5a5", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                  <strong>{order.status === "REJECTED" ? "Red Nedeni:" : "İptal Nedeni:"}</strong> {order.cancelReason}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: "var(--primary-light)" }}>
                  Toplam: {Number(order.totalPrice).toFixed(2)} ₺
                </span>
                {!["CANCELLED", "SERVED", "REJECTED"].includes(order.status) && (
                  <button onClick={() => { setSelectedOrder(order); setShowCancelModal(true); setCancelReason(""); }} className="btn btn-sm btn-danger" style={{ fontSize: 12 }}>
                    ❌ İptal Et
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
