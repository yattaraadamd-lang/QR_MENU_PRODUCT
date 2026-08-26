"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function AdminStaffPage() {
  const { data: session } = useSession();
  const [invites, setInvites] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [lastCreatedCode, setLastCreatedCode] = useState<string | null>(null);

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
        body: JSON.stringify({}), // ✅ Server generates secure code
      });
      if (res.ok) {
        const data = await res.json();
        // ✅ Show the RAW invite code (only shown ONCE)
        const rawCode = data.invite?.inviteCode;
        if (rawCode) {
          setLastCreatedCode(rawCode);
          // Copy to clipboard
          try {
            await navigator.clipboard.writeText(rawCode);
            alert(
              `✅ Davet kodu oluşturuldu ve panoya kopyalandı!\n\n` +
              `Kod: ${rawCode}\n\n` +
              `⚠️ Bu kodu kaydedin! Bir daha gösterilmeyecektir.\n` +
              `Garsonlar bu kodu kayıt olurken kullanabilir.`
            );
          } catch (clipboardError) {
            // Fallback if clipboard fails
            alert(
              `✅ Davet kodu oluşturuldu!\n\n` +
              `Kod: ${rawCode}\n\n` +
              `⚠️ Bu kodu kaydedin! Bir daha gösterilmeyecektir.\n` +
              `Kodu manuel olarak kopyalayın.`
            );
          }
        }
        fetchInvites();
      } else {
        const data = await res.json();
        alert(data.error || "Davet kodu oluşturulurken bir hata oluştu");
      }
    } catch (e) {
      console.error(e);
      alert("Davet kodu oluşturulurken bir hata oluştu");
    } finally {
      setCreating(false);
    }
  };

  const deleteInvite = async (inviteId: string) => {
    if (!confirm("Bu davet kodunu silmek istediğinizden emin misiniz?")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/waiter-invites?id=${inviteId}`, {
        method: "DELETE",
      });
      
      if (res.ok) {
        alert("✅ Davet kodu silindi");
        fetchInvites();
      } else {
        const data = await res.json();
        alert(data.error || "Davet kodu silinirken bir hata oluştu");
      }
    } catch (e) {
      console.error(e);
      alert("Davet kodu silinirken bir hata oluştu");
    }
  };

  const copyLastCode = () => {
    if (lastCreatedCode) {
      navigator.clipboard.writeText(lastCreatedCode).then(() => {
        alert("✅ Kod panoya kopyalandı!");
      }).catch(() => {
        alert("❌ Kopyalama başarısız. Kodu manuel olarak kopyalayın:\n\n" + lastCreatedCode);
      });
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
          <br />
          ⚠️ <strong>Kod sadece bir kez gösterilecektir</strong>, mutlaka kaydedin!
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={createInvite} className="btn btn-primary" disabled={creating} style={{ flex: 1 }}>
            {creating ? "Oluşturuluyor..." : "🎫 Yeni Davet Kodu Oluştur"}
          </button>
          {lastCreatedCode && (
            <button onClick={copyLastCode} className="btn btn-secondary">
              📋 Son Kodu Kopyala
            </button>
          )}
        </div>
        {lastCreatedCode && (
          <div style={{
            marginTop: 12,
            padding: 12,
            background: "var(--success-bg, #d4edda)",
            border: "1px solid var(--success, #28a745)",
            borderRadius: 6,
            fontSize: 13,
          }}>
            <strong>Son oluşturulan kod:</strong>
            <p style={{
              fontFamily: "monospace",
              fontSize: 14,
              fontWeight: 700,
              marginTop: 6,
              wordBreak: "break-all",
              color: "#155724"
            }}>
              {lastCreatedCode}
            </p>
            <button
              onClick={copyLastCode}
              style={{
                marginTop: 8,
                padding: "6px 12px",
                fontSize: 12,
                background: "#28a745",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              📋 Kopyala
            </button>
          </div>
        )}
      </div>

      {/* Invites List */}
      <div className="card">
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Davet Kodları Geçmişi</h3>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            Güvenlik nedeniyle kodlar gösterilmez. Sadece oluşturulma anında görüntülenebilir.
          </p>
        </div>
        {loading ? (
          <p style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>Yükleniyor...</p>
        ) : invites.length === 0 ? (
          <p style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>Henüz davet kodu yok</p>
        ) : (
          <div>
            {invites.map((invite, index) => (
              <div key={invite.id} style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>
                    🎫 Davet #{invites.length - index}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    Oluşturulma: {new Date(invite.createdAt).toLocaleString("tr-TR")}
                  </p>
                  {invite.expiresAt && (
                    <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      Son kullanma: {new Date(invite.expiresAt).toLocaleString("tr-TR")}
                    </p>
                  )}
                  {invite.usedAt && (
                    <p style={{ fontSize: 12, color: "var(--success)" }}>
                      Kullanıldı: {new Date(invite.usedAt).toLocaleString("tr-TR")}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className={`badge ${invite.isUsed ? "badge-success" : "badge-warning"}`}>
                    {invite.isUsed ? "✅ Kullanıldı" : "⏳ Bekliyor"}
                  </span>
                  {!invite.isUsed && (
                    <button
                      onClick={() => deleteInvite(invite.id)}
                      className="btn btn-error"
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        minWidth: "auto"
                      }}
                      title="Davet kodunu sil"
                    >
                      🗑️ Sil
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
