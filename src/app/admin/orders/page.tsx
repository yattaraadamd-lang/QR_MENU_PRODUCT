"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Dialog from "@/components/ui/Dialog";
import { formatTRY } from "@/lib/format";

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
// color: metin (≥4.5:1), bg: aynı tonun saydam zemini
const paymentColors: Record<string, { color: string; bg: string }> = {
  UNPAID:            { color: "#F4A623",            bg: "rgba(244,166,35,0.09)" },
  PAYMENT_REQUESTED: { color: "var(--purple-text)", bg: "rgba(163,71,122,0.09)" },
  PAID:              { color: "#3BA55C",            bg: "rgba(59,165,92,0.09)" },
  CANCELLED:         { color: "var(--danger-text)", bg: "rgba(239,68,68,0.09)" },
};
const paymentFallback = { color: "var(--text-secondary)", bg: "var(--bg-hover)" };

// Sekme tanımları — badgeColor: metin (≥4.5:1), badgeBg: saydam zemin
const TABS = [
  { key: "all",      label: "Tümü",           badgeColor: null,                  badgeBg: null },
  { key: "active",   label: "Aktif",           badgeColor: "#F4A623",            badgeBg: "rgba(244,166,35,0.13)" },
  { key: "pending_payment", label: "Bekleyen Ödeme", badgeColor: "var(--purple-text)", badgeBg: "rgba(163,71,122,0.13)" },
  { key: "completed",label: "Tamamlanan",      badgeColor: "#3BA55C",            badgeBg: "rgba(59,165,92,0.13)" },
  { key: "cancelled",label: "İptal Edilen",    badgeColor: "var(--danger-text)", badgeBg: "rgba(239,68,68,0.13)" },
] as const;

type TabKey = typeof TABS[number]["key"];

const REASON_OPTIONS = [
  { code: "OUT_OF_STOCK", label: "Ürün stokta yok" },
  { code: "CUSTOMER_CANCELLED", label: "Müşteri vazgeçti" },
  { code: "WRONG_ORDER", label: "Yanlış sipariş" },
  { code: "TABLE_NOT_VERIFIED", label: "Masa doğrulanamadı" },
  { code: "BUSINESS_NOT_ACCEPTING", label: "İşletme sipariş almıyor" },
  { code: "OTHER", label: "Diğer" },
] as const;

type ReasonCode = typeof REASON_OPTIONS[number]["code"];

