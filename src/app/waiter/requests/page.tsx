"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

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

export default function WaiterRequestsPage() {
  const { data: session } = useSession();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active");

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

  // Socket.IO
  useEffect(() => {
    if (!session?.user.businessId) return;
    const { connectToBusinessRoom } = require("@/lib/socket-client");
    const socket = connectToBusinessRoom(session.user.businessId);
    ["call_waiter", "payment_request", "help_request", "service_request"].forEach(ev => {
      socket.on(ev, fetchRequests);
    });
    return () => {
      ["call_waiter", "payment_request", "help_request", "service_request"].forEach(ev => socket.off(ev));
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
          <button onClick={() => setFilter("active")} className={`btn btn-sm ${filter === "active" ? "btn-primary" : "btn-ghost"}`}>Aktif</button>
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
                    <span className={`badge ${sm.badge}`}>{sm.label}</span>
                  </div>

                  {req.note && (
                    <div style={{ padding: "6px 10px", background: "rgba(245,158,11,0.08)", borderRadius: 8, fontSize: 12, color: "#fcd34d", marginTop: 6 }}>
                      📝 {req.note}
                    </div>
                  )}

                  {["PENDING", "SEEN", "IN_PROGRESS"].includes(req.status) && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      {req.status === "PENDING" && (
                        <button onClick={() => updateStatus(req.id, "IN_PROGRESS")} className="btn btn-sm btn-primary" style={{ flex: 1 }}>
                          ▶ İşleme Al
                        </button>
                      )}
                      <button onClick={() => updateStatus(req.id, "COMPLETED")} className="btn btn-sm btn-success" style={{ flex: req.status === "PENDING" ? 1 : 2 }}>
                        ✓ Tamamla
                      </button>
                      <button onClick={() => updateStatus(req.id, "CANCELLED")} className="btn btn-sm btn-ghost" style={{ color: "#ef4444" }}>
                        ✕
                      </button>
                    </div>
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
