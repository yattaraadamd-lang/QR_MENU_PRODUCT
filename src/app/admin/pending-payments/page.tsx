"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { CheckCircle2, XCircle, Clock, Banknote, CreditCard, AlertCircle } from "lucide-react";

type Bill = {
  id: string;
  totalAmount: string;
  paidAmount: string;
  remainingAmount: string;
  status: string;
  updatedAt: string;
  table: { tableNumber: string; tableName: string | null };
};

type PaymentRequest = {
  id: string;
  amount: string;
  receivedAmount: string | null;
  changeAmount: string | null;
  method: string;
  note: string | null;
  status: string;
  requestedByName: string | null;
  approvalRequestedAt: string | null;
  createdAt: string;
  table: { tableNumber: string; tableName: string | null };
};

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function PendingPaymentsPage() {
  const { data: session } = useSession();
  const [bills, setBills] = useState<Bill[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Bill Pay Modal State
  const [payModal, setPayModal] = useState<Bill | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState("CARD");
  const [receivedAmount, setReceivedAmount] = useState<string>("");
  const [processingBillId, setProcessingBillId] = useState<string | null>(null);

  // Reject Modal State
  const [rejectModal, setRejectModal] = useState<PaymentRequest | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");
  const [rejecting, setRejecting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const idempotencyKeyRef = useRef<string>("");

  const fetchData = useCallback(async () => {
    try {
      const [billsRes, paymentsRes] = await Promise.all([
        fetch("/api/admin/pending-payments"),
        fetch("/api/admin/payments"),
      ]);

      if (billsRes.ok) {
        const data = await billsRes.json();
        setBills(data.bills || []);
      }

      if (paymentsRes.ok) {
        const data = await paymentsRes.json();
        const pendingOrAwaiting = (data.payments || []).filter(
          (p: any) => p.status === "AWAITING_ADMIN_APPROVAL" || p.status === "PENDING"
        );
        setApprovalRequests(pendingOrAwaiting);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user.businessId) {
      fetchData();
      const iv = setInterval(fetchData, 6000);
      return () => clearInterval(iv);
    }
  }, [session, fetchData]);

  const openPayModal = (bill: Bill) => {
    setPayModal(bill);
    setPaymentAmount(bill.remainingAmount);
    setPaymentMethod("CARD");
    setReceivedAmount("");
    setError(null);
    setSuccessMessage(null);
    idempotencyKeyRef.current = generateUUID();
  };

  const handleApproveRequest = async (req: PaymentRequest) => {
    setProcessingBillId(req.id);
    setError(null);
    try {
      const body: any = {
        amount: Number(req.amount),
        method: req.method || "CASH",
        receivedAmount: req.receivedAmount ? Number(req.receivedAmount) : null,
        note: req.note,
        idempotencyKey: generateUUID(),
      };

      const res = await fetch(`/api/admin/payments/${req.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(
          req.method === "CASH" && data.changeAmount > 0
            ? `Ödeme onaylandı! Para üstü: ₺${Number(data.changeAmount).toFixed(2)}`
            : "Ödeme onaylandı ve tahsil edildi!"
        );
        fetchData();
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setError(data.error || "Ödeme onaylanamadı.");
      }
    } catch (e) {
      setError("Bağlantı hatası.");
    } finally {
      setProcessingBillId(null);
    }
  };

  const handleRejectRequest = async () => {
    if (!rejectModal) return;
    setRejecting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/payments/${rejectModal.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage("Ödeme talebi reddedildi.");
        setRejectModal(null);
        setRejectReason("");
        fetchData();
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setError(data.error || "Talep reddedilemedi.");
      }
    } catch (e) {
      setError("Bağlantı hatası.");
    } finally {
      setRejecting(false);
    }
  };

  const amountNum = parseFloat(paymentAmount) || 0;
  const receivedNum = parseFloat(receivedAmount) || 0;
  const changeAmount = paymentMethod === "CASH" ? Math.max(0, receivedNum - amountNum) : 0;
  const isCashInsufficient = paymentMethod === "CASH" && receivedAmount !== "" && receivedNum < amountNum;

  const handleDirectPayment = async () => {
    if (!payModal) return;

    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Geçerli bir tutar giriniz.");
      return;
    }

    if (amountNum > parseFloat(payModal.remainingAmount)) {
      setError("Ödenen tutar kalan tutardan büyük olamaz.");
      return;
    }

    if (paymentMethod === "CASH") {
      if (!receivedAmount || receivedNum <= 0) {
        setError("Nakit ödeme için müşteriden alınan tutarı giriniz.");
        return;
      }
      if (receivedNum < amountNum) {
        setError(`Alınan tutar (₺${receivedNum.toFixed(2)}), ödenmesi gereken tutardan (₺${amountNum.toFixed(2)}) küçük olamaz.`);
        return;
      }
    }

    setProcessingBillId(payModal.id);
    setError(null);

    try {
      const body: any = {
        amount: amountNum,
        method: paymentMethod,
        idempotencyKey: idempotencyKeyRef.current,
      };

      if (paymentMethod === "CASH") {
        body.receivedAmount = receivedNum;
      }

      const res = await fetch(`/api/admin/pending-payments/${payModal.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setPayModal(null);
        setSuccessMessage(
          paymentMethod === "CASH" && data.changeAmount > 0
            ? `Ödeme alındı! Para üstü: ₺${Number(data.changeAmount).toFixed(2)}`
            : "Ödeme başarıyla alındı!"
        );
        fetchData();
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        const data = await res.json();
        setError(data.error || "Ödeme işlemi başarısız.");
      }
    } catch (e) {
      setError("Bağlantı hatası.");
    } finally {
      setProcessingBillId(null);
    }
  };

  const formatCurrency = (value: number): string => {
    return value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: "var(--text-primary)" }}>Admin Ödeme Onayları & Bekleyen Adisyonlar</h1>
        <p style={{ color: "var(--text-secondary)" }}>Garsonlardan gelen ödeme bildirimlerini onaylayın veya açık adisyonlardan tahsilat yapın.</p>
      </div>

      {successMessage && (
        <div style={{
          padding: "12px 16px", borderRadius: 10, marginBottom: 16,
          fontSize: 13, fontWeight: 600,
          background: "rgba(16,185,129,0.1)", color: "var(--success)",
          border: "1px solid rgba(16,185,129,0.2)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          ✅ {successMessage}
        </div>
      )}

      {error && (
        <div style={{
          padding: "12px 16px", borderRadius: 10, marginBottom: 16,
          fontSize: 13, fontWeight: 600,
          background: "rgba(239,68,68,0.1)", color: "#ef4444",
          border: "1px solid rgba(239,68,68,0.2)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* SECTION 1: ADMIN ONAYI BEKLEYEN ÖDEME TALEPLERİ */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Clock size={20} color="#f59e0b" /> Garson / Müşteri Ödeme Onay Talepleri ({approvalRequests.length})
        </h2>

        {approvalRequests.length === 0 ? (
          <div className="card" style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
            Onay bekleyen ödeme talebi yok.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
            {approvalRequests.map((req) => (
              <div key={req.id} className="card p-5" style={{ borderLeft: "4px solid #f59e0b", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700 }}>
                      {req.table?.tableName || `Masa ${req.table?.tableNumber}`}
                    </h3>
                    <span className="badge badge-warning">Onay Bekliyor</span>
                  </div>

                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                    <p><strong>Garson:</strong> {req.requestedByName || "Belirtilmedi"}</p>
                    <p><strong>Yöntem:</strong> {req.method === "CASH" ? "💵 Nakit" : "💳 Kart"}</p>
                    {req.method === "CASH" && req.receivedAmount && (
                      <p><strong>Alınan Nakit:</strong> ₺{Number(req.receivedAmount).toFixed(2)} (Üstü: ₺{Number(req.changeAmount || 0).toFixed(2)})</p>
                    )}
                    {req.note && <p><strong>Not:</strong> {req.note}</p>}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--border-subtle)", marginBottom: 16 }}>
                    <span style={{ fontWeight: 600 }}>Tahsil Edilecek:</span>
                    <span style={{ fontWeight: 800, fontSize: 18, color: "var(--primary)" }}>₺{Number(req.amount).toFixed(2)}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => handleApproveRequest(req)}
                    disabled={processingBillId === req.id}
                    className="btn btn-success"
                    style={{ flex: 2, gap: 4 }}
                  >
                    <CheckCircle2 size={16} /> Onayla ve Tahsil Et
                  </button>
                  <button
                    onClick={() => { setRejectModal(req); setRejectReason(""); }}
                    className="btn btn-danger"
                    style={{ flex: 1, gap: 4 }}
                  >
                    <XCircle size={16} /> Reddet
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: AÇIK ADİSYONLAR */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Açık Adisyonlar (Doğrudan Tahsilat)</h2>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
          </div>
        ) : bills.length === 0 ? (
          <div className="card" style={{ padding: "32px 24px", textAlign: "center" }}>
            <p style={{ color: "var(--text-secondary)" }}>Bekleyen açık adisyon bulunmamaktadır.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {bills.map(bill => (
              <div key={bill.id} className="card p-5" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                      {bill.table?.tableName || `Masa ${bill.table?.tableNumber}`}
                    </h3>
                    <span className="badge badge-warning">Açık Adisyon</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>Toplam Hesap:</span>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 14 }}>{formatCurrency(Number(bill.totalAmount))} ₺</span>
                  </div>

                  {Number(bill.paidAmount) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>Ödenen:</span>
                      <span style={{ fontWeight: 600, color: "var(--success)", fontSize: 14 }}>-{formatCurrency(Number(bill.paidAmount))} ₺</span>
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
                    <span style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 16 }}>Kalan Tutar:</span>
                    <span style={{ fontWeight: 800, color: "var(--primary)", fontSize: 18 }}>{formatCurrency(Number(bill.remainingAmount))} ₺</span>
                  </div>
                </div>

                <button
                  onClick={() => openPayModal(bill)}
                  className="btn btn-primary mt-6"
                  style={{ width: "100%" }}
                >
                  Ödeme Al
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="modal-overlay" onClick={() => !rejecting && setRejectModal(null)}>
          <div className="modal-content p-6" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Ödeme Talebini Reddet</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
              {rejectModal.table?.tableName || `Masa ${rejectModal.table?.tableNumber}`} ödeme talebini reddetmek üzeresiniz.
            </p>

            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
              Red Nedeni
            </label>
            <input
              className="input"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Örn: Tutar hatalı veya eksik"
              style={{ marginBottom: 20 }}
            />

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setRejectModal(null)} className="btn btn-ghost" style={{ flex: 1 }}>İptal</button>
              <button onClick={handleRejectRequest} disabled={rejecting} className="btn btn-danger" style={{ flex: 1 }}>
                {rejecting ? "İşleniyor..." : "Reddet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {payModal && (
        <div className="modal-overlay" onClick={() => !processingBillId && setPayModal(null)}>
          <div className="modal-content p-6" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>Ödeme Al</h2>
              <button onClick={() => !processingBillId && setPayModal(null)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 20 }}>✕</button>
            </div>

            <div style={{ marginBottom: 20, padding: 16, background: "var(--bg-hover)", borderRadius: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "var(--text-secondary)" }}>Masa:</span>
                <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{payModal.table?.tableName || `Masa ${payModal.table?.tableNumber}`}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>Kalan Hesap:</span>
                <span style={{ fontWeight: 800, color: "var(--primary)", fontSize: 18 }}>{formatCurrency(Number(payModal.remainingAmount))} ₺</span>
              </div>
            </div>

            {/* Ödenecek Tutar */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                Borçtan Tahsil Edilecek Tutar (₺)
              </label>
              <input
                type="number"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                className="input"
                step="0.01"
                min="0.01"
                max={payModal.remainingAmount}
                style={{ fontSize: 18, fontWeight: 700, padding: "12px 16px" }}
              />
            </div>

            {/* Ödeme Yöntemi */}
            <div style={{ marginBottom: paymentMethod === "CASH" ? 16 : 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>Ödeme Yöntemi</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  onClick={() => { setPaymentMethod("CARD"); setReceivedAmount(""); }}
                  style={{
                    padding: "12px", borderRadius: 10, border: `2px solid ${paymentMethod === "CARD" ? "var(--primary)" : "var(--border-color)"}`,
                    background: paymentMethod === "CARD" ? "var(--primary-glow)" : "transparent",
                    color: paymentMethod === "CARD" ? "var(--primary-light)" : "var(--text-secondary)",
                    fontWeight: 600, cursor: "pointer", transition: "all 0.15s"
                  }}
                >
                  💳 Kredi Kartı
                </button>
                <button
                  onClick={() => setPaymentMethod("CASH")}
                  style={{
                    padding: "12px", borderRadius: 10, border: `2px solid ${paymentMethod === "CASH" ? "var(--primary)" : "var(--border-color)"}`,
                    background: paymentMethod === "CASH" ? "var(--primary-glow)" : "transparent",
                    color: paymentMethod === "CASH" ? "var(--primary-light)" : "var(--text-secondary)",
                    fontWeight: 600, cursor: "pointer", transition: "all 0.15s"
                  }}
                >
                  💵 Nakit
                </button>
              </div>
            </div>

            {/* Nakit: Alınan Tutar ve Para Üstü */}
            {paymentMethod === "CASH" && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                    Müşteriden Alınan Nakit (₺)
                  </label>
                  <input
                    type="number"
                    value={receivedAmount}
                    onChange={e => setReceivedAmount(e.target.value)}
                    className="input"
                    step="0.01"
                    min="0.01"
                    placeholder={`En az ₺${formatCurrency(amountNum)}`}
                    style={{
                      fontSize: 18, fontWeight: 700, padding: "12px 16px",
                      borderColor: isCashInsufficient ? "var(--danger)" : undefined,
                    }}
                  />
                  {isCashInsufficient && (
                    <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>
                      ⚠️ Alınan tutar ödeme tutarından küçük olamaz.
                    </p>
                  )}
                </div>

                <div style={{
                  padding: "12px 16px", borderRadius: 10,
                  background: changeAmount > 0 ? "rgba(16,185,129,0.08)" : "var(--bg-hover)",
                  border: `1px solid ${changeAmount > 0 ? "rgba(16,185,129,0.2)" : "var(--border-subtle)"}`,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>Para Üstü:</span>
                  <span style={{
                    fontSize: 20, fontWeight: 800,
                    color: changeAmount > 0 ? "var(--success)" : "var(--text-muted)",
                  }}>
                    ₺{formatCurrency(changeAmount)}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={handleDirectPayment}
              disabled={processingBillId === payModal.id || (paymentMethod === "CASH" && isCashInsufficient)}
              className="btn btn-primary"
              style={{ width: "100%", padding: 16, fontSize: 16 }}
            >
              {processingBillId === payModal.id ? "İşleniyor..." : "Ödemeyi Tamamla"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
