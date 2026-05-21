"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function AdminStaffPage() {
  const { data: session } = useSession();
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchInvites();
  }, [session]);

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
