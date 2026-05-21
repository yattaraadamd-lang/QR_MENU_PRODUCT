"use client";

import { useEffect, useState, useCallback } from "react";
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

export default function PendingPaymentsPage() {
  const { data: session } = useSession();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState<Bill | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState("CARD");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const iv = setInterval(fetchBills, 10000); // 10 saniyede bir güncelle
      return () => clearInterval(iv);
    }
  }, [session, fetchBills]);

  const openPayModal = (bill: Bill) => {
    setPayModal(bill);
    setPaymentAmount(bill.remainingAmount);
    setError(null);
  };

  const handlePayment = async () => {
    if (!payModal) return;
    
    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Geçerli bir tutar giriniz.");
      return;
    }
    
    if (amountNum > parseFloat(payModal.remainingAmount)) {
      setError("Ödenen tutar kalan tutardan büyük olamaz.");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/pending-payments/${payModal.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNum, paymentMethod }),
      });

      if (res.ok) {
        setPayModal(null);
        fetchBills();
      } else {
        const data = await res.json();
        setError(data.error || "Ödeme işlemi başarısız.");
      }
    } catch (e) {
      setError("Bağlantı hatası.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: "var(--text-primary)" }}>Bekleyen Ödemeler</h1>
        <p style={{ color: "var(--text-secondary)" }}>Açık adisyonlar ve hesap kapatma işlemleri.</p>
      </div>

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
                  <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 14 }}>{Number(bill.totalAmount).toFixed(2)} ₺</span>
                </div>
                
                {Number(bill.paidAmount) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>Ödenen:</span>
                    <span style={{ fontWeight: 600, color: "var(--success)", fontSize: 14 }}>-{Number(bill.paidAmount).toFixed(2)} ₺</span>
                  </div>
                )}
                
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
                  <span style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 16 }}>Kalan Tutar:</span>
                  <span style={{ fontWeight: 800, color: "var(--primary)", fontSize: 18 }}>{Number(bill.remainingAmount).toFixed(2)} ₺</span>
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
        <div className="modal-overlay" onClick={() => !processing && setPayModal(null)}>
          <div className="modal-content p-6" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>Ödeme Al</h2>
              <button onClick={() => !processing && setPayModal(null)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 20 }}>✕</button>
            </div>

            <div style={{ marginBottom: 20, padding: 16, background: "var(--bg-hover)", borderRadius: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "var(--text-secondary)" }}>Masa:</span>
                <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{payModal.table?.tableName || `Masa ${payModal.table?.tableNumber}`}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>Kalan Hesap:</span>
                <span style={{ fontWeight: 800, color: "var(--primary)", fontSize: 18 }}>{Number(payModal.remainingAmount).toFixed(2)} ₺</span>
              </div>
            </div>

            {error && (
              <div style={{ padding: "10px 14px", background: "rgba(220,38,38,0.1)", color: "var(--danger)", borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 500 }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Ödenecek Tutar (₺)</label>
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

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>Ödeme Yöntemi</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button 
                  onClick={() => setPaymentMethod("CARD")}
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

            <button 
              onClick={handlePayment} 
              disabled={processing}
              className="btn btn-primary" 
              style={{ width: "100%", padding: 16, fontSize: 16 }}
            >
              {processing ? "İşleniyor..." : "Ödemeyi Tamamla"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
