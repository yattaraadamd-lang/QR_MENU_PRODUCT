"use client";

import { useSession } from "next-auth/react";

export default function SuperAdminSettingsPage() {
  const { data: session } = useSession();

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Platform Ayarları</h2>

      <div className="card" style={{ padding: 24, maxWidth: 600 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Platform Adı</label>
            <input className="input" defaultValue="QR Menu SaaS" />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Varsayılan Deneme Süresi (Gün)</label>
            <input type="number" className="input" defaultValue={14} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Destek E-posta</label>
            <input className="input" defaultValue="destek@qrmenu.com" />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Super Admin Bilgisi</label>
            <div className="card" style={{ padding: 16, background: "var(--bg-secondary)" }}>
              <p style={{ fontSize: 14 }}><strong>İsim:</strong> {session?.user?.name || "-"}</p>
              <p style={{ fontSize: 14 }}><strong>Email:</strong> {session?.user?.email || "-"}</p>
              <p style={{ fontSize: 14 }}><strong>Rol:</strong> {session?.user?.role || "-"}</p>
            </div>
          </div>
          <button className="btn btn-primary btn-lg" style={{ marginTop: 8 }} onClick={() => alert("Ayarlar kaydedildi (henüz API bağlanmadı)")}>
            💾 Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
