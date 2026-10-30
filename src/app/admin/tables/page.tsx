"use client";

import { useState } from "react";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useBusinessSocket } from "@/hooks/useBusinessSocket";
import Loader from "@/components/ui/Loader";
import Dialog from "@/components/ui/Dialog";
import FormError from "@/components/ui/FormError";
import QueryError from "@/components/ui/QueryError";
import { formatTRY } from "@/lib/format";

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  EMPTY:             { label: "Boş",              color: "#A89585", bg: "rgba(166,138,120,0.12)" },
  OCCUPIED:          { label: "Dolu",              color: "#60a5fa", bg: "rgba(59,130,246,0.12)" },
  HAS_ORDER:         { label: "Sipariş Var",       color: "#FCD27A", bg: "rgba(244,166,35,0.12)" },
  PREPARING:         { label: "Hazırlanıyor",      color: "#8EDBA2", bg: "rgba(34,197,94,0.12)" },
  SERVED:            { label: "Servis Edildi",     color: "#8EDBA2", bg: "rgba(59,165,92,0.12)" },
  WAITING_WAITER:    { label: "Garson Bekleniyor", color: "#fca5a5", bg: "rgba(239,68,68,0.12)" },
  PAYMENT_REQUESTED: { label: "Ödeme İsteniyor",  color: "#EBAFD0", bg: "rgba(163,71,122,0.12)" },
  CLEANING_NEEDED:   { label: "Temizlik",          color: "#67e8f9", bg: "rgba(6,182,212,0.12)" },
};

const PAYMENT_METHODS = [
  { value: "CASH",   label: "💵 Nakit" },
  { value: "CARD",   label: "💳 Kart" },
  { value: "ONLINE", label: "📱 Havale/EFT" },
  { value: "OTHER",  label: "🔄 Diğer" },
];

const FORCE_CLOSE_REASONS = ["İkram", "İptal", "Müşteri ayrıldı", "Hatalı sipariş", "Diğer"];

const TABLE_EVENTS = ["table_status_update", "table_opened", "request_status_update", "payment_collected"];

