"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function WaiterPaymentsPage() {
  const { data: session } = useSession();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentNote, setPaymentNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session?.user.businessId) {
      fetchPayments();
      const interval = setInterval(fetchPayments, 8000);
      return () => clearInterval(interval);
    }
  }, [session]);

  const fetchPayments = async () => {
    try {
      const res = await fetch("/api/waiter/payments");
      const data = await res.json();
      if (res.ok) setPayments(data.payments || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!selectedPayment) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/waiter/payments/${selectedPayment.id}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: paymentMethod, note: paymentNote }),
      });
      if (res.ok) {
        setSelectedPayment(null);
        setPaymentMethod("CASH");
        setPaymentNote("");
        fetchPayments();
      } else {
        alert("Ödeme tamamlanamadı.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 32 }}>⏳ Yükleniyor...</p>;

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Bekleyen Ödemeler</h2>

      {payments.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💳</div>
          <p style={{ color: "var(--text-secondary)" }}>Bekleyen ödeme talebi yok</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {payments.map((p) => (
            <div key={p.id} className="card animate-fade-in" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 10 }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 16 }}>
                    {p.table?.tableName || `Masa ${p.table?.tableNumber}`}
                  </h3>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    Talep: {new Date(p.requestedAt).toLocaleTimeString("tr-TR")}
                  </p>
                </div>
                <span className="badge badge-warning">Ödeme İstendi</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid var(--border-color)" }}>
                <span style={{ fontWeight: 700, fontSize: 18, color: "var(--primary-light)" }}>
                  ₺{Number(p.amount).toFixed(2)}
                </span>
                <button onClick={() => setSelectedPayment(p)} className="btn btn-sm btn-success">
                  💳 Ödemeyi Al
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedPayment && (
        <div className="modal-overlay" onClick={() => setSelectedPayment(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Ödeme Al</h3>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>Masa</p>
              <p style={{ fontSize: 16, fontWeight: 600 }}>{selectedPayment.table?.tableName || `Masa ${selectedPayment.table?.tableNumber}`}</p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>Tutar</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: "var(--primary-light)" }}>₺{Number(selectedPayment.amount).toFixed(2)}</p>
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Ödeme Yöntemi</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setPaymentMethod("CASH")} className={`btn ${paymentMethod === "CASH" ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1 }}>💵 Nakit</button>
                <button onClick={() => setPaymentMethod("CARD")} className={`btn ${paymentMethod === "CARD" ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1 }}>💳 Kart</button>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Not (Opsiyonel)</p>
              <input className="input" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="Örn: Parçalı ödendi..." />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setSelectedPayment(null)} className="btn btn-ghost" style={{ flex: 1 }}>İptal</button>
              <button onClick={handleComplete} className="btn btn-success" style={{ flex: 2 }} disabled={submitting}>
                {submitting ? "İşleniyor..." : "✅ Ödemeyi Tamamla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
