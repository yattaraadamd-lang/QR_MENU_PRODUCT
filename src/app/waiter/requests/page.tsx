"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { connectToBusinessRoom } from "@/lib/socket-client";

const TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  CALL_WAITER:         { label: "Garson Çağrısı",  icon: "🙋", color: "#ef4444" },
  PAYMENT_REQUEST:     { label: "Ödeme Talebi",    icon: "💳", color: "#8b5cf6" },
  HELP_REQUEST:        { label: "Yardım Talebi",   icon: "ℹ️", color: "#3b82f6" },
  CLEANING_REQUEST:    { label: "Temizlik",         icon: "🧹", color: "#06b6d4" },
  ORDER_REQUEST:       { label: "Sipariş Talebi",  icon: "📋", color: "#f59e0b" },
  PRODUCT_INFO:        { label: "Ürün Bilgisi",    icon: "❓", color: "#10b981" },
  COMPLAINT_SUGGESTION:{ label: "Şikayet/Öneri",   icon: "💬", color: "#6366f1" },
};

const STATUS_META: Record<string, { label: string; badge: string }> = {
  PENDING:     { label: "Bekliyor",   badge: "badge-warning" },
  SEEN:        { label: "Görüldü",    badge: "badge-info" },
  IN_PROGRESS: { label: "İşlemde",   badge: "badge-primary" },
  COMPLETED:   { label: "Tamamlandı",badge: "badge-success" },
  CANCELLED:   { label: "İptal",     badge: "badge-neutral" },
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}sn önce`;
  if (diff < 3600) return `${Math.floor(diff / 60)}dk önce`;
  return new Date(dateStr).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

export default function WaiterRequestsPage() {
  const { data: session } = useSession();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active");
  const [openingTable, setOpeningTable] = useState<string | null>(null);

  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({});
  const [rejectingRequest, setRejectingRequest] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch(`/api/waiter/service-requests?status=${filter}`);
      const data = await res.json();
      if (res.ok) setRequests(data.serviceRequests || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => {
    if (session?.user.businessId) {
      fetchRequests();
      const iv = setInterval(fetchRequests, 5000);
      return () => clearInterval(iv);
    }
  }, [session, fetchRequests]);

  // ✅ Socket.IO
  useEffect(() => {
    if (!session?.user.businessId) return;
    const socket = connectToBusinessRoom(session.user.businessId, fetchRequests);
    const events = ["call_waiter", "payment_request", "help_request", "service_request", "order_request_update", "table_opened"];
    events.forEach((ev) => socket.on(ev, fetchRequests));
    return () => {
      events.forEach((ev) => socket.off(ev, fetchRequests));
    };
  }, [session, fetchRequests]);

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/waiter/service-requests/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) fetchRequests();
    } catch (e) { console.error(e); }
  };

  // ✅ Atomik Masa Açma — doğrulama kodu ile
  const openTable = async (req: any) => {
    if (!session?.user.businessId || !req.tableId) return;
    const code = codeInputs[req.id]?.trim();
    if (!code || code.length !== 6) {
      alert("Lütfen 6 haneli doğrulama kodunu girin.");
      return;
    }
    setOpeningTable(req.id);
    try {
      const res = await fetch(`/api/waiter/service-requests/${req.id}/open-table`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationCode: code }),
      });
      const data = await res.json();
      if (res.ok) {
        setCodeInputs((prev) => {
          const next = { ...prev };
          delete next[req.id];
          return next;
        });
        fetchRequests();
      } else {
        alert(data.error || "Masa açma hatası");
      }
    } catch (e) {
      console.error("Masa açma hatası:", e);
      alert("Bağlantı hatası");
    } finally {
      setOpeningTable(null);
    }
  };

  // ✅ Sipariş Talebi Reddetme ve Cihaz Engelleme
  const rejectOrderRequest = async (req: any) => {
    const confirmed = window.confirm(
      "Masada müşteri bulunmadığını ve bu cihazın işletmede engelleneceğini onaylıyor musunuz?"
    );
    if (!confirmed) return;

    setRejectingRequest(req.id);
    try {
      const res = await fetch(`/api/waiter/service-requests/${req.id}/reject-order-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "EMPTY_TABLE_ABUSE" }),
      });
      const data = await res.json();
      if (res.ok) {
        fetchRequests();
      } else {
        alert(data.error || "Sipariş talebi reddedilemedi");
      }
    } catch (e) {
      console.error("Reddetme hatası:", e);
      alert("Bağlantı hatası");
    } finally {
      setRejectingRequest(null);
    }
  };

  const pendingCount = requests.filter(r => r.status === "PENDING").length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ fontSize: 19, fontWeight: 800 }}>Talepler</h2>
          {pendingCount > 0 && filter === "active" && (
            <span style={{
              background: "#ef4444", color: "white", borderRadius: 99,
              fontSize: 11, fontWeight: 800, padding: "2px 8px",
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
                color: "white",
                borderRadius: 99,
                fontSize: 10,
                fontWeight: 800,
                padding: "1px 6px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                {pendingCount}
              </span>
            )}
          </button>
          <button onClick={() => setFilter("completed")} className={`btn btn-sm ${filter === "completed" ? "btn-primary" : "btn-ghost"}`}>Geçmiş</button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 14 }} />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            {filter === "active" ? "Bekleyen talep yok" : "Geçmiş talep yok"}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {requests.map(req => {
            const tm = TYPE_META[req.requestType] || { label: req.requestType, icon: "📌", color: "#6366f1" };
            const sm = STATUS_META[req.status] || STATUS_META.PENDING;
            const isPending = req.status === "PENDING";
            const isOrder = req.requestType === "ORDER_REQUEST";
            const expired = isExpired(req.expiresAt);

            return (
              <div key={req.id} className="card animate-fade-in" style={{
                padding: 0, overflow: "hidden",
                borderLeft: isPending ? `3px solid ${tm.color}` : "1px solid var(--border-color)",
              }}>
                <div style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                        background: `${tm.color}18`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 18,
                      }}>{tm.icon}</span>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 14 }}>{tm.label}</p>
                        <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 1 }}>
                          {req.table?.tableName || `Masa ${req.table?.tableNumber}`} · {timeAgo(req.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {expired && isPending && (
                        <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>⏰ Süresi Doldu</span>
                      )}
                      <span className={`badge ${sm.badge}`}>{sm.label}</span>
                    </div>
                  </div>

                  {/* Ürün Özeti — ORDER_REQUEST için */}
                  {isOrder && req.orderPreview && (
                    <div style={{
                      padding: "10px 12px", marginTop: 8,
                      background: "rgba(245,158,11,0.06)", borderRadius: 10,
                      border: "1px solid rgba(245,158,11,0.2)", fontSize: 13,
                    }}>
                      <p style={{ fontWeight: 700, marginBottom: 6, color: "var(--text-primary)", fontSize: 12 }}>
                        📋 Ürün Özeti:
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {req.orderPreview.items?.map((item: any, idx: number) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                            <span>
                              <strong>{item.quantity}x</strong> {item.name}
                              {item.note ? <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>({item.note})</span> : null}
                            </span>
                            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                              {(Number(item.unitPrice || 0) * Number(item.quantity || 1)).toFixed(2)} ₺
                            </span>
                          </div>
                        ))}
                      </div>
                      <div style={{
                        display: "flex", justifyContent: "space-between", marginTop: 6, paddingTop: 6,
                        borderTop: "1px dashed rgba(245,158,11,0.3)", fontWeight: 800, fontSize: 13
                      }}>
                        <span>Tahmini Toplam:</span>
                        <span style={{ color: "#d97706" }}>{Number(req.orderPreview.total || 0).toFixed(2)} ₺</span>
                      </div>
                      {req.orderPreview.orderNote && (
                        <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4, fontStyle: "italic" }}>
                          Not: {req.orderPreview.orderNote}
                        </p>
                      )}
                    </div>
                  )}

                  {req.note && !isOrder && (
                    <div style={{ padding: "6px 10px", background: "rgba(245,158,11,0.08)", borderRadius: 8, fontSize: 12, color: "#fcd34d", marginTop: 6 }}>
                      📝 {req.note}
                    </div>
                  )}

                  {/* 6 Haneli Doğrulama Kodu Girişi — ORDER_REQUEST için */}
                  {isOrder && isPending && !expired && (
                    <div style={{ marginTop: 10 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                        🔑 Müşteri Doğrulama Kodu (6 Haneli):
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="Örn: 482913"
                        value={codeInputs[req.id] || ""}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          setCodeInputs((prev) => ({ ...prev, [req.id]: val }));
                        }}
                        style={{
                          width: "100%", padding: "8px 12px", borderRadius: 8,
                          border: "1px solid var(--border-color)", background: "var(--bg-card)",
                          fontSize: 18, fontWeight: 900, letterSpacing: "0.2em", textAlign: "center",
                          fontFamily: "monospace", color: "var(--text-primary)",
                        }}
                      />
                    </div>
                  )}

                  {isOrder ? (
                    /* ✅ ORDER_REQUEST: yalnız Masayı Aç ve Reddet */
                    isPending && !expired && (
                      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        <button
                          onClick={() => openTable(req)}
                          disabled={openingTable === req.id || !(codeInputs[req.id] && codeInputs[req.id].length === 6)}
                          className="btn btn-sm"
                          style={{
                            flex: 2,
                            background: "linear-gradient(135deg, #059669, #047857)",
                            color: "white",
                            border: "none",
                            opacity: (openingTable === req.id || !(codeInputs[req.id] && codeInputs[req.id].length === 6)) ? 0.5 : 1,
                            cursor: (openingTable === req.id || !(codeInputs[req.id] && codeInputs[req.id].length === 6)) ? "not-allowed" : "pointer",
                          }}
                        >
                          {openingTable === req.id ? "⏳ Açılıyor..." : "🔓 Masayı Aç"}
                        </button>
                        <button
                          onClick={() => rejectOrderRequest(req)}
                          disabled={rejectingRequest === req.id}
                          className="btn btn-sm btn-ghost"
                          style={{ color: "#ef4444", fontWeight: 700 }}
                        >
                          {rejectingRequest === req.id ? "⏳..." : "🛑 Reddet"}
                        </button>
                      </div>
                    )
                  ) : (
                    /* ✅ Normal hizmet talepleri: İşleme Al → Tamamla → İptal */
                    ["PENDING", "SEEN", "IN_PROGRESS"].includes(req.status) && (
                      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        {req.status === "PENDING" && (
                          <button onClick={() => updateStatus(req.id, "IN_PROGRESS")} className="btn btn-sm btn-primary" style={{ flex: 1 }}>
                            ▶ İşleme Al
                          </button>
                        )}
                        {(req.status === "IN_PROGRESS" || req.status === "SEEN") && (
                          <button onClick={() => updateStatus(req.id, "COMPLETED")} className="btn btn-sm btn-success" style={{ flex: req.status === "PENDING" ? 1 : 2 }}>
                            ✓ Tamamla
                          </button>
                        )}
                        <button onClick={() => updateStatus(req.id, "CANCELLED")} className="btn btn-sm btn-ghost" style={{ color: "#ef4444" }}>
                          ✕
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
