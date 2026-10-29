"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Loader from "@/components/ui/Loader";
import ScrollRegion from "@/components/ui/ScrollRegion";
import { formatTRY } from "@/lib/format";

const statusLabels: Record<string, string> = {
  PENDING: "Müşteri Talebi",
  AWAITING_ADMIN_APPROVAL: "Admin Onayı Bekliyor",
  PROCESSING: "İşleniyor",
  PAID: "Ödendi",
  REJECTED: "Reddedildi",
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
  
  // ✅ E2E FIX: Add date range filter
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    end: new Date().toISOString().split('T')[0], // today
  });

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
    // ✅ Filter by status
    if (filter === "ALL") {
      // continue to date filter
    } else if (filter === "AWAITING") {
      if (p.status !== "AWAITING_ADMIN_APPROVAL" && p.status !== "PENDING") return false;
    } else if (filter === "COMPLETED") {
      if (p.status !== "PAID") return false;
    } else if (filter === "REJECTED") {
      if (p.status !== "REJECTED") return false;
    }
    
    // ✅ E2E FIX: Filter by date range
    const paymentDate = new Date(p.paidAt || p.createdAt).toISOString().split('T')[0];
    if (paymentDate < dateRange.start || paymentDate > dateRange.end) {
      return false;
    }
    
    return true;
  });

  const pendingCount = payments.filter(p => p.status === "AWAITING_ADMIN_APPROVAL" || p.status === "PENDING").length;
  const todayTotal = payments
    .filter(p => p.status === "PAID" && new Date(p.paidAt).toDateString() === new Date().toDateString())
    .reduce((sum, p) => sum + Number(p.amount), 0);

  if (loading) return <Loader />;

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 24 }}>Ödemeler</h1>

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 16, flex: 1, borderLeft: "4px solid #F4A623" }}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Onay Bekleyen Ödeme Talepleri</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: "#F4A623" }}>{pendingCount}</p>
        </div>
        <div className="card" style={{ padding: 16, flex: 1, borderLeft: "4px solid #3BA55C" }}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Bugün Alınan Ciro</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: "#3BA55C" }}>{formatTRY(todayTotal)}</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => setFilter("ALL")} aria-pressed={filter === "ALL"} className={`btn btn-sm ${filter === "ALL" ? "btn-primary" : "btn-ghost"}`}>Tümü</button>
        <button onClick={() => setFilter("AWAITING")} aria-pressed={filter === "AWAITING"} className={`btn btn-sm ${filter === "AWAITING" ? "btn-primary" : "btn-ghost"}`}>Onay Bekleyenler</button>
        <button onClick={() => setFilter("COMPLETED")} aria-pressed={filter === "COMPLETED"} className={`btn btn-sm ${filter === "COMPLETED" ? "btn-primary" : "btn-ghost"}`}>Tamamlananlar</button>
        <button onClick={() => setFilter("REJECTED")} aria-pressed={filter === "REJECTED"} className={`btn btn-sm ${filter === "REJECTED" ? "btn-primary" : "btn-ghost"}`}>Reddedilenler</button>
        
        {/* ✅ E2E FIX: Date range picker */}
        <div role="group" aria-labelledby="tarih-araligi-label" style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span id="tarih-araligi-label" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Tarih Aralığı:</span>
          <input
            type="date"
            aria-label="Başlangıç tarihi"
            className="input"
            style={{ width: 150 }}
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            max={dateRange.end}
          />
          <span aria-hidden="true" style={{ color: "var(--text-secondary)" }}>-</span>
          <input
            type="date"
            aria-label="Bitiş tarihi"
            className="input" 
            style={{ width: 150 }}
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            min={dateRange.start}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>
      </div>

      <ScrollRegion label="Ödemeler tablosu" className="card">
        <table className="table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Masa</th>
              <th>Tutar</th>
              <th>Alınan / Para Üstü</th>
              <th>Durum</th>
              <th>Yöntem</th>
              <th>Talep Eden Garson</th>
              <th>Onaylayan Admin</th>
              <th>Tarih</th>
              <th>Not</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.table?.tableName || `Masa ${p.table?.tableNumber}`}</td>
                <td style={{ fontWeight: 700, color: "var(--primary-light)" }}>{formatTRY(p.amount)}</td>
                <td style={{ fontSize: 13 }}>
                  {p.method === "CASH" && p.receivedAmount ? (
                    <span>
                      Alınan: {formatTRY(p.receivedAmount)}
                      {p.changeAmount ? <small style={{ display: "block", color: "#3BA55C" }}>Üstü: {formatTRY(p.changeAmount)}</small> : null}
                    </span>
                  ) : "-"}
                </td>
                <td>
                  <span className={`badge ${
                    p.status === "AWAITING_ADMIN_APPROVAL" ? "badge-warning" :
                    p.status === "PENDING" ? "badge-warning" :
                    p.status === "PAID" ? "badge-success" :
                    p.status === "REJECTED" ? "badge-danger" : "badge-neutral"
                  }`}>
                    {statusLabels[p.status] || p.status}
                  </span>
                </td>
                <td>{methodLabels[p.method] || "-"}</td>
                <td style={{ fontSize: 13 }}>
                  {p.requestedByName || p.handledByWaiterName ? (
                    <span style={{ color: "var(--primary-light)", fontWeight: 600 }}>
                      👤 {p.requestedByName || p.handledByWaiterName}
                    </span>
                  ) : "-"}
                </td>
                <td style={{ fontSize: 13 }}>
                  {p.approvedByName ? (
                    <span style={{ color: "#3BA55C", fontWeight: 600 }}>
                      🛡️ {p.approvedByName}
                    </span>
                  ) : "-"}
                </td>
                <td>{new Date(p.paidAt || p.createdAt).toLocaleString("tr-TR")}</td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{p.note || (p.rejectionReason ? `Red: ${p.rejectionReason}` : "-")}</td>
              </tr>
            ))}
            {filteredPayments.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                  Ödeme kaydı bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ScrollRegion>
    </div>
  );
}
