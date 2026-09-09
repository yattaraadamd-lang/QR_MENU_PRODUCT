"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { GripVertical, Plus, Edit3, Trash2, Folder, Loader2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

type Category = {
  id: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  _count: { products: number };
};

function SortableCategoryItem({
  cat,
  onEdit,
  onDelete,
}: {
  cat: Category;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cat.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.6 : 1,
    padding: "14px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
  };

  return (
    <div ref={setNodeRef} style={style} className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          {...attributes}
          {...listeners}
          type="button"
          style={{
            cursor: "grab",
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            padding: 4,
            touchAction: "none",
          }}
          title="Sıralamak için sürükleyin"
        >
          <GripVertical size={18} />
        </button>
        <span style={{ fontSize: 28 }}>{cat.icon || "📁"}</span>
        <div>
          <p style={{ fontWeight: 600, fontSize: 15 }}>{cat.name}</p>
          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {cat._count?.products ?? 0} ürün • Sıra: {cat.sortOrder + 1}
          </p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => onEdit(cat)} className="btn btn-ghost btn-sm" title="Düzenle">
          <Edit3 size={15} />
        </button>
        <button onClick={() => onDelete(cat)} className="btn btn-ghost btn-sm" style={{ color: "#ef4444" }} title="Sil">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

export default function AdminCategoriesPage() {
  const { data: session } = useSession();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", icon: "", sortOrder: 0 });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newCategories = arrayMove(categories, oldIndex, newIndex).map((c, idx) => ({
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
      toast.error("Kategori adı gereklidir");
      return;
    }
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
        toast.error(error.error || "Kategori kaydedilemedi");
      }
    } catch (e) {
      console.error(e);
      toast.error("Bir hata oluştu. Lütfen tekrar deneyin.");
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
          <h2 style={{ fontSize: 24, fontWeight: 700 }}>Kategori Yönetimi</h2>
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
                  Sıralama Değeri
                </label>
                <input className="input" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={handleSubmit} disabled={saving || !form.name.trim()} className="btn btn-primary" style={{ flex: 1, gap: 6 }}>
                  {saving ? <><Loader2 size={14} className="animate-spin" /> Kaydediliyor...</> : editingId ? "Güncelle" : "Oluştur"}
                </button>
                <button onClick={resetForm} className="btn btn-ghost">İptal</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Categories List with Drag and Drop */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12 }} />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <Folder size={48} color="var(--text-muted)" strokeWidth={1.5} style={{ margin: "0 auto 12px" }} />
          <p style={{ color: "var(--text-secondary)" }}>Henüz kategori yok</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {categories.map((cat) => (
                <SortableCategoryItem
                  key={cat.id}
                  cat={cat}
                  onEdit={startEdit}
                  onDelete={(c) => setDeleteTarget(c)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