export default function AdminOrdersPage() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TabKey>("all");
  
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedReasonCode, setSelectedReasonCode] = useState<ReasonCode | null>(null);
  const [cancelReasonText, setCancelReasonText] = useState("");
  const [selectedOutOfStockPids, setSelectedOutOfStockPids] = useState<string[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  // Hata modalın içinde gösterilir: toast açık <dialog>'un arkasında kalırdı
  const [cancelError, setCancelError] = useState<string | null>(null);

  const businessId = session?.user.businessId;

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders?businessId=${businessId}`);
      const data = await res.json();
      if (res.ok) setOrders(data.orders || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [businessId]);

  // session nesnesine değil businessId'ye bağlı: oturum her yenilendiğinde aralık yeniden kurulmasın
  useEffect(() => {
    if (!businessId) return;
    fetchOrders();
    const iv = setInterval(fetchOrders, 10000);
    return () => clearInterval(iv);
  }, [businessId, fetchOrders]);

  const getUniqueOrderProducts = (order: any) => {
    if (!order || !order.items) return [];
    const map = new Map<string, string>();
    order.items.forEach((item: any) => {
      const pid = item.productId || item.product?.id;
      if (pid) {
        map.set(pid, item.productName || item.product?.name || "Bilinmeyen Ürün");
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  };

  const handleSelectReasonCode = (code: ReasonCode) => {
    setSelectedReasonCode(code);
    setCancelError(null);
    if (code === "OUT_OF_STOCK" && selectedOrder) {
      const prods = getUniqueOrderProducts(selectedOrder);
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

  const resetCancelState = () => {
    setShowCancelModal(false);
    setSelectedOrder(null);
    setSelectedReasonCode(null);
    setCancelReasonText("");
    setSelectedOutOfStockPids([]);
    setCancelError(null);
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder || !selectedReasonCode) return;

    if (selectedReasonCode === "OUT_OF_STOCK" && selectedOutOfStockPids.length === 0) {
      setCancelError("Lütfen stok dışı kalan en az bir ürün seçin.");
      return;
    }
    if (selectedReasonCode === "OTHER" && !cancelReasonText.trim()) {
      setCancelError("Lütfen iptal nedeni açıklamasını girin.");
      return;
    }

    setCancelError(null);
    setCancellingId(selectedOrder.id);
    const selectedOption = REASON_OPTIONS.find(o => o.code === selectedReasonCode);
    const reasonLabel = selectedOption?.label || selectedReasonCode;
    const finalReason = selectedReasonCode === "OTHER"
      ? cancelReasonText.trim()
      : (cancelReasonText.trim() ? `${reasonLabel}: ${cancelReasonText.trim()}` : reasonLabel);

    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}/cancel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reasonCode: selectedReasonCode,
          cancelReason: finalReason,
          outOfStockProductIds: selectedReasonCode === "OUT_OF_STOCK" ? selectedOutOfStockPids : null,
        }),
      });
      if (res.ok) {
        fetchOrders();
        resetCancelState();
      } else {
        const d = await res.json();
        setCancelError(d.error || "İptal edilemedi");
      }
    } catch {
      setCancelError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setCancellingId(null);
    }
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
                  // Aktif sekmede: koyulaştırılmış zemin, beyaz metin (≥4.5:1)
                  // Pasif sekmede: renkli saydam zemin, renkli metin
                  background: isActive
                    ? "rgba(0,0,0,0.22)"
                    : (tab.badgeBg || "var(--bg-hover)"),
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
          padding: "12px 16px", background: "rgba(163,71,122,0.08)",
          border: "1px solid rgba(163,71,122,0.2)", borderRadius: 10,
          marginBottom: 16, fontSize: 13, color: "#EBAFD0",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          💳 Bu siparişler servis edilmiş ancak henüz ödeme alınmamış. Ödeme almak için admin/kasa panelinden işlem yapın.
        </div>
      )}

      {/* İptal Modal */}
      {showCancelModal && selectedOrder && (() => {
        const uniqueProducts = getUniqueOrderProducts(selectedOrder);
        const isSubmitting = cancellingId === selectedOrder.id;

        let isSubmitDisabled = !selectedReasonCode || isSubmitting;
        if (selectedReasonCode === "OUT_OF_STOCK" && selectedOutOfStockPids.length === 0) {
          isSubmitDisabled = true;
        }
        if (selectedReasonCode === "OTHER" && !cancelReasonText.trim()) {
          isSubmitDisabled = true;
        }

        return (
          <Dialog onClose={() => !isSubmitting && resetCancelState()} contentStyle={{ padding: 24, maxWidth: 440, width: "90vw" }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Siparişi İptal Et</h3>
              <div style={{ marginBottom: 16, padding: 12, background: "var(--bg-secondary)", borderRadius: 8 }}>
                <p style={{ fontSize: 14, marginBottom: 4 }}><strong>Masa:</strong> {selectedOrder.table?.tableName || `Masa ${selectedOrder.table?.tableNumber}`}</p>
                <p style={{ fontSize: 14, marginBottom: 4 }}><strong>Toplam:</strong> {formatTRY(selectedOrder.totalPrice)}</p>
                <p style={{ fontSize: 14 }}><strong>Durum:</strong> {statusLabels[selectedOrder.status]}</p>
              </div>

              {/* Neden Seçenekleri */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {REASON_OPTIONS.map(opt => {
                  const isSelected = selectedReasonCode === opt.code;
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => handleSelectReasonCode(opt.code)}
                      style={{
                        padding: "10px 14px", borderRadius: 9, textAlign: "left", fontSize: 13,
                        border: `1.5px solid ${isSelected ? "#ef4444" : "var(--border-color)"}`,
                        background: isSelected ? "rgba(239,68,68,0.08)" : "transparent",
                        color: isSelected ? "var(--danger-text)" : "var(--text-secondary)",
                        cursor: "pointer", fontWeight: isSelected ? 600 : 400,
                      }}
                    >
                      {isSelected ? "✓ " : ""}{opt.label}
                    </button>
                  );
                })}
              </div>

              {/* OUT_OF_STOCK Ürün Seçimi */}
              {selectedReasonCode === "OUT_OF_STOCK" && (
                <div style={{ marginBottom: 16, padding: 12, background: "rgba(244,166,35,0.08)", borderRadius: 10, border: "1px solid rgba(244,166,35,0.25)" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--primary-light)", marginBottom: 8 }}>
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
                  <p style={{ fontSize: 11, color: "var(--danger-text)", marginTop: 8, fontWeight: 600 }}>
                    ⚠️ Seçilen ürünler stokta yok olarak işaretlenecek ve müşteriler sipariş veremeyecektir.
                  </p>
                </div>
              )}

              {/* Açıklama alanı */}
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="f-iptal-aciklama" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Açıklama {selectedReasonCode === "OTHER" ? "*" : "(Opsiyonel)"}
                </label>
                <textarea
                  id="f-iptal-aciklama"
                  className="input"
                  value={cancelReasonText}
                  onChange={e => setCancelReasonText(e.target.value)}
                  placeholder="İptal nedenini detaylandırın..."
                  style={{ height: 70, resize: "none", width: "100%" }}
                  data-autofocus={selectedReasonCode === "OTHER" || undefined}
                />
              </div>

              {cancelError && (
                <p role="alert" style={{ marginBottom: 12, fontSize: 13, fontWeight: 600, color: "var(--danger-text)" }}>
                  {cancelError}
                </p>
              )}
              <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, marginBottom: 16, fontSize: 13, color: "#fca5a5" }}>
                ⚠️ Bu işlem geri alınamaz.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleCancelOrder}
                  disabled={isSubmitDisabled}
                  className="btn btn-danger"
                  style={{ flex: 1, opacity: isSubmitDisabled ? 0.5 : 1 }}
                >
                  {isSubmitting ? "İptal Ediliyor..." : "Siparişi İptal Et"}
                </button>
                <button onClick={resetCancelState} disabled={isSubmitting} className="btn btn-ghost">
                  Vazgeç
                </button>
              </div>
            </Dialog>
        );
      })()}

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
        <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
                      color: (paymentColors[order.paymentStatus] || paymentFallback).color,
                      background: (paymentColors[order.paymentStatus] || paymentFallback).bg,
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
                      {item.customerNote && <div style={{ fontSize: 11, color: "#F4A623", marginTop: 2 }}>📝 {item.customerNote}</div>}
                    </div>
                    <span style={{ fontWeight: 600 }}>{formatTRY(item.totalPrice)}</span>
                  </div>
                ))}
              </div>

              {order.note && (
                <div style={{ padding: "8px 12px", background: "rgba(244,166,35,0.08)", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
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
                  Toplam: {formatTRY(order.totalPrice)}
                </span>
                {!["CANCELLED", "SERVED", "REJECTED"].includes(order.status) && (
                  <button onClick={() => { setSelectedOrder(order); setSelectedReasonCode(null); setCancelReasonText(""); setSelectedOutOfStockPids([]); setShowCancelModal(true); }} className="btn btn-sm btn-danger" style={{ fontSize: 12 }}>
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
