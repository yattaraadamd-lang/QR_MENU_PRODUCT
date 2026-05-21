"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

type Order = {
  id: string;
  table: { tableNumber: string; tableName: string | null };
  totalPrice: number;
  note: string | null;
  status: string;
  createdAt: string;
  cancelReason: string | null;
  waiter: { id: string; name: string } | null;
  items: Array<{
    product: { name: string };
    productName: string;
    quantity: number;
    unitPrice: number;
    customerNote: string | null;
  }>;
};

const STATUS_META: Record<string, { label: string; badge: string; color: string }> = {
  PENDING:   { label: "Bekliyor",      badge: "badge-warning", color: "#f59e0b" },
  ACCEPTED:  { label: "Kabul Edildi",  badge: "badge-info",    color: "#3b82f6" },
  PREPARING: { label: "Hazırlanıyor",  badge: "badge-primary", color: "var(--primary)" },
  SERVED:    { label: "Servis Edildi", badge: "badge-success", color: "#10b981" },
  CANCELLED: { label: "İptal",         badge: "badge-danger",  color: "#ef4444" },
  REJECTED:  { label: "Reddedildi",    badge: "badge-danger",  color: "#ef4444" },
};

// Relative time helper
function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}sn önce`;
  if (diff < 3600) return `${Math.floor(diff / 60)}dk önce`;
  return new Date(dateStr).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export default function WaiterOrdersPage() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active");
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  // ✅ İptal modal state
  const [cancelModal, setCancelModal] = useState<{ id: string; tableName: string } | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/waiter/orders?status=${filter}`);
      const data = await res.json();
      if (res.ok) setOrders(data.orders || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => {
    if (session?.user.businessId) {
      fetchOrders();
      const iv = setInterval(fetchOrders, 6000);
      return () => clearInterval(iv);
    }
  }, [session, fetchOrders]);

  // Socket.IO real-time
  useEffect(() => {
    if (!session?.user.businessId) return;
    const { connectToBusinessRoom } = require("@/lib/socket-client");
    const socket = connectToBusinessRoom(session.user.businessId);
    socket.on("new_order", fetchOrders);
    socket.on("order_status_update", fetchOrders);
    return () => { socket.off("new_order"); socket.off("order_status_update"); };
  }, [session, fetchOrders]);

  const updateStatus = async (orderId: string, status: string, cancelReason?: string) => {
    try {
      const res = await fetch(`/api/waiter/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, cancelReason }),
      });
      if (res.ok) fetchOrders();
    } catch (e) { console.error(e); }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    await updateStatus(rejectModal.id, "REJECTED", rejectReason || "Garson tarafından reddedildi");
    setRejectModal(null);
    setRejectReason("");
  };

  // ✅ Sipariş iptal
  const handleCancel = async () => {
    if (!cancelModal) return;
    await updateStatus(cancelModal.id, "CANCELLED", cancelReason || "Garson tarafından iptal edildi");
    setCancelModal(null);
    setCancelReason("");
  };

  const pendingCount = orders.filter(o => o.status === "PENDING").length;

  return (
    <div>
      {/* Reject Modal */}
      {rejectModal && (
        <div className="modal-overlay" onClick={() => setRejectModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: 24, maxWidth: 360 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Siparişi Reddet</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>Red nedeni belirtin (opsiyonel):</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {["Ürün stokta yok", "Masa doğrulanamadı", "İşletme sipariş almıyor", "Diğer"].map(r => (
                <button key={r} onClick={() => setRejectReason(r)} style={{
                  padding: "9px 14px", borderRadius: 9, textAlign: "left", fontSize: 13,
                  border: `1.5px solid ${rejectReason === r ? "var(--primary)" : "var(--border-color)"}`,
                  background: rejectReason === r ? "var(--primary-glow)" : "transparent",
                  color: rejectReason === r ? "var(--primary-light)" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{rejectReason === r ? "✓ " : ""}{r}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleReject} className="btn btn-danger" style={{ flex: 1 }}>Reddet</button>
              <button onClick={() => setRejectModal(null)} className="btn btn-ghost">İptal</button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ İptal Modal */}
      {cancelModal && (
        <div className="modal-overlay" onClick={() => { setCancelModal(null); setCancelReason(""); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: 24, maxWidth: 360 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>❌ Siparişi İptal Et</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
              <strong style={{ color: "var(--text-primary)" }}>{cancelModal.tableName}</strong> — İptal nedeni belirtin:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {["Müşteri vazgeçti", "Ürün stokta yok", "Yanlış sipariş", "Diğer"].map(r => (
                <button key={r} onClick={() => setCancelReason(r)} style={{
                  padding: "9px 14px", borderRadius: 9, textAlign: "left", fontSize: 13,
                  border: `1.5px solid ${cancelReason === r ? "#ef4444" : "var(--border-color)"}`,
                  background: cancelReason === r ? "rgba(239,68,68,0.08)" : "transparent",
                  color: cancelReason === r ? "#fca5a5" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{cancelReason === r ? "✓ " : ""}{r}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleCancel} disabled={!cancelReason} className="btn btn-danger" style={{ flex: 1, opacity: !cancelReason ? 0.5 : 1 }}>
                Siparişi İptal Et
              </button>
              <button onClick={() => { setCancelModal(null); setCancelReason(""); }} className="btn btn-ghost">Vazgeç</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ fontSize: 19, fontWeight: 800 }}>Siparişler</h2>
          {pendingCount > 0 && filter === "active" && (
            <span style={{
              background: "#ef4444", color: "white", borderRadius: 99,
              fontSize: 11, fontWeight: 800, padding: "2px 8px",
              animation: "pulse-glow 2s infinite",
            }}>{pendingCount} yeni</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setFilter("active")} className={`btn btn-sm ${filter === "active" ? "btn-primary" : "btn-ghost"}`}>Aktif</button>
          <button onClick={() => setFilter("completed")} className={`btn btn-sm ${filter === "completed" ? "btn-primary" : "btn-ghost"}`}>Geçmiş</button>
        </div>
      </div>

      {/* Orders */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 14 }} />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            {filter === "active" ? "Bekleyen sipariş yok" : "Geçmiş sipariş yok"}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {orders.map(order => {
            const sm = STATUS_META[order.status] || STATUS_META.PENDING;
            const isPending = order.status === "PENDING";
            return (
              <div key={order.id} className="card animate-fade-in" style={{
                padding: 0, overflow: "hidden",
                borderLeft: isPending ? `3px solid ${sm.color}` : "1px solid var(--border-color)",
              }}>
                {/* Card header */}
                <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border-subtle)" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>
                        {order.table?.tableName || `Masa ${order.table?.tableNumber}`}
                      </span>
                      <span className={`badge ${sm.badge}`}>{sm.label}</span>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 3 }}>
                      {timeAgo(order.createdAt)}
                      {order.waiter && ` · 👤 ${order.waiter.name}`}
                    </p>
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 16, color: "var(--primary-light)" }}>
                    {Number(order.totalPrice).toFixed(2)} ₺
                  </span>
                </div>

                {/* Items */}
                <div style={{ padding: "10px 16px" }}>
                  {order.items.map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                      <span style={{ color: "var(--text-secondary)" }}>
                        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{item.quantity}×</span>{" "}
                        {item.productName || item.product?.name}
                        {item.customerNote && (
                          <span style={{ color: "#f59e0b", fontSize: 11, marginLeft: 6 }}>📝 {item.customerNote}</span>
                        )}
                      </span>
                      <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>
                        {(Number(item.unitPrice) * item.quantity).toFixed(2)} ₺
                      </span>
                    </div>
                  ))}
                  {order.note && (
                    <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(245,158,11,0.08)", borderRadius: 8, fontSize: 12, color: "#fcd34d" }}>
                      📝 {order.note}
                    </div>
                  )}
                  {order.cancelReason && (
                    <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(239,68,68,0.08)", borderRadius: 8, fontSize: 12, color: "#fca5a5" }}>
                      ❌ {order.cancelReason}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {!["SERVED", "CANCELLED", "REJECTED"].includes(order.status) && (
                  <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8 }}>
                    {order.status === "PENDING" && (
                      <>
                        <button onClick={() => updateStatus(order.id, "ACCEPTED")} className="btn btn-sm btn-success" style={{ flex: 1 }}>
                          ✓ Kabul Et
                        </button>
                        <button onClick={() => setRejectModal({ id: order.id })} className="btn btn-sm btn-danger" style={{ flex: 1 }}>
                          ✕ Reddet
                        </button>
                      </>
                    )}
                    {order.status === "ACCEPTED" && (
                      <>
                        <button onClick={() => updateStatus(order.id, "PREPARING")} className="btn btn-sm btn-primary" style={{ flex: 1 }}>
                          👨‍🍳 Hazırlanıyor
                        </button>
                        {/* ✅ İptal butonu — ACCEPTED durumunda */}
                        <button
                          onClick={() => setCancelModal({ id: order.id, tableName: order.table?.tableName || `Masa ${order.table?.tableNumber}` })}
                          className="btn btn-sm btn-ghost"
                          style={{ color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}
                        >
                          ✕
                        </button>
                      </>
                    )}
                    {order.status === "PREPARING" && (
                      <>
                        <button onClick={() => updateStatus(order.id, "SERVED")} className="btn btn-sm btn-success" style={{ flex: 1 }}>
                          🍽️ Servis Edildi
                        </button>
                        {/* ✅ İptal butonu — PREPARING durumunda */}
                        <button
                          onClick={() => setCancelModal({ id: order.id, tableName: order.table?.tableName || `Masa ${order.table?.tableNumber}` })}
                          className="btn btn-sm btn-ghost"
                          style={{ color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
