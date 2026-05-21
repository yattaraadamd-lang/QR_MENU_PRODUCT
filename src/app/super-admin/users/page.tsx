"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function SuperAdminUsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user.role === "SUPER_ADMIN") {
      fetchUsers();
    }
  }, [session]);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/super-admin/users");
      const data = await res.json();
      if (res.ok) setUsers(data.users);
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
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>Kullanıcı Yönetimi</h2>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="table" style={{ minWidth: 800 }}>
          <thead>
            <tr>
              <th>İsim</th>
              <th>Email</th>
              <th>Rol</th>
              <th>İşletme</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.name || "-"}</td>
                <td>{u.email}</td>
                <td>
                  <span className={`badge ${
                    u.role === "SUPER_ADMIN" ? "badge-success" : 
                    u.role === "ADMIN" ? "badge-primary" : "badge-warning"
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td>{u.business?.name || "-"}</td>
                <td>
                  <span className={`badge ${u.isActive ? "badge-success" : "badge-danger"}`}>
                    {u.isActive ? "Aktif" : "Pasif"}
                  </span>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                  Kullanıcı bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
