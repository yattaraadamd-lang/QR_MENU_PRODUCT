"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function SuperAdminSubscriptionsPage() {
  const { data: session } = useSession();
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user.role === "SUPER_ADMIN") {
      fetchSubscriptions();
    }
  }, [session]);

  const fetchSubscriptions = async () => {
    try {
      const res = await fetch("/api/super-admin/subscriptions");
      const data = await res.json();
      if (res.ok) setSubscriptions(data.subscriptions);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 32 }}>Yükleniyor...</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>Abonelikler</h2>
        <button className="btn btn-primary" onClick={() => alert("Plan ekleme formu yakında eklenecek!")}>+ Yeni Plan Ekle</button>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="table" style={{ minWidth: 800 }}>
          <thead>
            <tr>
              <th>İşletme</th>
              <th>Plan</th>
              <th>Durum</th>
              <th>Aylık Tutar</th>
              <th>Başlangıç</th>
              <th>Bitiş</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((s) => (
              <tr key={s.id}>
                <td style={{ fontWeight: 600 }}>{s.business?.name || "-"}</td>
                <td>{s.plan?.name || "-"}</td>
                <td>
                  <span className={`badge ${
                    s.status === "ACTIVE" ? "badge-success" : 
                    s.status === "TRIAL" ? "badge-warning" : "badge-danger"
                  }`}>
                    {s.status}
                  </span>
                </td>
                <td style={{ color: "var(--primary-light)", fontWeight: 600 }}>
                  ₺{Number(s.plan?.monthlyPrice || 0).toFixed(2)}
                </td>
                <td>{new Date(s.startedAt).toLocaleDateString("tr-TR")}</td>
                <td>{s.endsAt ? new Date(s.endsAt).toLocaleDateString("tr-TR") : "Süresiz"}</td>
              </tr>
            ))}
            {subscriptions.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                  Abonelik kaydı bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
