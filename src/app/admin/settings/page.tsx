"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function AdminSettingsPage() {
  const { data: session } = useSession();
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [clearingLocation, setClearingLocation] = useState(false);

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

  const handleClearLocationLock = async () => {
    setClearingLocation(true);
    try {
      const res = await fetch("/api/admin/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearLocationLock: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setBusiness(data.business);
        setToast("Konum kilidi kapatıldı. Müşteriler konum izni olmadan sipariş verebilir. ✅");
        setTimeout(() => setToast(null), 4000);
      } else {
        const data = await res.json();
        setToast(data.error || "Konum kilidi kapatılamadı");
        setTimeout(() => setToast(null), 4000);
      }
    } catch (e) {
      console.error(e);
      setToast("Bağlantı hatası");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setClearingLocation(false);
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

          {(business?.latitude != null || business?.longitude != null) && (
            <div style={{ padding: "12px 14px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 10, fontSize: 13, color: "#fcd34d" }}>
              Bu işletmede kayıtlı konum koordinatı var. Eski sürümlerde müşteri siparişi konum kontrolüne takılabilir.
              <button
                type="button"
                onClick={handleClearLocationLock}
                disabled={clearingLocation}
                className="btn btn-sm"
                style={{ display: "block", marginTop: 10, background: "#d97706", color: "white" }}
              >
                {clearingLocation ? "Kapatılıyor..." : "Konum kilidini kapat"}
              </button>
            </div>
          )}

          <button onClick={handleSave} className="btn btn-primary btn-lg" disabled={saving} style={{ marginTop: 8 }}>
            {saving ? "Kaydediliyor..." : "💾 Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
