"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import QRCode from "qrcode";

export default function AdminStaffPage() {
  const { data: session } = useSession();
  const [invites, setInvites] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newInvite, setNewInvite] = useState<{ url: string; qrDataUrl: string; expiresAt?: string } | null>(null);
  const [copied, setCopied] = useState(false);

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
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Davet linki oluşturulurken bir hata oluştu");
        return;
      }
      // ✅ Link sadece şimdi gösterilir — veritabanında yalnızca hash'i tutulur
      const url: string = data.invite?.inviteUrl || `${window.location.origin}/auth/join/${data.invite?.inviteCode}`;
      const qrDataUrl = await QRCode.toDataURL(url, { width: 320, margin: 2 });
      setNewInvite({ url, qrDataUrl, expiresAt: data.invite?.expiresAt });
      setCopied(false);
      fetchInvites();
    } catch (e) {
      console.error(e);
      alert("Davet linki oluşturulurken bir hata oluştu");
    } finally {
      setCreating(false);
    }
  };
  const deleteInvite = async (inviteId: string) => {
    if (!confirm("Bu daveti iptal etmek istediğinizden emin misiniz? Link artık çalışmayacak.")) {
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

  const copyInviteLink = async () => {
    if (!newInvite) return;
    try {
      await navigator.clipboard.writeText(newInvite.url);
      setCopied(true);
    } catch {
      prompt("Linki kopyalayın:", newInvite.url);
    }
  };

  const whatsappHref = newInvite
    ? `https://wa.me/?text=${encodeURIComponent(
        `${session?.user?.businessName ?? "İşletmemize"} garson olarak katılmak için bu linke tıklayın: ${newInvite.url}`
      )}`
    : "#";
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Personel & Davetler</h2>

      {/* Staff Roster */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Personel Listesi</h3>
        </div>
        {loading ? (
          <p style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>Yükleniyor...</p>
        ) : staff.length === 0 ? (
          <p style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
            Henüz personel yok. Aşağıdan bir davet linki oluşturup garsonlarınıza gönderin.
          </p>
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

      {/* Garson Davet Et */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Garson Davet Et</h3>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>
          Bir davet linki oluşturun ve garsonunuza WhatsApp'tan gönderin ya da QR kodu telefonuna okutun.
          Garson linki açıp kendi hesabını oluşturur; kod yazmasına gerek kalmaz.
          Her link <strong>tek kullanımlık</strong> ve <strong>7 gün</strong> geçerlidir.
        </p>
        <button onClick={createInvite} className="btn btn-primary" disabled={creating} style={{ width: "100%" }}>
          {creating ? "Oluşturuluyor..." : "➕ Yeni Davet Linki Oluştur"}
        </button>

        {newInvite && (
          <div style={{
            marginTop: 16,
            padding: 16,
            border: "1px solid var(--border-color)",
            borderRadius: 12,
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "center",
          }}>
            <img src={newInvite.qrDataUrl} alt="Davet QR kodu" width={160} height={160}
              style={{ borderRadius: 8, background: "white", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 220 }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Davet linki hazır</p>
              <p style={{
                fontFamily: "monospace",
                fontSize: 12,
                wordBreak: "break-all",
                padding: "8px 10px",
                background: "var(--bg-hover, rgba(0,0,0,0.04))",
                borderRadius: 8,
                marginBottom: 10,
              }}>
                {newInvite.url}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={copyInviteLink} className="btn btn-sm btn-primary">
                  {copied ? "✅ Kopyalandı" : "📋 Linki Kopyala"}
                </button>
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary"
                  style={{ textDecoration: "none" }}>
                  💬 WhatsApp'ta Gönder
                </a>
                <a href={newInvite.qrDataUrl} download="garson-davet-qr.png" className="btn btn-sm btn-secondary"
                  style={{ textDecoration: "none" }}>
                  ⬇️ QR'ı İndir
                </a>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 10 }}>
                ⚠️ Güvenlik nedeniyle link sadece şimdi gösterilir. Kaybolursa yeni bir link oluşturun.
                {newInvite.expiresAt && ` Son geçerlilik: ${new Date(newInvite.expiresAt).toLocaleDateString("tr-TR")}.`}
              </p>
            </div>
          </div>
        )}
      </div>
      {/* Invites List */}
      <div className="card">
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Davet Geçmişi</h3>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            Güvenlik nedeniyle linkler tekrar gösterilmez; yalnızca oluşturulduğu anda görüntülenir.
          </p>
        </div>
        {loading ? (
          <p style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>Yükleniyor...</p>
        ) : invites.length === 0 ? (
          <p style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>Henüz davet oluşturulmadı</p>
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
                    🔗 Davet #{invites.length - index}
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
                  {(() => {
                    const expired = !invite.isUsed && invite.expiresAt && new Date(invite.expiresAt) < new Date();
                    return (
                      <span className={`badge ${invite.isUsed ? "badge-success" : expired ? "badge-error" : "badge-warning"}`}>
                        {invite.isUsed ? "✅ Kullanıldı" : expired ? "⌛ Süresi doldu" : "⏳ Bekliyor"}
                      </span>
                    );
                  })()}
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
