"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

type Block = {
  id: string;
  maskedDeviceHash: string;
  reason: string;
  sourceRequestId: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  revokedAt: string | null;
  revokedById: string | null;
  revokedByName: string | null;
  revocationNote: string | null;
  status: "active" | "revoked";
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export default function BlockedDevicesPage() {
  const { data: session } = useSession();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"active" | "revoked" | "all">("active");
  const [page, setPage] = useState(1);

  // Unblock modal
  const [unblockTarget, setUnblockTarget] = useState<Block | null>(null);
  const [unblockNote, setUnblockNote] = useState("");
  const [unblocking, setUnblocking] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchBlocks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/customer-access-blocks?status=${statusFilter}&page=${page}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setBlocks(data.blocks || []);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    if (session?.user.businessId) {
      fetchBlocks();
    }
  }, [session, fetchBlocks]);

  const handleUnblock = async () => {
    if (!unblockTarget || unblocking) return;

    setUnblocking(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/admin/customer-access-blocks/${unblockTarget.id}/revoke`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: unblockNote.trim() || null }),
      });

      if (res.ok) {
        setFeedback({ type: "success", message: "Cihaz engeli başarıyla kaldırıldı." });
        setUnblockTarget(null);
        setUnblockNote("");
        fetchBlocks();
      } else {
        const data = await res.json();
        setFeedback({ type: "error", message: data.error || "Engel kaldırılırken bir hata oluştu." });
      }
    } catch {
      setFeedback({ type: "error", message: "Bağlantı hatası." });
    } finally {
      setUnblocking(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("tr-TR", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: "var(--text-primary)" }}>
          Engelli Cihazlar
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>
          İşletmenize ait cihaz engellerini görüntüleyin ve yönetin.
        </p>
      </div>

      {/* Feedback mesajı */}
      {feedback && (
        <div style={{
          padding: "12px 16px",
          borderRadius: 10,
          marginBottom: 16,
          fontSize: 13,
          fontWeight: 500,
          background: feedback.type === "success" ? "rgba(16,185,129,0.1)" : "rgba(220,38,38,0.1)",
          color: feedback.type === "success" ? "var(--success)" : "var(--danger)",
          border: `1px solid ${feedback.type === "success" ? "rgba(16,185,129,0.2)" : "rgba(220,38,38,0.2)"}`,
        }}>
          {feedback.message}
        </div>
      )}

      {/* Filtre sekmeleri */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["active", "revoked", "all"] as const).map((status) => (
          <button
            key={status}
            onClick={() => { setStatusFilter(status); setPage(1); }}
            className={`btn btn-sm ${statusFilter === status ? "btn-primary" : "btn-ghost"}`}
          >
            {status === "active" ? "🔴 Aktif Engeller" : status === "revoked" ? "✅ Kaldırılmış" : "📋 Tümü"}
          </button>
        ))}
      </div>

      {/* Tablo */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12 }} />)}
        </div>
      ) : blocks.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔓</div>
          <p style={{ color: "var(--text-secondary)" }}>
            {statusFilter === "active"
              ? "Aktif cihaz engeli bulunmamaktadır."
              : statusFilter === "revoked"
                ? "Kaldırılmış engel kaydı bulunmamaktadır."
                : "Hiç engel kaydı bulunmamaktadır."
            }
          </p>
        </div>
      ) : (
        <>
          <div className="card" style={{ overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th>Cihaz</th>
                  <th>Engel Nedeni</th>
                  <th>Engelleyen</th>
                  <th>Engel Tarihi</th>
                  <th>Durum</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((block) => (
                  <tr key={block.id}>
                    <td>
                      <code style={{
                        fontSize: 12, padding: "3px 8px",
                        background: "var(--bg-hover)", borderRadius: 6,
                        color: "var(--text-secondary)", fontFamily: "monospace",
                      }}>
                        {block.maskedDeviceHash}
                      </code>
                    </td>
                    <td style={{ fontSize: 13, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {block.reason}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {block.createdByName ? (
                        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                          👤 {block.createdByName}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>Sistem</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {formatDate(block.createdAt)}
                    </td>
                    <td>
                      {block.status === "active" ? (
                        <span className="badge badge-danger">Aktif Engel</span>
                      ) : (
                        <div>
                          <span className="badge badge-success">Kaldırıldı</span>
                          {block.revokedAt && (
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                              {formatDate(block.revokedAt)}
                              {block.revokedByName && ` — ${block.revokedByName}`}
                            </div>
                          )}
                          {block.revocationNote && (
                            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, fontStyle: "italic" }}>
                              {block.revocationNote}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      {block.status === "active" && (
                        <button
                          onClick={() => { setUnblockTarget(block); setUnblockNote(""); setFeedback(null); }}
                          className="btn btn-sm btn-ghost"
                          style={{ color: "var(--success)", fontWeight: 600 }}
                        >
                          🔓 Engeli Kaldır
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sayfalama */}
          {pagination.totalPages > 1 && (
            <div style={{
              display: "flex", justifyContent: "center", alignItems: "center",
              gap: 12, marginTop: 20,
            }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn btn-sm btn-ghost"
              >
                ← Önceki
              </button>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Sayfa {pagination.page} / {pagination.totalPages} ({pagination.total} kayıt)
              </span>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="btn btn-sm btn-ghost"
              >
                Sonraki →
              </button>
            </div>
          )}
        </>
      )}

      {/* Unblock Modal */}
      {unblockTarget && (
        <div className="modal-overlay" onClick={() => !unblocking && setUnblockTarget(null)}>
          <div className="modal-content p-6" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>Engeli Kaldır</h2>
              <button
                onClick={() => !unblocking && setUnblockTarget(null)}
                style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 20 }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: 20, padding: 16, background: "var(--bg-hover)", borderRadius: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Cihaz:</span>
                <code style={{ fontSize: 12, color: "var(--text-primary)" }}>{unblockTarget.maskedDeviceHash}</code>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Engel Nedeni:</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", maxWidth: 200, textAlign: "right" }}>
                  {unblockTarget.reason}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Engel Tarihi:</span>
                <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{formatDate(unblockTarget.createdAt)}</span>
              </div>
            </div>

            <div style={{
              padding: "10px 14px", background: "rgba(245, 158, 11, 0.1)",
              color: "#f59e0b", borderRadius: 8, marginBottom: 16,
              fontSize: 12, fontWeight: 500, lineHeight: 1.5,
            }}>
              ⚠️ Bu işlem cihaz engelini kaldırır. Cihaz sahibi QR kodunu yeniden okuttuğunda yeni bir oturum açabilir.
              Eski oturumlar etkilenmez.
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                Açıklama (isteğe bağlı)
              </label>
              <textarea
                value={unblockNote}
                onChange={e => setUnblockNote(e.target.value.slice(0, 500))}
                className="input"
                placeholder="Engel kaldırma nedenini belirtin..."
                rows={3}
                style={{ resize: "vertical", fontSize: 13 }}
                maxLength={500}
              />
              <div style={{ textAlign: "right", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                {unblockNote.length}/500
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => !unblocking && setUnblockTarget(null)}
                className="btn btn-ghost"
                style={{ flex: 1 }}
                disabled={unblocking}
              >
                İptal
              </button>
              <button
                onClick={handleUnblock}
                disabled={unblocking}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                {unblocking ? "İşleniyor..." : "Engeli Kaldır"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
