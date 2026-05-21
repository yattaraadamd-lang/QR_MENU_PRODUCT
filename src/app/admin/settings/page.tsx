"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function AdminSettingsPage() {
  const { data: session } = useSession();
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetchBusiness();
  }, [session]);

  const fetchBusiness = async () => {
    try {
      const res = await fetch("/api/admin/business");
      const data = await res.json();
      if (res.ok) setBusiness(data.business);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: business.name,
          description: business.description,
          phone: business.phone,
          email: business.email,
          address: business.address,
          latitude: business.latitude ? parseFloat(business.latitude) : null,
          longitude: business.longitude ? parseFloat(business.longitude) : null,
          allowedRadiusMeters: business.allowedRadiusMeters ? parseInt(business.allowedRadiusMeters) : 100,
        }),
      });
      if (res.ok) {
        setToast("Ayarlar kaydedildi! ✅");
        setTimeout(() => setToast(null), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 32 }}>Yükleniyor...</p>;

  return (
    <div>
      {toast && (
        <div className="toast" style={{ background: "#10b981", color: "white" }}>
          {toast}
        </div>
      )}

      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>İşletme Ayarları</h2>

      <div className="card" style={{ padding: 24, maxWidth: 600 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>İşletme Adı</label>
            <input className="input" value={business?.name || ""} onChange={(e) => setBusiness({ ...business, name: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Açıklama</label>
            <textarea className="input" value={business?.description || ""} onChange={(e) => setBusiness({ ...business, description: e.target.value })} style={{ height: 80, resize: "none" }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Slug</label>
            <input className="input" value={business?.slug || ""} disabled style={{ opacity: 0.6 }} />
            <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>Slug değiştirilemez</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Telefon</label>
              <input className="input" value={business?.phone || ""} onChange={(e) => setBusiness({ ...business, phone: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>E-posta</label>
              <input className="input" value={business?.email || ""} onChange={(e) => setBusiness({ ...business, email: e.target.value })} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Adres</label>
            <textarea className="input" value={business?.address || ""} onChange={(e) => setBusiness({ ...business, address: e.target.value })} style={{ height: 60, resize: "none" }} />
          </div>

          <hr style={{ border: "0", borderTop: "1px solid var(--border-color)", margin: "16px 0" }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Konum Kısıtlaması (Sipariş/Talep)</h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Enlem (Latitude)</label>
              <input type="number" step="any" className="input" value={business?.latitude || ""} onChange={(e) => setBusiness({ ...business, latitude: e.target.value })} placeholder="Örn: 41.0082" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Boylam (Longitude)</label>
              <input type="number" step="any" className="input" value={business?.longitude || ""} onChange={(e) => setBusiness({ ...business, longitude: e.target.value })} placeholder="Örn: 28.9784" />
            </div>
          </div>
          
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>İzin Verilen Yarıçap (Metre)</label>
              <input type="number" className="input" value={business?.allowedRadiusMeters || 100} onChange={(e) => setBusiness({ ...business, allowedRadiusMeters: e.target.value })} />
            </div>
            <button
              className="btn btn-ghost"
              style={{ background: "rgba(99,102,241,0.1)", color: "var(--primary)" }}
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => setBusiness({ ...business, latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                    () => alert("Konum alınamadı. Lütfen izinleri kontrol edin.")
                  );
                } else {
                  alert("Tarayıcınız konum özelliğini desteklemiyor.");
                }
              }}
            >
              📍 Konumumu Kullan
            </button>
          </div>

          <button onClick={handleSave} className="btn btn-primary btn-lg" disabled={saving} style={{ marginTop: 8 }}>
            {saving ? "Kaydediliyor..." : "💾 Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
