"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Plus, Folder, Loader2 } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Dialog from "@/components/ui/Dialog";
import FormError from "@/components/ui/FormError";
import type { Category } from "./types";

const ListSkeleton = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    {[1, 2, 3].map((i) => (
      <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12 }} />
    ))}
  </div>
);

// dnd-kit (≈18 KB gzip) yalnız liste çizilirken iner; veri yüklenirken paralel gelir
const SortableCategoryList = dynamic(() => import("./SortableCategoryList"), { ssr: false, loading: ListSkeleton });

export default function AdminCategoriesPage() {
  const { data: session } = useSession();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", icon: "", sortOrder: 0 });
  const [saving, setSaving] = useState(false);
  // Modal içi hata (FormError): toast açık <dialog>'un arkasında kalırdı
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, [session]);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/admin/categories");
      const data = await res.json();
      if (res.ok) {
        const sorted = (data.categories || []).sort((a: Category, b: Category) => a.sortOrder - b.sortOrder);
        setCategories(sorted);
      }
    } catch (e) {
      console.error(e);
      toast.error("Kategoriler yüklenirken hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  // dnd-kit'in arrayMove'u ile aynı
  const handleMove = async (activeId: string, overId: string) => {
    const oldIndex = categories.findIndex((c) => c.id === activeId);
    const newIndex = categories.findIndex((c) => c.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;

    const moved = [...categories];
    const [item] = moved.splice(oldIndex, 1);
    moved.splice(newIndex, 0, item);
    const newCategories = moved.map((c, idx) => ({
      ...c,
      sortOrder: idx,
    }));
    setCategories(newCategories);

    try {
      const res = await fetch("/api/admin/categories/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: newCategories.map((c) => ({ id: c.id, sortOrder: c.sortOrder })),
        }),
      });
      if (res.ok) {
        toast.success("Kategori sıralaması güncellendi");
      } else {
        toast.error("Sıralama kaydedilemedi");
        fetchCategories();
      }
    } catch {
      toast.error("Bağlantı hatası");
      fetchCategories();
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setFormError("Kategori adı gereklidir");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const url = editingId ? `/api/admin/categories/${editingId}` : "/api/admin/categories";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        await fetchCategories();
        resetForm();
        toast.success(editingId ? "Kategori güncellendi" : "Kategori oluşturuldu");
      } else {
        const error = await res.json();
        setFormError(error.error || "Kategori kaydedilemedi");
      }
    } catch (e) {
      console.error(e);
      setFormError("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/categories/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(`"${deleteTarget.name}" kategorisi silindi`);
        fetchCategories();
      } else {
        toast.error("Kategori silinemedi");
      }
    } catch (e) {
      console.error(e);
      toast.error("Bağlantı hatası");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setForm({ name: cat.name, icon: cat.icon || "", sortOrder: cat.sortOrder });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setFormError(null);
    setEditingId(null);
    setForm({ name: "", icon: "", sortOrder: 0 });
  };

  return (
    <div>
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Kategoriyi Sil"
        description={`"${deleteTarget?.name}" kategorisini silmek istediğinizden emin misiniz? Bu kategoriye bağlı ürünler etkilenebilir.`}
        confirmText="Sil"
        cancelText="Vazgeç"
        variant="danger"
        loading={deleting}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Kategori Yönetimi</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 2 }}>
            Sürükle-bırak ile kategorilerin menüdeki görünüm sırasını belirleyin
          </p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn btn-primary" style={{ gap: 6 }}>
          <Plus size={16} /> Yeni Kategori
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <Dialog onClose={resetForm} contentStyle={{ padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
              {editingId ? "Kategori Düzenle" : "Yeni Kategori"}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label htmlFor="f-kategori-adi" style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "block", color: "var(--text-secondary)" }}>
                  Kategori Adı *
                </label>
                <input id="f-kategori-adi" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Örn: Sıcak İçecekler" />
              </div>
              <div>
                <label htmlFor="f-ikon-emoji" style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "block", color: "var(--text-secondary)" }}>
                  İkon (Emoji)
                </label>
                <input id="f-ikon-emoji" className="input" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="Örn: ☕" />
              </div>
              <div>
                <label htmlFor="f-siralama-degeri" style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "block", color: "var(--text-secondary)" }}>
                  Sıralama Değeri
                </label>
                <input id="f-siralama-degeri" className="input" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} />
              </div>
              <FormError message={formError} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={handleSubmit} disabled={saving || !form.name.trim()} className="btn btn-primary" style={{ flex: 1, gap: 6 }}>
                  {saving ? <><Loader2 size={14} className="animate-spin" /> Kaydediliyor...</> : editingId ? "Güncelle" : "Oluştur"}
                </button>
                <button onClick={resetForm} className="btn btn-ghost">İptal</button>
              </div>
            </div>
          </Dialog>
      )}

      {/* Categories List with Drag and Drop */}
      {loading ? (
        <ListSkeleton />
      ) : categories.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <Folder size={48} color="var(--text-muted)" strokeWidth={1.5} style={{ margin: "0 auto 12px" }} />
          <p style={{ color: "var(--text-secondary)" }}>Henüz kategori yok</p>
        </div>
      ) : (
        <SortableCategoryList
          items={categories}
          onMove={handleMove}
          onEdit={startEdit}
          onDelete={(c) => setDeleteTarget(c)}
        />
      )}
    </div>
  );
}
