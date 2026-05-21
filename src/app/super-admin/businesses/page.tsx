"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function SuperAdminBusinessesPage() {
  const { data: session } = useSession();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user.role === "SUPER_ADMIN") {
      fetchBusinesses();
    }
  }, [session]);

  const fetchBusinesses = async () => {
    try {
      const res = await fetch("/api/super-admin/businesses");
      const data = await res.json();
      if (res.ok) {
        setBusinesses(data.businesses);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const endpoint = `/api/super-admin/businesses/${id}/${currentStatus ? 'deactivate' : 'activate'}`;
      const res = await fetch(endpoint, { method: "PATCH" });
      if (res.ok) fetchBusinesses();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 32 }}>Yükleniyor...</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>İşletme Yönetimi</h2>
        <button className="btn btn-primary" onClick={() => alert("Yeni işletme açma formu yakında eklenecek!")}>+ Yeni İşletme Ekle</button>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="table" style={{ minWidth: 800 }}>
          <thead>
            <tr>
              <th>İşletme Adı</th>
              <th>Slug</th>
              <th>Yetkili Email</th>
              <th>Masa Sayısı</th>
              <th>Abonelik</th>
              <th>Durum</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{b.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{b.phone || "-"}</div>
                </td>
                <td style={{ color: "var(--text-secondary)" }}>{b.slug}</td>
                <td>{b.email || "-"}</td>
                <td>{b._count?.tables || 0}</td>
                <td>
                  {b.subscriptions?.[0]?.plan?.name || "Bilinmiyor"}
                </td>
                <td>
                  <span className={`badge ${b.isActive ? "badge-success" : "badge-danger"}`}>
                    {b.isActive ? "Aktif" : "Pasif"}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => toggleStatus(b.id, b.isActive)}
                      className="btn btn-sm btn-ghost"
                    >
                      {b.isActive ? "🔴 Pasif Et" : "🟢 Aktif Et"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {businesses.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                  İşletme bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
