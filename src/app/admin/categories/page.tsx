"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Category = {
  id: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  _count: { products: number };
};

export default function AdminCategoriesPage() {
  const { data: session } = useSession();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", icon: "", sortOrder: 0 });

  useEffect(() => {
    fetchCategories();
  }, [session]);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/admin/categories");
      const data = await res.json();
      if (res.ok) setCategories(data.categories);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name) return;
    try {
      const url = editingId ? `/api/admin/categories/${editingId}` : "/api/admin/categories";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        fetchCategories();
        resetForm();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu kategoriyi silmek istediğinizden emin misiniz?")) return;
    try {
      const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      if (res.ok) fetchCategories();
    } catch (e) {
      console.error(e);
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setForm({ name: cat.name, icon: cat.icon || "", sortOrder: cat.sortOrder });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ name: "", icon: "", sortOrder: 0 });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>Kategori Yönetimi</h2>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn btn-primary">
          + Yeni Kategori
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
              {editingId ? "Kategori Düzenle" : "Yeni Kategori"}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "block", color: "var(--text-secondary)" }}>
                  Kategori Adı *
                </label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Örn: Sıcak İçecekler" />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "block", color: "var(--text-secondary)" }}>
                  İkon (Emoji)
                </label>
                <input className="input" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="Örn: ☕" />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "block", color: "var(--text-secondary)" }}>
                  Sıralama
                </label>
                <input className="input" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={handleSubmit} className="btn btn-primary" style={{ flex: 1 }}>
                  {editingId ? "Güncelle" : "Oluştur"}
                </button>
                <button onClick={resetForm} className="btn btn-ghost">İptal</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Categories List */}
      {loading ? (
        <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 32 }}>Yükleniyor...</p>
      ) : categories.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
          <p style={{ color: "var(--text-secondary)" }}>Henüz kategori yok</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {categories.map((cat) => (
            <div key={cat.id} className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 28 }}>{cat.icon || "📁"}</span>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 15 }}>{cat.name}</p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {cat._count.products} ürün • Sıra: {cat.sortOrder}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => startEdit(cat)} className="btn btn-ghost btn-sm">✏️</button>
                <button onClick={() => handleDelete(cat.id)} className="btn btn-ghost btn-sm" style={{ color: "#ef4444" }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
