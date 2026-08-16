"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { connectToBusinessRoom } from "@/lib/socket-client";

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  EMPTY:             { label: "Boş",              color: "#7d8590", bg: "rgba(125,133,144,0.12)", icon: "⚪" },
  OCCUPIED:          { label: "Dolu",              color: "#60a5fa", bg: "rgba(59,130,246,0.12)",  icon: "🔵" },
  HAS_ORDER:         { label: "Sipariş Var",       color: "#fcd34d", bg: "rgba(245,158,11,0.12)",  icon: "🟡" },
  PREPARING:         { label: "Hazırlanıyor",      color: "#86efac", bg: "rgba(34,197,94,0.12)",   icon: "🟢" },
  SERVED:            { label: "Servis Edildi",     color: "#6ee7b7", bg: "rgba(16,185,129,0.12)",  icon: "✅" },
  WAITING_WAITER:    { label: "Garson Bekleniyor", color: "#fca5a5", bg: "rgba(239,68,68,0.12)",   icon: "🔴" },
  PAYMENT_REQUESTED: { label: "Ödeme İsteniyor",  color: "#c4b5fd", bg: "rgba(139,92,246,0.12)",  icon: "🟣" },
  CLEANING_NEEDED:   { label: "Temizlik",          color: "#67e8f9", bg: "rgba(6,182,212,0.12)",   icon: "🧹" },
};

const PAYMENT_METHODS = [
  { value: "CASH",     label: "💵 Nakit" },
  { value: "CARD",     label: "💳 Kart" },
  { value: "ONLINE",   label: "📱 Havale/EFT" },
  { value: "OTHER",    label: "🔄 Diğer" },
];

