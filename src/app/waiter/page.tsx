"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { connectToBusinessRoom } from "@/lib/socket-client";
import { toast } from "sonner";
import { Check, X, ChefHat, UtensilsCrossed, Clock, AlertTriangle, Loader2, ClipboardList } from "lucide-react";

type OrderItem = {
  id?: string;
  productId?: string;
  product?: { id?: string; name: string };
  productName: string;
  quantity: number;
  unitPrice: number;
  customerNote: string | null;
};

type Order = {
  id: string;
  table: { tableNumber: string; tableName: string | null };
  totalPrice: number;
  note: string | null;
  status: string;
  createdAt: string;
  cancelReason: string | null;
  waiter: { id: string; name: string } | null;
  items: OrderItem[];
};

const REASON_OPTIONS = [
  { code: "OUT_OF_STOCK", label: "Ürün stokta yok" },
  { code: "CUSTOMER_CANCELLED", label: "Müşteri vazgeçti" },
  { code: "WRONG_ORDER", label: "Yanlış sipariş" },
  { code: "TABLE_NOT_VERIFIED", label: "Masa doğrulanamadı" },
  { code: "BUSINESS_NOT_ACCEPTING", label: "İşletme sipariş almıyor" },
  { code: "OTHER", label: "Diğer" },
] as const;

type ReasonCode = typeof REASON_OPTIONS[number]["code"];

