"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";

type Bill = {
  id: string;
  totalAmount: string;
  paidAmount: string;
  remainingAmount: string;
  status: string;
  updatedAt: string;
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
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState<Bill | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState("CARD");
  const [receivedAmount, setReceivedAmount] = useState<string>("");
  const [processingBillId, setProcessingBillId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Idempotency key — modal açıldığında oluşturulur, retry'larda aynı kalır
  const idempotencyKeyRef = useRef<string>("");

  const fetchBills = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pending-payments");
      if (res.ok) {
        const data = await res.json();
        setBills(data.bills || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user.businessId) {
      fetchBills();
      const iv = setInterval(fetchBills, 10000);
      return () => clearInterval(iv);
    }
  }, [session, fetchBills]);

  const openPayModal = (bill: Bill) => {
    setPayModal(bill);
    setPaymentAmount(bill.remainingAmount);
    setPaymentMethod("CARD");
    setReceivedAmount("");
    setError(null);
    setSuccessMessage(null);
    // Yeni modal açıldığında yeni idempotency key üret
    idempotencyKeyRef.current = generateUUID();
  };

  // ── Para üstü hesaplama ─────────────────────────────────────────────
  const amountNum = parseFloat(paymentAmount) || 0;
  const receivedNum = parseFloat(receivedAmount) || 0;
  const changeAmount = paymentMethod === "CASH" ? Math.max(0, receivedNum - amountNum) : 0;
  const isCashInsufficient = paymentMethod === "CASH" && receivedAmount !== "" && receivedNum < amountNum;

  const handlePayment = async () => {
    if (!payModal) return;

    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Geçerli bir tutar giriniz.");
      return;
    }

    if (amountNum > parseFloat(payModal.remainingAmount)) {
      setError("Ödenen tutar kalan tutardan büyük olamaz.");
      return;
    }

    // Nakit doğrulama
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
        paymentMethod, // geriye uyumluluk
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
        fetchBills();
        // Başarılı ödeme sonrası feedback'i 5sn sonra temizle
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        const data = await res.json();
        // Hata mesajını Türkçe göster
        const errorMessages: Record<string, string> = {
          CASH_RECEIVED_AMOUNT_REQUIRED: "Nakit ödeme için müşteriden alınan tutarı giriniz.",
          INSUFFICIENT_CASH_RECEIVED: "Alınan nakit tutarı yetersiz.",
          AMOUNT_EXCEEDS_REMAINING_DUE: "Ödeme tutarı kalan borçtan büyük olamaz.",
          IDEMPOTENCY_KEY_CONFLICT: "Bu işlem başka bir ödeme için kullanılmış. Sayfayı yenileyip tekrar deneyin.",
          BILL_NOT_FOUND: "Adisyon bulunamadı.",
          BILL_ALREADY_CLOSED: "Bu adisyon zaten kapatılmış.",
        };
        setError(errorMessages[data.code] || data.error || "Ödeme işlemi başarısız.");
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
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: "var(--text-primary)" }}>Bekleyen Ödemeler</h1>
        <p style={{ color: "var(--text-secondary)" }}>Açık adisyonlar ve hesap kapatma işlemleri.</p>
      </div>

      {/* Başarı mesajı */}
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

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
        </div>
      ) : bills.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
          <p style={{ color: "var(--text-secondary)" }}>Bekleyen ödeme bulunmamaktadır.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

            {error && (
              <div style={{ padding: "10px 14px", background: "rgba(220,38,38,0.1)", color: "var(--danger)", borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 500 }}>
                {error}
              </div>
            )}

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

                {/* Para üstü gösterimi */}
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
              onClick={handlePayment}
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
