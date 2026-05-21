"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const statusLabels: Record<string, string> = {
  PENDING: "Bekliyor",
  PAID: "Ödendi",
  CANCELLED: "İptal Edildi",
  FAILED: "Başarısız",
};

const methodLabels: Record<string, string> = {
  CASH: "Nakit",
  CARD: "Kart",
  ONLINE: "Online",
  OTHER: "Diğer",
};

export default function AdminPaymentsPage() {
  const { data: session } = useSession();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    if (session?.user.businessId) {
      fetchPayments();
      const interval = setInterval(fetchPayments, 10000);
      return () => clearInterval(interval);
    }
  }, [session]);

  const fetchPayments = async () => {
    try {
      const res = await fetch("/api/admin/payments");
      const data = await res.json();
      if (res.ok) setPayments(data.payments || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter((p) => {
    if (filter === "ALL") return true;
    if (filter === "PENDING") return p.status === "PENDING";
    if (filter === "COMPLETED") return p.status === "PAID";
    return true;
  });

  const pendingCount = payments.filter(p => p.status === "PENDING").length;
  const todayTotal = payments
    .filter(p => p.status === "PAID" && new Date(p.paidAt).toDateString() === new Date().toDateString())
    .reduce((sum, p) => sum + Number(p.amount), 0);

  if (loading) return <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 32 }}>Yükleniyor...</p>;

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Ödemeler</h2>

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 16, flex: 1, borderLeft: "4px solid #f59e0b" }}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Bekleyen Ödeme Talepleri</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b" }}>{pendingCount}</p>
        </div>
        <div className="card" style={{ padding: 16, flex: 1, borderLeft: "4px solid #10b981" }}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Bugün Alınan Ödeme</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: "#10b981" }}>₺{todayTotal.toFixed(2)}</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setFilter("ALL")} className={`btn btn-sm ${filter === "ALL" ? "btn-primary" : "btn-ghost"}`}>Tümü</button>
        <button onClick={() => setFilter("PENDING")} className={`btn btn-sm ${filter === "PENDING" ? "btn-primary" : "btn-ghost"}`}>Bekleyenler</button>
        <button onClick={() => setFilter("COMPLETED")} className={`btn btn-sm ${filter === "COMPLETED" ? "btn-primary" : "btn-ghost"}`}>Tamamlananlar</button>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Masa</th>
              <th>Tutar</th>
              <th>Durum</th>
              <th>Yöntem</th>
              {/* ✅ Ödemeyi Alan Garson sütunu eklendi */}
              <th>Ödemeyi Alan Garson</th>
              <th>Talep Zamanı</th>
              <th>Tamamlanma</th>
              <th>Not</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.table?.tableName || `Masa ${p.table?.tableNumber}`}</td>
                <td style={{ fontWeight: 700, color: "var(--primary-light)" }}>₺{Number(p.amount).toFixed(2)}</td>
                <td>
                  <span className={`badge ${
                    p.status === "PENDING" ? "badge-warning" :
                    p.status === "PAID" ? "badge-success" : "badge-danger"
                  }`}>
                    {statusLabels[p.status] || p.status}
                  </span>
                </td>
                <td>{methodLabels[p.method] || "-"}</td>
                {/* ✅ Garson adı göster */}
                <td style={{ fontSize: 13 }}>
                  {p.handledByWaiterName ? (
                    <span style={{ color: "var(--primary-light)", fontWeight: 600 }}>
                      👤 {p.handledByWaiterName}
                    </span>
                  ) : "-"}
                </td>
                <td>{new Date(p.requestedAt).toLocaleString("tr-TR")}</td>
                <td>{p.paidAt ? new Date(p.paidAt).toLocaleString("tr-TR") : "-"}</td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{p.note || "-"}</td>
              </tr>
            ))}
            {filteredPayments.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                  Ödeme kaydı bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