const STATUS_META: Record<string, { label: string; badge: string; color: string; icon: React.ReactNode }> = {
  PENDING:   { label: "Bekliyor",      badge: "badge-warning", color: "#f59e0b", icon: <Clock size={14} /> },
  ACCEPTED:  { label: "Kabul Edildi",  badge: "badge-info",    color: "#3b82f6", icon: <Check size={14} /> },
  PREPARING: { label: "Hazırlanıyor",  badge: "badge-primary", color: "var(--primary)", icon: <ChefHat size={14} /> },
  SERVED:    { label: "Servis Edildi", badge: "badge-success", color: "#10b981", icon: <UtensilsCrossed size={14} /> },
  CANCELLED: { label: "İptal",         badge: "badge-danger",  color: "#ef4444", icon: <X size={14} /> },
  REJECTED:  { label: "Reddedildi",    badge: "badge-danger",  color: "#ef4444", icon: <AlertTriangle size={14} /> },
};

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
  
  // Modal states
  const [rejectModal, setRejectModal] = useState<Order | null>(null);
  const [cancelModal, setCancelModal] = useState<Order | null>(null);
  
  const [selectedReasonCode, setSelectedReasonCode] = useState<ReasonCode | null>(null);
  const [customReasonText, setCustomReasonText] = useState("");
  const [selectedOutOfStockPids, setSelectedOutOfStockPids] = useState<string[]>([]);
  
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/waiter/orders?status=${filter}`);
      if (res.status === 401) {
        // Session expired — redirect to login
        window.location.href = "/auth/signin";
        return;
      }
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

  useEffect(() => {
    if (!session?.user.businessId) return;
    const socket = connectToBusinessRoom(session.user.businessId, fetchOrders);
    socket.on("new_order", fetchOrders);
    socket.on("order_status_update", fetchOrders);
    return () => {
      socket.off("new_order", fetchOrders);
      socket.off("order_status_update", fetchOrders);
    };
  }, [session, fetchOrders]);

  const updateStatus = async (
    orderId: string,
    status: string,
    payloadExtra?: {
      cancelReason?: string;
      reasonCode?: ReasonCode | null;
      outOfStockProductIds?: string[] | null;
    }
  ): Promise<boolean> => {
    setActionLoading(orderId);
    try {
      const res = await fetch(`/api/waiter/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          cancelReason: payloadExtra?.cancelReason,
          reasonCode: payloadExtra?.reasonCode,
          outOfStockProductIds: payloadExtra?.outOfStockProductIds,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        fetchOrders();
        const labels: Record<string, string> = {
          ACCEPTED: "Sipariş kabul edildi",
          PREPARING: "Hazırlanmaya başlandı",
          SERVED: "Servis edildi",
        };
        if (labels[status]) toast.success(labels[status]);
        return true;
      } else {
        toast.error(data.error || "İşlem başarısız oldu.");
        return false;
      }
    } catch {
      toast.error("Bağlantı hatası. Lütfen tekrar deneyin.");
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const resetModalState = () => {
    setRejectModal(null);
    setCancelModal(null);
    setSelectedReasonCode(null);
    setCustomReasonText("");
    setSelectedOutOfStockPids([]);
  };

  const getUniqueOrderProducts = (order: Order) => {
    const map = new Map<string, string>();
    order.items.forEach(item => {
      const pid = item.productId || item.product?.id;
      if (pid) {
        map.set(pid, item.productName || item.product?.name || "Bilinmeyen Ürün");
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  };

  const handleSelectReasonCode = (order: Order, code: ReasonCode) => {
    setSelectedReasonCode(code);
    if (code === "OUT_OF_STOCK") {
      const prods = getUniqueOrderProducts(order);
      if (prods.length === 1) {
        setSelectedOutOfStockPids([prods[0].id]);
      } else {
        setSelectedOutOfStockPids([]);
      }
    } else {
      setSelectedOutOfStockPids([]);
    }
  };

  const toggleOutOfStockPid = (pid: string) => {
    setSelectedOutOfStockPids(prev =>
      prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]
    );
  };

  const handleConfirmCancelOrReject = async (targetStatus: "CANCELLED" | "REJECTED") => {
    const currentModalOrder = targetStatus === "REJECTED" ? rejectModal : cancelModal;
    if (!currentModalOrder || !selectedReasonCode) return;

    if (selectedReasonCode === "OUT_OF_STOCK" && selectedOutOfStockPids.length === 0) {
      toast.error("Lütfen en az bir stok dışı kalacak ürün seçin.");
      return;
    }

    if (selectedReasonCode === "OTHER" && !customReasonText.trim()) {
      toast.error("Lütfen iptal nedeni açıklamasını yazın.");
      return;
    }

    const selectedOption = REASON_OPTIONS.find(o => o.code === selectedReasonCode);
    const reasonLabel = selectedOption?.label || selectedReasonCode;
    const finalReasonText = selectedReasonCode === "OTHER"
      ? customReasonText.trim()
      : (customReasonText.trim() ? `${reasonLabel}: ${customReasonText.trim()}` : reasonLabel);

    const ok = await updateStatus(currentModalOrder.id, targetStatus, {
      cancelReason: finalReasonText,
      reasonCode: selectedReasonCode,
      outOfStockProductIds: selectedReasonCode === "OUT_OF_STOCK" ? selectedOutOfStockPids : null,
    });

    if (ok) {
      resetModalState();
      toast.info(targetStatus === "REJECTED" ? "Sipariş reddedildi" : "Sipariş iptal edildi");
    }
  };

  const pendingCount = orders.filter(o => o.status === "PENDING").length;

  const renderModalContent = (order: Order, isReject: boolean) => {
    const uniqueProducts = getUniqueOrderProducts(order);
    const isSubmitting = actionLoading === order.id;

    let isSubmitDisabled = !selectedReasonCode || isSubmitting;
    if (selectedReasonCode === "OUT_OF_STOCK" && selectedOutOfStockPids.length === 0) {
      isSubmitDisabled = true;
    }
    if (selectedReasonCode === "OTHER" && !customReasonText.trim()) {
      isSubmitDisabled = true;
    }

    return (
      <div className="modal-overlay" onClick={() => !isSubmitting && resetModalState()}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: 24, maxWidth: 420, width: "90vw" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <AlertTriangle size={20} color="#ef4444" />
            <h3 style={{ fontSize: 18, fontWeight: 700 }}>
              {isReject ? "Siparişi Reddet" : "Siparişi İptal Et"}
            </h3>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
            <strong style={{ color: "var(--text-primary)" }}>{order.table?.tableName || `Masa ${order.table?.tableNumber}`}</strong> — Neden seçin:
          </p>

          {/* Reason code options */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {REASON_OPTIONS.map(opt => {
              const isSelected = selectedReasonCode === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => handleSelectReasonCode(order, opt.code)}
                  style={{
                    padding: "10px 14px", borderRadius: 9, textAlign: "left", fontSize: 13,
                    border: `1.5px solid ${isSelected ? "#ef4444" : "var(--border-color)"}`,
                    background: isSelected ? "rgba(239,68,68,0.08)" : "transparent",
                    color: isSelected ? "#ef4444" : "var(--text-secondary)",
                    cursor: "pointer", fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {isSelected ? "✓ " : ""}{opt.label}
                </button>
              );
            })}
          </div>

          {/* OUT_OF_STOCK Product selection */}
          {selectedReasonCode === "OUT_OF_STOCK" && (
            <div style={{ marginBottom: 16, padding: 12, background: "rgba(245,158,11,0.08)", borderRadius: 10, border: "1px solid rgba(245,158,11,0.25)" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#d97706", marginBottom: 8 }}>
                Stokta olmayan ürünü/ürünleri seçin:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {uniqueProducts.map(p => (
                  <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={selectedOutOfStockPids.includes(p.id)}
                      onChange={() => toggleOutOfStockPid(p.id)}
                      style={{ width: 16, height: 16, accentColor: "#ef4444" }}
                    />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "#ef4444", marginTop: 8, fontWeight: 600 }}>
                ⚠️ Seçilen ürünler stokta yok olarak işaretlenecek ve müşteriler sipariş veremeyecektir.
              </p>
            </div>
          )}

          {/* OTHER optional/required text */}
          {selectedReasonCode === "OTHER" && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                Açıklama *
              </label>
              <textarea
                className="input"
                value={customReasonText}
                onChange={e => setCustomReasonText(e.target.value)}
                placeholder="İptal/red nedenini detaylandırın..."
                style={{ height: 70, resize: "none", width: "100%", fontSize: 13 }}
                autoFocus
              />
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => handleConfirmCancelOrReject(isReject ? "REJECTED" : "CANCELLED")}
              disabled={isSubmitDisabled}
              className="btn btn-danger"
              style={{ flex: 1, opacity: isSubmitDisabled ? 0.5 : 1 }}
            >
              {isSubmitting ? <><Loader2 size={14} className="animate-spin" /> İşleniyor...</> : (isReject ? "Siparişi Reddet" : "Siparişi İptal Et")}
            </button>
            <button
              type="button"
              onClick={resetModalState}
              disabled={isSubmitting}
              className="btn btn-ghost"
            >
              Vazgeç
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Reject Modal */}
      {rejectModal && renderModalContent(rejectModal, true)}

      {/* Cancel Modal */}
      {cancelModal && renderModalContent(cancelModal, false)}

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
          <button
            onClick={() => setFilter("active")}
            className={`btn btn-sm ${filter === "active" ? "btn-primary" : "btn-ghost"}`}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            Aktif
            {pendingCount > 0 && (
              <span style={{
                background: filter === "active" ? "rgba(255,255,255,0.25)" : "#ef4444",
                color: "white", borderRadius: 99, fontSize: 10, fontWeight: 800,
                padding: "1px 6px",
              }}>{pendingCount}</span>
            )}
          </button>
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
          <div style={{ fontSize: 48, marginBottom: 12 }}>
            <ClipboardList size={48} color="var(--text-muted)" strokeWidth={1.5} />
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            {filter === "active" ? "Bekleyen sipariş yok" : "Geçmiş sipariş yok"}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {orders.map(order => {
            const sm = STATUS_META[order.status] || STATUS_META.PENDING;
            const isPending = order.status === "PENDING";
            const isLoading = actionLoading === order.id;
            return (
              <div key={order.id} className="card animate-fade-in" style={{
                padding: 0, overflow: "hidden",
                borderLeft: isPending ? `3px solid ${sm.color}` : "1px solid var(--border-color)",
                opacity: isLoading ? 0.7 : 1,
                transition: "opacity 0.2s",
              }}>
                {/* Card header */}
                <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border-subtle)" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>
                        {order.table?.tableName || `Masa ${order.table?.tableNumber}`}
                      </span>
                      <span className={`badge ${sm.badge}`} style={{ gap: 4 }}>
                        {sm.icon} {sm.label}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={11} />
                      {timeAgo(order.createdAt)}
                      {order.waiter && ` · ${order.waiter.name}`}
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
                        <button onClick={() => updateStatus(order.id, "ACCEPTED")} disabled={isLoading} className="btn btn-sm btn-success" style={{ flex: 1, gap: 4 }}>
                          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Kabul Et
                        </button>
                        <button onClick={() => setRejectModal(order)} disabled={isLoading} className="btn btn-sm btn-danger" style={{ flex: 1, gap: 4 }}>
                          <X size={14} /> Reddet
                        </button>
                      </>
                    )}
                    {order.status === "ACCEPTED" && (
                      <>
                        <button onClick={() => updateStatus(order.id, "PREPARING")} disabled={isLoading} className="btn btn-sm btn-primary" style={{ flex: 1, gap: 4 }}>
                          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <ChefHat size={14} />} Hazırlanıyor
                        </button>
                        <button
                          onClick={() => setCancelModal(order)}
                          disabled={isLoading}
                          className="btn btn-sm btn-ghost"
                          style={{ color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", opacity: isLoading ? 0.6 : 1 }}
                        >
                          <X size={14} />
                        </button>
                      </>
                    )}
                    {order.status === "PREPARING" && (
                      <>
                        <button onClick={() => updateStatus(order.id, "SERVED")} disabled={isLoading} className="btn btn-sm btn-success" style={{ flex: 1, gap: 4 }}>
                          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <UtensilsCrossed size={14} />} Servis Edildi
                        </button>
                        <button
                          onClick={() => setCancelModal(order)}
                          disabled={isLoading}
                          className="btn btn-sm btn-ghost"
                          style={{ color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", opacity: isLoading ? 0.6 : 1 }}
                        >
                          <X size={14} />
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
