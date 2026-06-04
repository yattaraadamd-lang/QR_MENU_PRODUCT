"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Business = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  _count?: { tables: number; products: number };
  businessSubscriptions?: { plan: { name: string } }[];
};

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  address: "",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
};

export default function SuperAdminBusinessesPage() {
  const { data: session } = useSession();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user.role === "SUPER_ADMIN") {
      fetchBusinesses();
    }
  }, [session]);

  const fetchBusinesses = async () => {
    try {
      const res = await fetch("/api/super-admin/businesses");
      const data = await res.json();
      if (res.ok) setBusinesses(data.businesses);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const endpoint = `/api/super-admin/businesses/${id}/${currentStatus ? "deactivate" : "activate"}`;
      const res = await fetch(endpoint, { method: "PATCH" });
      if (res.ok) fetchBusinesses();
    } catch (e) {
      console.error(e);
    }
  };

  const openModal = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormSuccess(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSaving(true);
    try {
      const res = await fetch("/api/super-admin/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFormSuccess(data.message || "İşletme oluşturuldu.");
        await fetchBusinesses();
        setTimeout(() => setShowModal(false), 1500);
      } else {
        setFormError(data.error || "Bir hata oluştu.");
      }
    } catch {
      setFormError("Sunucu bağlantı hatası.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 32 }}>
      Yükleniyor...
    </p>
  );

  return (
    <div>
      {/* Başlık + Yeni İşletme butonu */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>İşletme Yönetimi</h2>
        <button className="btn btn-primary" onClick={openModal}>+ Yeni İşletme Ekle</button>
      </div>

      {/* İşletme tablosu */}
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
                <td>{b.businessSubscriptions?.[0]?.plan?.name || "Bilinmiyor"}</td>
                <td>
                  <span className={`badge ${b.isActive ? "badge-success" : "badge-danger"}`}>
                    {b.isActive ? "Aktif" : "Pasif"}
                  </span>
                </td>
                <td>
                  <button
                    onClick={() => toggleStatus(b.id, b.isActive)}
                    className="btn btn-sm btn-ghost"
                  >
                    {b.isActive ? "🔴 Pasif Et" : "🟢 Aktif Et"}
                  </button>
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

      {/* ✅ Yeni İşletme Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.55)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div
            className="card"
            style={{
              width: "100%", maxWidth: 520,
              maxHeight: "90vh", overflowY: "auto",
              padding: 28,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700 }}>Yeni İşletme Ekle</h3>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--text-secondary)" }}>✕</button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* İşletme Bilgileri */}
              <p style={{ fontWeight: 600, fontSize: 13, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>İşletme Bilgileri</p>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  İşletme Adı <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  className="input"
                  type="text"
                  placeholder="Örn: Lezzet Cafe"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>İşletme E-posta</label>
                  <input
                    className="input"
                    type="email"
                    placeholder="isletme@ornek.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Telefon</label>
                  <input
                    className="input"
                    type="tel"
                    placeholder="05xx xxx xx xx"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Adres</label>
                <input
                  className="input"
                  type="text"
                  placeholder="İşletme adresi"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>

              {/* Admin Bilgileri */}
              <p style={{ fontWeight: 600, fontSize: 13, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 8 }}>Admin Hesabı</p>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Admin Adı</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Yetkili Kişi Adı"
                  value={form.adminName}
                  onChange={(e) => setForm({ ...form, adminName: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  Admin E-posta <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  className="input"
                  type="email"
                  placeholder="admin@isletme.com"
                  value={form.adminEmail}
                  onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  Admin Şifresi <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  className="input"
                  type="password"
                  placeholder="En az 8 karakter"
                  value={form.adminPassword}
                  onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                  required
                  minLength={8}
                />
                <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                  En az 8 karakter, 1 harf ve 1 rakam içermeli
                </p>
              </div>

              {/* Hata / Başarı */}
              {formError && (
                <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", color: "#991b1b", fontSize: 13 }}>
                  ❌ {formError}
                </div>
              )}
              {formSuccess && (
                <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", color: "#166534", fontSize: 13 }}>
                  ✅ {formSuccess}
                </div>
              )}

              {/* Butonlar */}
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-ghost"
                  style={{ flex: 1 }}
                  disabled={saving}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={saving}
                >
                  {saving ? "Oluşturuluyor..." : "İşletme Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