export default function AdminTablesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ tableNumber: "", tableName: "" });
  const [creating, setCreating] = useState(false);
  const [qrModal, setQrModal] = useState<any>(null);
  const [deleteModal, setDeleteModal] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  // Modal içi hatalar (FormError): toast açık <dialog>'un arkasında kalırdı
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  // Detay modal state
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [sessionDetail, setSessionDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Ödeme modal state
  const [payModal, setPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [payNote, setPayNote] = useState("");
  const [payReceivedAmount, setPayReceivedAmount] = useState("");
  const [paying, setPaying] = useState(false);

  // Masa kapatma modal state
  const [closeModal, setCloseModal] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [forceClose, setForceClose] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [closing, setClosing] = useState(false);

  // Sekme gizliyken polling durur; ekran ayrılınca uçuştaki istek iptal edilir
  const tablesQuery = useApiQuery<any[]>("/api/admin/tables", {
    select: (j) => (j as { tables?: any[] } | null)?.tables ?? [],
    refreshInterval: 8000,
  });
  const tables = tablesQuery.data ?? [];
  const loading = tablesQuery.isLoading;
  const fetchTables = tablesQuery.refresh;

  // ✅ Socket.IO — masa durumu değişikliklerini anında yansıt
  useBusinessSocket(TABLE_EVENTS, fetchTables);

  const closeCreate = () => { setShowCreate(false); setCreateError(null); };
  const closeDelete = () => { setDeleteModal(null); setDeleteError(null); };
  const closePay = () => { setPayModal(false); setPayError(null); };

  const createTable = async () => {
    if (!createForm.tableNumber.trim()) return;
    setCreating(true); setCreateError(null);
    try {
      const res = await fetch("/api/admin/tables", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      if (res.ok) { fetchTables(); closeCreate(); setCreateForm({ tableNumber: "", tableName: "" }); }
      else { const d = await res.json(); setCreateError(d.error || "Masa oluşturulamadı"); }
    } catch (e) { console.error(e); setCreateError("Bağlantı hatası. Lütfen tekrar deneyin."); }
    finally { setCreating(false); }
  };

  const generateQR = async (tableId: string) => {
    const res = await fetch(`/api/admin/tables/${tableId}/generate-qr`, { method: "POST" });
    const data = await res.json();
    if (res.ok) setQrModal({ qrImageData: data.qrImageData, qrUrl: data.qrUrl, tableName: data.tableName || `Masa ${data.tableNumber}` });
  };

  const deleteTable = async () => {
    if (!deleteModal) return;
    setDeleting(true); setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/tables/${deleteModal.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) { fetchTables(); closeDelete(); }
      else setDeleteError(data.message || data.error || "Masa silinirken hata oluştu.");
    } catch (e) { console.error(e); setDeleteError("Bağlantı hatası. Lütfen tekrar deneyin."); }
    finally { setDeleting(false); }
  };

  const openDetail = async (table: any) => {
    setSelectedTable(table);
    setLoadingDetail(true);
    setSessionDetail(null);
    setCloseError(null);
    setForceClose(false);
    setCloseReason("");
    if (table.activeSession) {
      try {
        const res = await fetch(`/api/bills/${table.activeSession.id}`);
        const data = await res.json();
        if (res.ok) setSessionDetail(data.bill);
      } catch (e) { console.error(e); }
    }
    setLoadingDetail(false);
  };

  const handlePay = async () => {
    if (!selectedTable?.activeSession || !payAmount || !payMethod) return;
    // Nakit ödeme için alınan tutar zorunlu
    if (payMethod === "CASH" && (!payReceivedAmount || parseFloat(payReceivedAmount) < parseFloat(payAmount))) {
      setPayError("Nakit ödeme için alınan tutar, ödeme tutarından az olamaz.");
      return;
    }
    setPaying(true); setPayError(null);
    try {
      const requestBody: Record<string, unknown> = {
        tableSessionId: selectedTable.activeSession.id,
        amount: parseFloat(payAmount),
        method: payMethod,
        note: payNote || null,
      };
      // Nakit ödeme ise receivedAmount ekle
      if (payMethod === "CASH") {
        requestBody.receivedAmount = parseFloat(payReceivedAmount);
      }
      const res = await fetch("/api/waiter/payments/collect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = await res.json();
      if (res.ok) {
        closePay(); setPayAmount(""); setPayNote(""); setPayMethod("CASH"); setPayReceivedAmount("");
        const r2 = await fetch(`/api/bills/${selectedTable.activeSession.id}`);
        const d2 = await r2.json();
        if (r2.ok) setSessionDetail(d2.bill);
        fetchTables();
      } else setPayError(data.error || "Ödeme alınamadı");
    } catch (e) { console.error(e); setPayError("Bağlantı hatası. Lütfen tekrar deneyin."); }
    finally { setPaying(false); }
  };

  const handleClose = async () => {
    if (!selectedTable?.activeSession) return;
    setClosing(true); setCloseError(null);
    try {
      // Admin zorla kapatma kullanıyorsa force-close endpoint'ini kullan
      if (forceClose) {
        const res = await fetch(`/api/admin/tables/${selectedTable.id}/force-close`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ closeReason }),
        });
        const data = await res.json();
        if (res.ok) {
          setCloseModal(false);
          setSelectedTable(null);
          setSessionDetail(null);
          fetchTables();
        } else {
          setCloseError(data.error);
        }
      } else {
        // Normal kapatma — body gönder
        const res = await fetch(`/api/table-sessions/${selectedTable.activeSession.id}/close`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forceClose: false }),
        });
        const data = await res.json();
        if (res.ok) {
          setCloseModal(false);
          setSelectedTable(null);
          setSessionDetail(null);
          fetchTables();
        } else {
          setCloseError(data.error);
          // Eğer API "canForceClose: true" dönüyorsa admin zorla kapatabilir
          if (data.canForceClose === true) {
            setForceClose(true);
          }
        }
      }
    } catch (e) {
      console.error(e);
      setCloseError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setClosing(false);
    }
  };

  // Ödeme tutarı alanının değeri (type="number" "12.50" bekler); ekranda formatTRY
  const fmt = (v: any) => Number(v || 0).toFixed(2);
  const occupied = tables.filter(t => t.status !== "EMPTY").length;
  const pendingPayment = tables.filter(t => t.bill && Number(t.bill.remainingAmount) > 0).length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>Masa & QR Yönetimi</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 3 }}>
            {tables.length} masa · {occupied} dolu · {tables.length - occupied} boş
            {pendingPayment > 0 && <span style={{ color: "#EBAFD0", marginLeft: 8 }}>· {pendingPayment} bekleyen ödeme</span>}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary">+ Yeni Masa</button>
      </div>

      {/* Bekleyen ödeme uyarısı */}
      {pendingPayment > 0 && (
        <div style={{ padding: "12px 16px", background: "rgba(163,71,122,0.08)", border: "1px solid rgba(163,71,122,0.2)", borderRadius: 10, marginBottom: 16, fontSize: 13, color: "#EBAFD0", display: "flex", alignItems: "center", gap: 8 }}>
          💳 <strong>{pendingPayment} masada</strong> bekleyen ödeme var. Ödeme almak için masa kartına tıklayın.
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <Dialog onClose={closeCreate} contentStyle={{ padding: 28, maxWidth: 380 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Yeni Masa Ekle</h2>
              <button aria-label="Kapat" className="tap-target" onClick={closeCreate} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label htmlFor="f-masa-numarasi" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Masa Numarası *</label>
                <input id="f-masa-numarasi" className="input" value={createForm.tableNumber} onChange={e => setCreateForm({ ...createForm, tableNumber: e.target.value })} placeholder="Örn: 12" data-autofocus />
              </div>
              <div>
                <label htmlFor="f-masa-adi-opsiyonel" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Masa Adı (Opsiyonel)</label>
                <input id="f-masa-adi-opsiyonel" className="input" value={createForm.tableName} onChange={e => setCreateForm({ ...createForm, tableName: e.target.value })} placeholder="Örn: Bahçe 3, Teras 1" />
              </div>
            </div>
            <FormError message={createError} style={{ marginTop: 14 }} />
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={createTable} disabled={creating || !createForm.tableNumber.trim()} className="btn btn-primary" style={{ flex: 1 }}>
                {creating ? "Oluşturuluyor..." : "Masa Oluştur"}
              </button>
              <button onClick={closeCreate} className="btn btn-ghost">İptal</button>
            </div>
          </Dialog>
      )}

      {/* QR Modal */}
      {qrModal && (
        <Dialog onClose={() => setQrModal(null)} contentStyle={{ padding: 28, textAlign: "center", maxWidth: 380 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{qrModal.tableName}</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>QR Kodu yazdırın veya indirin</p>
            <div style={{ background: "white", borderRadius: 16, padding: 16, display: "inline-block", marginBottom: 16 }}>
              <img src={qrModal.qrImageData} alt="QR" style={{ width: 220, height: 220, display: "block" }} />
            </div>
            <p style={{ fontSize: 11, color: "var(--text-secondary)", wordBreak: "break-all", marginBottom: 20, padding: "0 8px" }}>{qrModal.qrUrl}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <a href={qrModal.qrImageData} download={`qr_${qrModal.tableName}.png`} className="btn btn-primary" style={{ flex: 1, textDecoration: "none" }}>📥 İndir</a>
              <button onClick={() => setQrModal(null)} className="btn btn-ghost">Kapat</button>
            </div>
          </Dialog>
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <Dialog onClose={closeDelete} contentStyle={{ padding: 28, maxWidth: 380 }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🗑️</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Masayı Sil</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}><strong style={{ color: "var(--text-primary)" }}>"{deleteModal.name}"</strong> adlı masayı silmek üzeresiniz.</p>
            </div>
            <div style={{ padding: "12px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, marginBottom: 20, fontSize: 13, color: "#fca5a5" }}>
              ⚠️ Aktif sipariş, talep veya ödeme varsa silme engellenecektir.
            </div>
            <FormError message={deleteError} style={{ marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={closeDelete} className="btn btn-ghost" style={{ flex: 1 }}>İptal</button>
              <button onClick={deleteTable} disabled={deleting} className="btn btn-danger" style={{ flex: 1 }}>{deleting ? "Siliniyor..." : "Evet, Sil"}</button>
            </div>
          </Dialog>
      )}

      <QueryError message={tablesQuery.error} onRetry={fetchTables} />

      {/* Tables Grid */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 14 }} />)}
        </div>
      ) : tables.length === 0 ? (
        <div className="card" style={{ padding: "56px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🪑</div>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20 }}>Henüz masa eklenmemiş</p>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary">İlk Masayı Ekle</button>
        </div>
      ) : (
        <div className="stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {tables.map(table => {
            const sm = STATUS_META[table.status] || STATUS_META.EMPTY;
            const bill = table.bill;
            const hasUnpaid = bill && Number(bill.remainingAmount) > 0;

            const pendingOrders = table.orders?.filter((o: any) => o.status === "PENDING").length || 0;
            const pendingRequests = table.serviceRequests?.filter((r: any) => r.status === "PENDING").length || 0;
            const isPaymentRequested = table.status === "PAYMENT_REQUESTED";
            const totalBadges = pendingOrders + pendingRequests + (isPaymentRequested ? 1 : 0);

            return (
              <div key={table.id} className="card" style={{
                padding: 16, position: "relative", overflow: "visible", cursor: "pointer",
                borderLeft: `3px solid ${sm.color}`,
                transition: "all 0.15s",
              }}>
                <button
                  type="button"
                  className="card-hit"
                  onClick={() => openDetail(table)}
                  aria-label={`${table.tableName || `Masa ${table.tableNumber}`}, ${sm.label}${totalBadges > 0 ? `, ${totalBadges} bekleyen işlem` : ""} — detayları aç`}
                />
                {totalBadges > 0 && (
                  <span className="animate-pulse-glow" style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    background: "var(--danger)",
                    color: "white",
                    borderRadius: 99,
                    fontSize: 10,
                    fontWeight: 800,
                    minWidth: 20,
                    height: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 5px",
                    boxShadow: "0 2px 8px rgba(239,68,68,0.4), 0 0 0 2px var(--bg-card)",
                    zIndex: 10,
                  }}>
                    {totalBadges}
                  </span>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 15 }}>{table.tableName || `Masa ${table.tableNumber}`}</p>
                    <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 1 }}>#{table.tableNumber}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 99, background: sm.bg, color: sm.color }}>{sm.label}</span>
                </div>

                {/* Adisyon bilgisi */}
                {bill && table.status !== "EMPTY" && (
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8, padding: "6px 8px", background: "var(--bg-hover)", borderRadius: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span>Toplam:</span>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{formatTRY(bill.totalAmount)}</span>
                    </div>
                    {Number(bill.paidAmount) > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span>Ödenen:</span>
                        <span style={{ fontWeight: 600, color: "#3BA55C" }}>{formatTRY(bill.paidAmount)}</span>
                      </div>
                    )}
                    {hasUnpaid && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Kalan:</span>
                        <span style={{ fontWeight: 700, color: "var(--danger-text)" }}>{formatTRY(bill.remainingAmount)}</span>
                      </div>
                    )}
                  </div>
                )}

                {(table.orders?.length > 0 || table.serviceRequests?.length > 0) && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    {table.orders?.length > 0 && <span style={{ fontSize: 10, color: "#FCD27A" }}>🧾 {table.orders.length}</span>}
                    {table.serviceRequests?.length > 0 && <span style={{ fontSize: 10, color: "#fca5a5" }}>🔔 {table.serviceRequests.length}</span>}
                  </div>
                )}

                <div className="card-actions" style={{ display: "flex", gap: 5 }}>
                  <button onClick={() => generateQR(table.id)} className="btn btn-sm btn-ghost" style={{ flex: 1, fontSize: 11 }}>📱 QR</button>
                  <button onClick={() => setDeleteModal({ id: table.id, name: table.tableName || `Masa ${table.tableNumber}` })} aria-label={`${table.tableName || `Masa ${table.tableNumber}`} sil`} className="btn btn-sm btn-ghost" style={{ padding: "5px 8px", color: "var(--danger-text)" }}>🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Masa Detay Modalı ─────────────────────────────────────────────── */}
      {selectedTable && (
        <Dialog onClose={() => setSelectedTable(null)} contentStyle={{ padding: 0, maxWidth: 500 }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800 }}>{selectedTable.tableName || `Masa ${selectedTable.tableNumber}`}</h2>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  {STATUS_META[selectedTable.status]?.label}
                  {selectedTable.activeSession && (
                    <span style={{ marginLeft: 8, color: "#3BA55C" }}>
                      · Oturum: {new Date(selectedTable.activeSession.startedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} den beri
                    </span>
                  )}
                </p>
              </div>
              <button aria-label="Kapat" className="tap-target" onClick={() => setSelectedTable(null)} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ padding: "16px 20px", maxHeight: "60dvh", overflowY: "auto" }}>
              {loadingDetail ? (
                <Loader />
              ) : !selectedTable.activeSession ? (
                <div style={{ textAlign: "center", padding: 32 }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>⚪</div>
                  <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Bu masa şu anda boş</p>
                </div>
              ) : (
                <>
                  {sessionDetail && (
                    <div style={{ background: "var(--bg-hover)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Adisyon</p>
                      {[
                        { label: "Toplam Hesap", value: formatTRY(sessionDetail.totalAmount), color: "var(--text-primary)" },
                        { label: "Ödenen", value: formatTRY(sessionDetail.paidAmount), color: "#3BA55C" },
                        { label: "Kalan", value: formatTRY(sessionDetail.remainingAmount), color: Number(sessionDetail.remainingAmount) > 0 ? "var(--danger-text)" : "#3BA55C" },
                      ].map(r => (
                        <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 6 }}>
                          <span style={{ color: "var(--text-secondary)" }}>{r.label}</span>
                          <span style={{ fontWeight: 700, color: r.color }}>{r.value}</span>
                        </div>
                      ))}
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Ödeme Durumu</span>
                        <span style={{ fontWeight: 700, color: sessionDetail.paymentStatus === "PAID" ? "#3BA55C" : sessionDetail.paymentStatus === "PARTIALLY_PAID" ? "#F4A623" : "var(--danger-text)" }}>
                          {sessionDetail.paymentStatus === "PAID" ? "✅ Ödendi" : sessionDetail.paymentStatus === "PARTIALLY_PAID" ? "⚡ Kısmi" : "❌ Ödenmedi"}
                        </span>
                      </div>
                    </div>
                  )}

                  {sessionDetail?.tableSession?.orders?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Siparişler</p>
                      {sessionDetail.tableSession.orders.map((order: any) => (
                        <div key={order.id} style={{ background: "var(--bg-card)", borderRadius: 10, padding: "10px 14px", marginBottom: 8, border: "1px solid var(--border-subtle)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(order.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary-light)" }}>{formatTRY(order.totalPrice)}</span>
                          </div>
                          {order.items.map((item: any, i: number) => (
                            <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
                              <span>{item.quantity}× {item.productName}</span>
                              <span>{formatTRY(item.totalPrice)}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {sessionDetail?.payments?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Ödeme Geçmişi</p>
                      {sessionDetail.payments.map((p: any) => (
                        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                          <span style={{ color: "var(--text-secondary)" }}>
                            {PAYMENT_METHODS.find(m => m.value === p.method)?.label || p.method}
                            {p.handledByWaiterName && ` · ${p.handledByWaiterName}`}
                          </span>
                          <span style={{ fontWeight: 700, color: "#3BA55C" }}>+{formatTRY(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {selectedTable.activeSession && (
              <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => { setPayModal(true); setPayAmount(sessionDetail ? fmt(sessionDetail.remainingAmount) : ""); }} className="btn btn-success btn-sm" style={{ flex: 1 }}>
                  💰 Ödeme Al
                </button>
                <button onClick={() => { setCloseModal(true); setCloseError(null); setForceClose(false); }} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>
                  🔒 Masayı Kapat
                </button>
              </div>
            )}
          </Dialog>
      )}

      {/* ── Ödeme Alma Modalı ─────────────────────────────────────────────── */}
      {payModal && (
        <Dialog onClose={closePay} contentStyle={{ padding: 24, maxWidth: 380 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>💰 Ödeme Al</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
              {selectedTable?.tableName || `Masa ${selectedTable?.tableNumber}`}
              {sessionDetail && <span style={{ color: "var(--danger-text)", fontWeight: 700 }}> · Kalan: {formatTRY(sessionDetail.remainingAmount)}</span>}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label htmlFor="f-tutar" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Tutar (₺) *</label>
                <input id="f-tutar" className="input" type="number" step="0.01" min="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0.00" data-autofocus style={{ fontSize: 18, fontWeight: 700 }} />
              </div>
              <div>
                <p id="pay-method-label" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Ödeme Yöntemi *</p>
                <div role="group" aria-labelledby="pay-method-label" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {PAYMENT_METHODS.map(m => (
                    <button key={m.value} type="button" aria-pressed={payMethod === m.value} onClick={() => setPayMethod(m.value)} style={{
                      padding: "10px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                      border: `2px solid ${payMethod === m.value ? "var(--primary)" : "var(--border-color)"}`,
                      background: payMethod === m.value ? "var(--primary-glow)" : "transparent",
                      color: payMethod === m.value ? "var(--primary-light)" : "var(--text-secondary)",
                      cursor: "pointer",
                    }}>{payMethod === m.value ? "✓ " : ""}{m.label}</button>
                  ))}
                </div>
              </div>
              {payMethod === "CASH" && (
                <div>
                  <label htmlFor="f-alinan-tutar" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Alınan Tutar (₺) *</label>
                  <input id="f-alinan-tutar" className="input" type="number" step="0.01" min="0.01" value={payReceivedAmount} onChange={e => setPayReceivedAmount(e.target.value)} placeholder="0.00" style={{ fontSize: 18, fontWeight: 700 }} />
                  {payReceivedAmount && payAmount && parseFloat(payReceivedAmount) >= parseFloat(payAmount) && (
                    <p style={{ marginTop: 6, fontSize: 13, color: "var(--success-text)", fontWeight: 600 }}>
                      Para Üstü: {formatTRY(parseFloat(payReceivedAmount) - parseFloat(payAmount))}
                    </p>
                  )}
                  {payReceivedAmount && payAmount && parseFloat(payReceivedAmount) < parseFloat(payAmount) && (
                    <p style={{ marginTop: 6, fontSize: 13, color: "var(--danger-text)", fontWeight: 600 }}>
                      Alınan tutar yetersiz!
                    </p>
                  )}
                </div>
              )}
              <div>
                <label htmlFor="f-not-opsiyonel" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Not (opsiyonel)</label>
                <input id="f-not-opsiyonel" className="input" value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="Ödeme notu..." />
              </div>
            </div>
            <FormError message={payError} style={{ marginTop: 14 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button onClick={handlePay} disabled={paying || !payAmount || parseFloat(payAmount) <= 0 || (payMethod === "CASH" && (!payReceivedAmount || parseFloat(payReceivedAmount) < parseFloat(payAmount)))} className="btn btn-success" style={{ flex: 1 }}>
                {paying ? "İşleniyor..." : "Ödemeyi Onayla"}
              </button>
              <button onClick={closePay} className="btn btn-ghost">İptal</button>
            </div>
          </Dialog>
      )}

      {/* ── Masa Kapatma Modalı ───────────────────────────────────────────── */}
      {closeModal && (
        <Dialog onClose={() => setCloseModal(false)} contentStyle={{ padding: 24, maxWidth: 380 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>🔒 Masayı Kapat</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
              {selectedTable?.tableName || `Masa ${selectedTable?.tableNumber}`}
            </p>
            {closeError && (
              <div style={{ padding: "12px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>
                ⚠️ {closeError}
                {!forceClose && (
                  <button onClick={() => setForceClose(true)} style={{ display: "block", marginTop: 8, color: "#F4A623", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                    Admin olarak zorla kapat →
                  </button>
                )}
              </div>
            )}
            {forceClose && (
              <div style={{ marginBottom: 16 }}>
                <p id="close-reason-label" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Kapatma Nedeni *</p>
                <div role="group" aria-labelledby="close-reason-label" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {FORCE_CLOSE_REASONS.map(r => (
                    <button key={r} type="button" aria-pressed={closeReason === r} onClick={() => setCloseReason(r)} style={{
                      padding: "9px 14px", borderRadius: 9, textAlign: "left", fontSize: 13,
                      border: `1.5px solid ${closeReason === r ? "var(--primary)" : "var(--border-color)"}`,
                      background: closeReason === r ? "var(--primary-glow)" : "transparent",
                      color: closeReason === r ? "var(--primary-light)" : "var(--text-secondary)",
                      cursor: "pointer",
                    }}>{closeReason === r ? "✓ " : ""}{r}</button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={handleClose} disabled={closing || (forceClose && !closeReason)} className={`btn ${forceClose ? "btn-warning" : "btn-danger"}`} style={{ flex: 1 }}>
                {closing ? "Kapatılıyor..." : forceClose ? "Zorla Kapat" : "Masayı Kapat"}
              </button>
              <button onClick={() => setCloseModal(false)} className="btn btn-ghost">İptal</button>
            </div>
          </Dialog>
      )}
    </div>
  );
}
