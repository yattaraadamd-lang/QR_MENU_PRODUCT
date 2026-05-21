"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const requestTypeLabels: Record<string, string> = {
  CALL_WAITER: "🙋 Garson Çağrısı",
  PAYMENT_REQUEST: "💳 Ödeme Talebi",
  HELP_REQUEST: "ℹ️ Yardım Talebi",
  CLEANING_REQUEST: "🧹 Temizlik Talebi",
  ORDER_REQUEST: "📋 Sipariş Talebi",
  PRODUCT_INFO: "❓ Ürün Bilgisi",
  COMPLAINT_SUGGESTION: "💬 Şikayet/Öneri",
};

const statusLabels: Record<string, string> = {
  PENDING: "Bekliyor",
  SEEN: "Görüldü",
  IN_PROGRESS: "İşlemde",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal",
};

const statusColors: Record<string, string> = {
  PENDING: "badge-warning",
  SEEN: "badge-info",
  IN_PROGRESS: "badge-primary",
  COMPLETED: "badge-success",
  CANCELLED: "badge-danger",
};

export default function AdminRequestsPage() {
  const { data: session } = useSession();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active");

  useEffect(() => {
    if (session?.user.businessId) {
      fetchRequests();
      const interval = setInterval(fetchRequests, 5000);
      return () => clearInterval(interval);
    }
  }, [session]);

  const fetchRequests = async () => {
    try {
      const res = await fetch(`/api/service-requests?businessId=${session?.user.businessId}`);
      const data = await res.json();
      if (res.ok) setRequests(data.serviceRequests || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ✅ İptal edilen sekmesi eklendi
  const filtered = requests.filter((r) => {
    if (filter === "active") return ["PENDING", "SEEN", "IN_PROGRESS"].includes(r.status);
    if (filter === "completed") return r.status === "COMPLETED";
    if (filter === "cancelled") return r.status === "CANCELLED";
    return true;
  });

  const counts = {
    all: requests.length,
    active: requests.filter((r) => ["PENDING", "SEEN", "IN_PROGRESS"].includes(r.status)).length,
    completed: requests.filter((r) => r.status === "COMPLETED").length,
    cancelled: requests.filter((r) => r.status === "CANCELLED").length,
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>Müşteri Talepleri</h2>
        {/* ✅ İptal Edilen sekmesi eklendi */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["active", "completed", "cancelled", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-ghost"}`}
            >
              {f === "active" ? "Aktif" : f === "completed" ? "Tamamlanan" : f === "cancelled" ? "İptal Edilen" : "Tümü"}
              {counts[f] > 0 && (
                <span style={{
                  marginLeft: 6,
                  background: f === "cancelled" ? "#ef4444" : "rgba(255,255,255,0.3)",
                  color: filter === f ? "white" : "var(--text-secondary)",
                  borderRadius: 10,
                  padding: "1px 6px",
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                  {counts[f]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 32 }}>Yükleniyor...</p>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
          <p style={{ color: "var(--text-secondary)" }}>Talep bulunamadı</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((req) => (
            <div key={req.id} className="card" style={{ padding: "14px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: 15 }}>
                    {requestTypeLabels[req.requestType] || req.requestType}
                  </p>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                    {req.table?.tableName || `Masa ${req.table?.tableNumber}`} • {new Date(req.createdAt).toLocaleString("tr-TR")}
                  </p>
                  {/* ✅ Garson çağırma nedeni göster */}
                  {req.note && (
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, padding: "4px 8px", background: "rgba(245,158,11,0.1)", borderRadius: 6 }}>
                      📝 {req.note}
                    </p>
                  )}
                  {req.completedAt && (
                    <p style={{ fontSize: 11, color: "#10b981", marginTop: 4 }}>
                      ✅ Tamamlandı: {new Date(req.completedAt).toLocaleString("tr-TR")}
                    </p>
                  )}
                </div>
                <span className={`badge ${statusColors[req.status] || "badge-info"}`}>
                  {statusLabels[req.status] || req.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
