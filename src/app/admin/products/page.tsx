"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Product = {
  id: string; name: string; description: string | null;
  ingredients: string | null; allergens: string | null;
  price: number; isAvailable: boolean;
  stockStatus: "IN_STOCK" | "OUT_OF_STOCK" | "TEMPORARILY_UNAVAILABLE";
  isPopular: boolean; sortOrder: number;
  category: { id: string; name: string } | null;
};
type Category = { id: string; name: string };

const STOCK_OPTIONS = [
  { value: "IN_STOCK",               label: "Stokta Var",    color: "#10b981" },
  { value: "OUT_OF_STOCK",           label: "Stokta Yok",    color: "#ef4444" },
  { value: "TEMPORARILY_UNAVAILABLE",label: "Geçici Yok",    color: "#f59e0b" },
];

const emptyForm = {
  name: "", description: "", ingredients: "", allergens: "",
  price: 0, categoryId: "", isAvailable: true,
  stockStatus: "IN_STOCK" as Product["stockStatus"],
  isPopular: false, sortOrder: 0,
};

export default function AdminProductsPage() {
  const { data: session } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, [session]);

  const fetchData = async () => {
    try {
      const [pr, cr] = await Promise.all([fetch("/api/admin/products"), fetch("/api/admin/categories")]);
      const pd = await pr.json(); const cd = await cr.json();
      if (pr.ok) setProducts(pd.products || []);
      if (cr.ok) setCategories(cd.categories || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.price) return;
    setSaving(true);
    try {
      const url = editingId ? `/api/admin/products/${editingId}` : "/api/admin/products";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, categoryId: form.categoryId || null, description: form.description || null, ingredients: form.ingredients || null, allergens: form.allergens || null }),
      });
      if (res.ok) { fetchData(); resetForm(); }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu ürünü silmek istediğinizden emin misiniz?")) return;
    const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    if (res.ok) fetchData();
  };

  const toggleStock = async (p: Product) => {
    const next = p.stockStatus === "IN_STOCK" ? "OUT_OF_STOCK" : "IN_STOCK";
    await fetch(`/api/admin/products/${p.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockStatus: next, isAvailable: next === "IN_STOCK" }),
    });
    fetchData();
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({ name: p.name, description: p.description || "", ingredients: p.ingredients || "", allergens: p.allergens || "", price: Number(p.price), categoryId: p.category?.id || "", isAvailable: p.isAvailable, stockStatus: p.stockStatus || "IN_STOCK", isPopular: p.isPopular, sortOrder: p.sortOrder });
    setShowForm(true);
  };

  const resetForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); };

  const filtered = products
    .filter(p => filterCat === "all" || p.category?.id === filterCat)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  const stockInfo = (s: Product["stockStatus"]) => STOCK_OPTIONS.find(o => o.value === s) || STOCK_OPTIONS[0];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>Ürün Yönetimi</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 3 }}>{products.length} ürün</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn btn-primary">
          + Yeni Ürün
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="input" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Ürün ara..." style={{ maxWidth: 220, fontSize: 13 }}
        />
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          <button onClick={() => setFilterCat("all")} className={`btn btn-sm ${filterCat === "all" ? "btn-primary" : "btn-ghost"}`}>
            Tümü ({products.length})
          </button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setFilterCat(c.id)} className={`btn btn-sm ${filterCat === c.id ? "btn-primary" : "btn-ghost"}`}>
              {c.name} ({products.filter(p => p.category?.id === c.id).length})
            </button>
          ))}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>{editingId ? "Ürünü Düzenle" : "Yeni Ürün Ekle"}</h3>
              <button onClick={resetForm} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: "65vh", overflowY: "auto", paddingRight: 4 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Ürün Adı *</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Örn: Türk Kahvesi" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Açıklama</label>
                <textarea className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Kısa ürün açıklaması..." style={{ height: 64, resize: "none" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Fiyat (₺) *</label>
                  <input className="input" type="number" step="0.01" min="0" value={form.price} onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Kategori</label>
                  <select className="input" value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}>
                    <option value="">Kategorisiz</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Stok Durumu</label>
                <select className="input" value={form.stockStatus} onChange={e => setForm({ ...form, stockStatus: e.target.value as any })}>
                  {STOCK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>İçindekiler</label>
                <input className="input" value={form.ingredients} onChange={e => setForm({ ...form, ingredients: e.target.value })} placeholder="Espresso, süt, şeker..." />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Alerjenler</label>
                <input className="input" value={form.allergens} onChange={e => setForm({ ...form, allergens: e.target.value })} placeholder="Süt ürünleri, gluten..." />
              </div>
              <div style={{ display: "flex", gap: 20, padding: "4px 0" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
                  <input type="checkbox" checked={form.isAvailable} onChange={e => setForm({ ...form, isAvailable: e.target.checked })} style={{ width: 16, height: 16, accentColor: "var(--primary)" }} />
                  Menüde Görünsün
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
                  <input type="checkbox" checked={form.isPopular} onChange={e => setForm({ ...form, isPopular: e.target.checked })} style={{ width: 16, height: 16, accentColor: "var(--warning)" }} />
                  ⭐ Popüler
                </label>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
              <button onClick={handleSubmit} disabled={saving || !form.name.trim() || !form.price} className="btn btn-primary" style={{ flex: 1 }}>
                {saving ? "Kaydediliyor..." : editingId ? "Güncelle" : "Ürün Ekle"}
              </button>
              <button onClick={resetForm} className="btn btn-ghost">İptal</button>
            </div>
          </div>
        </div>
      )}

      {/* Product List */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🍽️</div>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            {search ? `"${search}" için ürün bulunamadı` : "Henüz ürün eklenmemiş"}
          </p>
          {!search && <button onClick={() => setShowForm(true)} className="btn btn-primary" style={{ marginTop: 16 }}>İlk Ürünü Ekle</button>}
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          {filtered.map((p, idx) => {
            const si = stockInfo(p.stockStatus);
            return (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 18px",
                borderBottom: idx < filtered.length - 1 ? "1px solid var(--border-subtle)" : "none",
                opacity: p.isAvailable ? 1 : 0.55,
                transition: "background 0.15s",
              }}>
                {/* Color dot */}
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: si.color, flexShrink: 0 }} />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                    {p.isPopular && <span className="badge badge-warning" style={{ fontSize: 10 }}>⭐ Popüler</span>}
                    {!p.isAvailable && <span className="badge badge-neutral" style={{ fontSize: 10 }}>Gizli</span>}
                    {p.stockStatus !== "IN_STOCK" && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: `${si.color}18`, color: si.color }}>
                        {si.label}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                    {p.category?.name || "Kategorisiz"}
                  </p>
                </div>

                {/* Price */}
                <span style={{ fontWeight: 700, fontSize: 15, color: "var(--primary-light)", flexShrink: 0 }}>
                  {Number(p.price).toFixed(2)} ₺
                </span>

                {/* Actions */}
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => toggleStock(p)}
                    className="btn btn-sm btn-ghost"
                    title={p.stockStatus === "IN_STOCK" ? "Stoktan Çıkar" : "Stoğa Al"}
                    style={{ padding: "5px 8px" }}
                  >
                    {p.stockStatus === "IN_STOCK" ? "🟢" : "🔴"}
                  </button>
                  <button onClick={() => startEdit(p)} className="btn btn-sm btn-ghost" style={{ padding: "5px 8px" }}>✏️</button>
                  <button onClick={() => handleDelete(p.id)} className="btn btn-sm btn-ghost" style={{ padding: "5px 8px", color: "#ef4444" }}>🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
