"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Loader from "@/components/ui/Loader";

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

  if (loading) return <Loader />;

  return (
    <div>
      {toast && (
        <div className="toast" style={{ background: "#2B8243", color: "white" }}>
          {toast}
        </div>
      )}

      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>İşletme Ayarları</h2>

      <div className="card" style={{ padding: 24, maxWidth: 600 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label htmlFor="f-isletme-adi" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>İşletme Adı</label>
            <input id="f-isletme-adi" className="input" value={business?.name || ""} onChange={(e) => setBusiness({ ...business, name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="f-aciklama" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Açıklama</label>
            <textarea id="f-aciklama" className="input" value={business?.description || ""} onChange={(e) => setBusiness({ ...business, description: e.target.value })} style={{ height: 80, resize: "none" }} />
          </div>
          <div>
            <label htmlFor="f-slug" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Slug</label>
            <input id="f-slug" className="input" value={business?.slug || ""} disabled style={{ opacity: 0.6 }} />
            <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>Slug değiştirilemez</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label htmlFor="f-telefon" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Telefon</label>
              <input id="f-telefon" className="input" value={business?.phone || ""} onChange={(e) => setBusiness({ ...business, phone: e.target.value })} />
            </div>
            <div>
              <label htmlFor="f-e-posta" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>E-posta</label>
              <input id="f-e-posta" className="input" value={business?.email || ""} onChange={(e) => setBusiness({ ...business, email: e.target.value })} />
            </div>
          </div>
          <div>
            <label htmlFor="f-adres" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Adres</label>
            <textarea id="f-adres" className="input" value={business?.address || ""} onChange={(e) => setBusiness({ ...business, address: e.target.value })} style={{ height: 60, resize: "none" }} />
          </div>


          <button onClick={handleSave} className="btn btn-primary btn-lg" disabled={saving} style={{ marginTop: 8 }}>
            {saving ? "Kaydediliyor..." : "💾 Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
