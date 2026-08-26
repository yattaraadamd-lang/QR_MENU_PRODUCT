"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function AdminStaffPage() {
  const { data: session } = useSession();
  const [invites, setInvites] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchInvites();
    fetchStaff();
  }, [session]);

  const fetchStaff = async () => {
    try {
      const res = await fetch("/api/admin/staff");
      const data = await res.json();
      if (res.ok) setStaff(data.staff || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchInvites = async () => {
    try {
      const res = await fetch("/api/admin/waiter-invites");
      const data = await res.json();
      if (res.ok) setInvites(data.invites || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const createInvite = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/waiter-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: newCode || undefined }),
      });
      if (res.ok) {
        fetchInvites();
        setNewCode("");
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Personel & Davet Kodları</h2>

      {/* Staff Roster */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Personel Listesi</h3>
        </div>
        {loading ? (
          <p style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>Yükleniyor...</p>
        ) : staff.length === 0 ? (
          <p style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>Henüz personel yok</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 14 }}>
              <thead style={{ background: "var(--card-bg)", borderBottom: "2px solid var(--border-color)" }}>
                <tr>
                  <th style={{ padding: "12px 20px", textAlign: "left", fontWeight: 600 }}>İsim</th>
                  <th style={{ padding: "12px 20px", textAlign: "left", fontWeight: 600 }}>E-posta</th>
                  <th style={{ padding: "12px 20px", textAlign: "left", fontWeight: 600 }}>Rol</th>
                  <th style={{ padding: "12px 20px", textAlign: "center", fontWeight: 600 }}>Durum</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((user) => (
                  <tr key={user.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: "14px 20px", fontWeight: 600 }}>{user.name}</td>
                    <td style={{ padding: "14px 20px", color: "var(--text-secondary)" }}>{user.email}</td>
                    <td style={{ padding: "14px 20px" }}>
                      <span className={`badge ${user.role === 'ADMIN' ? 'badge-primary' : 'badge-info'}`}>
                        {user.role === 'ADMIN' ? 'Admin' : user.role === 'WAITER' ? 'Garson' : user.role}
                      </span>
                    </td>
                    <td style={{ padding: "14px 20px", textAlign: "center" }}>
                      <span className={`badge ${user.isActive ? 'badge-success' : 'badge-error'}`}>
                        {user.isActive ? '✅ Aktif' : '❌ Pasif'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Invite */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Yeni Davet Kodu Oluştur</h3>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
          Garsonlar bu kodu kullanarak sisteme kayıt olabilir.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            placeholder="Özel kod (boş bırakılırsa otomatik oluşturulur)"
            style={{ flex: 1 }}
          />
          <button onClick={createInvite} className="btn btn-primary" disabled={creating}>
            {creating ? "..." : "Oluştur"}
          </button>
        </div>
      </div>

      {/* Invites List */}
      <div className="card">
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Davet Kodları</h3>
        </div>
        {loading ? (
          <p style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>Yükleniyor...</p>
        ) : invites.length === 0 ? (
          <p style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>Henüz davet kodu yok</p>
        ) : (
          <div>
            {invites.map((invite) => (
              <div key={invite.id} style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 16, fontFamily: "monospace", letterSpacing: 2 }}>
                    {invite.inviteCode}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {new Date(invite.createdAt).toLocaleString("tr-TR")}
                  </p>
                </div>
                <span className={`badge ${invite.isUsed ? "badge-success" : "badge-warning"}`}>
                  {invite.isUsed ? "✅ Kullanıldı" : "⏳ Bekliyor"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