export default function WaiterTablesPage() {
  const { data: session } = useSession();
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [sessionDetail, setSessionDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);



  // Ödeme modalı
  const [payModal, setPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [payNote, setPayNote] = useState("");
  const [receivedAmount, setReceivedAmount] = useState(""); // ✅ Nakit ödemede müşteriden alınan tutar
  const [paying, setPaying] = useState(false);

  // Masa kapatma modalı
  const [closeModal, setCloseModal] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  // ✅ Per-table loading states
  const [actionLoadingTableId, setActionLoadingTableId] = useState<string | null>(null);


  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch("/api/waiter/tables");
      const data = await res.json();
      if (res.ok) setTables(data.tables || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (session?.user.businessId) {
      fetchTables();
      const iv = setInterval(fetchTables, 5000);
      return () => clearInterval(iv);
    }
  }, [session, fetchTables]);

  // ✅ Socket.IO — masa durumu değişikliklerini anında yansıt
  useEffect(() => {
    if (!session?.user.businessId) return;
    const accessToken = (session as any).accessToken;
    if (!accessToken) return;
    const socket = connectToBusinessRoom(accessToken, fetchTables);
    const events = ["table_status_update", "table_opened", "request_status_update", "payment_collected"];
    events.forEach((ev) => socket.on(ev, fetchTables));
    return () => {
      events.forEach((ev) => socket.off(ev, fetchTables));
    };
  }, [session, fetchTables]);



  const openDetail = async (table: any) => {
    setSelectedTable(table);
    setLoadingDetail(true);
    setSessionDetail(null);
    setCloseError(null);
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

    const amount = parseFloat(payAmount);
    const received = payMethod === "CASH" ? parseFloat(receivedAmount) : null;

    // ✅ Frontend validations
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Geçerli bir ödeme tutarı girin.");
      return;
    }

    if (payMethod === "CASH") {
      if (!Number.isFinite(received) || received! <= 0) {
        alert("Müşteriden alınan nakit tutarını girin.");
        return;
      }
      if (received! < amount) {
        alert(`Alınan nakit (${received!.toFixed(2)} ₺) ödeme tutarından (${amount.toFixed(2)} ₺) az olamaz.`);
        return;
      }
    }

    setPaying(true);
    setActionLoadingTableId(selectedTable.id);
    try {
      const res = await fetch("/api/waiter/payments/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableSessionId: selectedTable.activeSession.id,
          amount,
          method: payMethod,
          receivedAmount: received, // ✅ Nakit için alınan tutar
          note: payNote || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPayModal(false);
        setPayAmount("");
        setReceivedAmount(""); // ✅ Clear received amount
        setPayNote("");
        setPayMethod("CASH");
        // ✅ Detayı yenile — API'den güncel veri al
        const r2 = await fetch(`/api/bills/${selectedTable.activeSession.id}`);
        const d2 = await r2.json();
        if (r2.ok) setSessionDetail(d2.bill);
        await fetchTables();
      } else {
        alert(data.error || "Ödeme alınamadı");
      }
    } catch (e) { console.error(e); }
    finally {
      setPaying(false);
      setActionLoadingTableId(null);
    }
  };

  const handleClose = async () => {
    if (!selectedTable?.activeSession) return;
    setClosing(true);
    setCloseError(null);
    setActionLoadingTableId(selectedTable.id);
    try {
      // Garson sadece normal kapatma yapabilir
      const res = await fetch(`/api/table-sessions/${selectedTable.activeSession.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok) {
        setCloseModal(false);
        setSelectedTable(null);
        setSessionDetail(null);
        // ✅ Tüm masaları yenile
        await fetchTables();
      } else {
        setCloseError(data.error);
      }
    } catch (e) {
      console.error(e);
      setCloseError("Bağlantı hatası");
    } finally {
      setClosing(false);
      setActionLoadingTableId(null);
    }
  };


  const fmt = (v: number | string) => Number(v).toFixed(2);

  return (
    <div>
      <h2 style={{ fontSize: 19, fontWeight: 800, marginBottom: 16 }}>Masa Durumları</h2>

      {/* Legend */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {Object.entries(STATUS_META).map(([k, v]) => (
          <span key={k} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4, color: "var(--text-secondary)" }}>
            {v.icon} {v.label}
          </span>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
          {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 14 }} />)}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
          {tables.map(table => {
            const sm = STATUS_META[table.status] || STATUS_META.EMPTY;
            const bill = table.bill;
            const hasUnpaid = bill && Number(bill.remainingAmount) > 0;

            const pendingOrders = table.orders?.filter((o: any) => o.status === "PENDING").length || 0;
            const pendingRequests = table.serviceRequests?.filter((r: any) => r.status === "PENDING").length || 0;
            const isPaymentRequested = table.status === "PAYMENT_REQUESTED";
            const totalBadges = pendingOrders + pendingRequests + (isPaymentRequested ? 1 : 0);

            const isThisTableLoading = actionLoadingTableId === table.id;

            return (
              <div key={table.id} className="card" onClick={() => !isThisTableLoading && openDetail(table)} style={{
                padding: 14, cursor: isThisTableLoading ? "wait" : "pointer", position: "relative", overflow: "visible",
                borderLeft: `3px solid ${sm.color}`,
                opacity: isThisTableLoading ? 0.6 : 1,
                transition: "opacity 0.2s",
              }}>
                {totalBadges > 0 && (
                  <span style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    background: "#ef4444",
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
                    animation: "pulse-glow 2s infinite",
                  }}>
                    {totalBadges}
                  </span>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <p style={{ fontWeight: 700, fontSize: 14 }}>{table.tableName || `Masa ${table.tableNumber}`}</p>
                  <span style={{ fontSize: 16 }}>{sm.icon}</span>
                </div>
                <p style={{ fontSize: 11, color: sm.color, fontWeight: 600, marginBottom: 6 }}>{sm.label}</p>

                {bill && table.status !== "EMPTY" && (
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Toplam:</span>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{fmt(bill.totalAmount)} ₺</span>
                    </div>
                    {Number(bill.paidAmount) > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Ödenen:</span>
                        <span style={{ fontWeight: 600, color: "#10b981" }}>{fmt(bill.paidAmount)} ₺</span>
                      </div>
                    )}
                    {hasUnpaid && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Kalan:</span>
                        <span style={{ fontWeight: 700, color: "#ef4444" }}>{fmt(bill.remainingAmount)} ₺</span>
                      </div>
                    )}
                  </div>
                )}

                {table.serviceRequests?.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 10, color: "#fca5a5", fontWeight: 600 }}>
                    🔔 {table.serviceRequests.length} talep
                  </div>
                )}



              </div>
            );
          })}
        </div>
      )}

      {/* ── Masa Detay Modalı ─────────────────────────────────────────────── */}
      {selectedTable && (
        <div className="modal-overlay" onClick={() => setSelectedTable(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: 0, maxWidth: 480 }}>
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800 }}>{selectedTable.tableName || `Masa ${selectedTable.tableNumber}`}</h3>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  {STATUS_META[selectedTable.status]?.label}
                  {selectedTable.activeSession && (
                    <span style={{ marginLeft: 8, color: "#10b981" }}>
                      · Oturum aktif {new Date(selectedTable.activeSession.startedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} den beri
                    </span>
                  )}
                </p>
              </div>
              <button onClick={() => setSelectedTable(null)} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ padding: "16px 20px", maxHeight: "65vh", overflowY: "auto" }}>
              {loadingDetail ? (
                <div style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>Yükleniyor...</div>
              ) : !selectedTable.activeSession ? (
                <div style={{ textAlign: "center", padding: 32 }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>⚪</div>
                  <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Bu masa şu anda boş</p>
                </div>
              ) : (
                <>
                  {/* Adisyon özeti */}
                  {sessionDetail && (
                    <div style={{ background: "var(--bg-hover)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Adisyon</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {[
                          { label: "Toplam Hesap", value: `${fmt(sessionDetail.totalAmount)} ₺`, color: "var(--text-primary)" },
                          { label: "Ödenen", value: `${fmt(sessionDetail.paidAmount)} ₺`, color: "#10b981" },
                          { label: "Kalan", value: `${fmt(sessionDetail.remainingAmount)} ₺`, color: Number(sessionDetail.remainingAmount) > 0 ? "#ef4444" : "#10b981" },
                        ].map(r => (
                          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                            <span style={{ color: "var(--text-secondary)" }}>{r.label}</span>
                            <span style={{ fontWeight: 700, color: r.color }}>{r.value}</span>
                          </div>
                        ))}
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, paddingTop: 6, borderTop: "1px solid var(--border-subtle)" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Ödeme Durumu</span>
                          <span style={{ fontWeight: 700, color: sessionDetail.paymentStatus === "PAID" ? "#10b981" : sessionDetail.paymentStatus === "PARTIALLY_PAID" ? "#f59e0b" : "#ef4444" }}>
                            {sessionDetail.paymentStatus === "PAID" ? "✅ Ödendi" : sessionDetail.paymentStatus === "PARTIALLY_PAID" ? "⚡ Kısmi Ödendi" : "❌ Ödenmedi"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Siparişler */}
                  {sessionDetail?.tableSession?.orders?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Siparişler</p>
                      {sessionDetail.tableSession.orders.map((order: any) => (
                        <div key={order.id} style={{ background: "var(--bg-card)", borderRadius: 10, padding: "10px 14px", marginBottom: 8, border: "1px solid var(--border-subtle)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(order.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary-light)" }}>{fmt(order.totalPrice)} ₺</span>
                          </div>
                          {order.items.map((item: any, i: number) => (
                            <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
                              <span>{item.quantity}× {item.productName}</span>
                              <span>{fmt(item.totalPrice)} ₺</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Ödeme geçmişi */}
                  {sessionDetail?.payments?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Ödeme Geçmişi</p>
                      {sessionDetail.payments.map((p: any) => (
                        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                          <span style={{ color: "var(--text-secondary)" }}>
                            {PAYMENT_METHODS.find(m => m.value === p.method)?.label || p.method}
                            {p.handledByWaiterName && ` · ${p.handledByWaiterName}`}
                          </span>
                          <span style={{ fontWeight: 700, color: "#10b981" }}>+{fmt(p.amount)} ₺</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Aksiyon butonları */}
            {selectedTable.activeSession && (
              <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => { setPayModal(true); setPayAmount(sessionDetail ? fmt(sessionDetail.remainingAmount) : ""); }} className="btn btn-success btn-sm" style={{ flex: 1 }}>
                  💰 Ödeme Al
                </button>
                <button onClick={() => { setCloseModal(true); setCloseError(null); }} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>
                  🔒 Masayı Kapat
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Ödeme Alma Modalı ─────────────────────────────────────────────── */}
      {payModal && (() => {
        const dueAmount = parseFloat(payAmount) || 0;
        const received = parseFloat(receivedAmount) || 0;
        const change = payMethod === "CASH" && received > 0 ? received - dueAmount : 0;

        return (
          <div className="modal-overlay" onClick={() => setPayModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: 24, maxWidth: 400 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>💰 Ödeme Al</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
                {selectedTable?.tableName || `Masa ${selectedTable?.tableNumber}`}
                {sessionDetail && <span style={{ color: "#ef4444", fontWeight: 700 }}> · Kalan: {fmt(sessionDetail.remainingAmount)} ₺</span>}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Ödenecek Tutar (₺) *</label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                    style={{ fontSize: 18, fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Ödeme Yöntemi *</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {PAYMENT_METHODS.map(m => (
                      <button key={m.value} onClick={() => {
                        setPayMethod(m.value);
                        if (m.value !== "CASH") setReceivedAmount(""); // ✅ Clear received amount for non-cash
                      }} style={{
                        padding: "10px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                        border: `2px solid ${payMethod === m.value ? "var(--primary)" : "var(--border-color)"}`,
                        background: payMethod === m.value ? "var(--primary-glow)" : "transparent",
                        color: payMethod === m.value ? "var(--primary-light)" : "var(--text-secondary)",
                        cursor: "pointer",
                      }}>{m.label}</button>
                    ))}
                  </div>
                </div>

                {/* ✅ Nakit için alınan tutar alanı */}
                {payMethod === "CASH" && (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Müşteriden Alınan Nakit (₺) *
                    </label>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={receivedAmount}
                      onChange={e => setReceivedAmount(e.target.value)}
                      placeholder={dueAmount > 0 ? dueAmount.toFixed(2) : "250.00"}
                      style={{ fontSize: 18, fontWeight: 700 }}
                    />
                    {/* ✅ Para üstü hesaplama ve gösterim */}
                    {received > 0 && (
                      <div style={{
                        marginTop: 12,
                        padding: "12px 16px",
                        borderRadius: 10,
                        background: change >= 0 ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                        border: `1px solid ${change >= 0 ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Para Üstü</span>
                          <span style={{ fontSize: 18, fontWeight: 800, color: change >= 0 ? "#10b981" : "#ef4444" }}>
                            {change >= 0 ? `${change.toFixed(2)} ₺` : "⚠️ Yetersiz"}
                          </span>
                        </div>
                        {change >= 0 && dueAmount > 0 && (
                          <div style={{ fontSize: 11, color: "var(--text-secondary)", paddingTop: 6, borderTop: "1px solid var(--border-subtle)" }}>
                            Ciroya yansıyacak: <span style={{ fontWeight: 700, color: "var(--primary-light)" }}>{dueAmount.toFixed(2)} ₺</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Not (opsiyonel)</label>
                  <input className="input" value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="Ödeme notu..." />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button
                  onClick={handlePay}
                  disabled={paying || !payAmount || parseFloat(payAmount) <= 0 || (payMethod === "CASH" && (!receivedAmount || parseFloat(receivedAmount) < parseFloat(payAmount)))}
                  className="btn btn-success"
                  style={{ flex: 1, opacity: (paying || !payAmount || parseFloat(payAmount) <= 0 || (payMethod === "CASH" && (!receivedAmount || parseFloat(receivedAmount) < parseFloat(payAmount)))) ? 0.5 : 1 }}
                >
                  {paying ? "İşleniyor..." : "Ödemeyi Onayla"}
                </button>
                <button onClick={() => { setPayModal(false); setReceivedAmount(""); }} className="btn btn-ghost">İptal</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Masa Kapatma Modalı ───────────────────────────────────────────── */}
      {closeModal && (
        <div className="modal-overlay" onClick={() => setCloseModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: 24, maxWidth: 380 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>🔒 Masayı Kapat</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
              {selectedTable?.tableName || `Masa ${selectedTable?.tableNumber}`}
            </p>

            {closeError && (
              <div style={{ padding: "12px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>
                ⚠️ {closeError}
                <p style={{ marginTop: 8, fontSize: 11, color: "#7d8590" }}>
                  Masada aktif sipariş varken kapatmak için admin yetkisi gereklidir.
                </p>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                onClick={handleClose}
                disabled={closing}
                className="btn btn-danger"
                style={{ flex: 1 }}
              >
                {closing ? "Kapatılıyor..." : "Masayı Kapat"}
              </button>
              <button onClick={() => setCloseModal(false)} className="btn btn-ghost">İptal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
