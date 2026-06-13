"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { connectToBusinessRoom } from "@/lib/socket-client";

export default function WaiterPaymentsPage() {
  const { data: session } = useSession();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentNote, setPaymentNote] = useState("");
  const [submittingPaymentId, setSubmittingPaymentId] = useState<string | null>(null); // ✅ Per-payment loading
  const [receivedAmount, setReceivedAmount] = useState<string>(""); // Alınan nakit tutarı

  const fetchPayments = useCallback(async () => {
    try {
      const res = await fetch("/api/waiter/payments");
      const data = await res.json();
      if (res.ok) setPayments(data.payments || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user.businessId) {
      fetchPayments();
      // ✅ 5 saniyede bir polling (8s'den indirildi)
      const interval = setInterval(fetchPayments, 5000);
      return () => clearInterval(interval);
    }
  }, [session, fetchPayments]);

  // ✅ Socket.IO — static import, reconnect sonrası fetchPayments tetiklenir
  useEffect(() => {
    if (!session?.user.businessId) return;
    const socket = connectToBusinessRoom(session.user.businessId, fetchPayments);
    socket.on("payment_request", fetchPayments);
    socket.on("payment_collected", fetchPayments);
    return () => {
      socket.off("payment_request", fetchPayments);
      socket.off("payment_collected", fetchPayments);
    };
  }, [session, fetchPayments]);

  const handleComplete = async () => {
    if (!selectedPayment) return;

    // Nakit ödeme için validasyon
    if (paymentMethod === "CASH") {
      const received = parseFloat(receivedAmount);
      const dueAmount = Number(selectedPayment.amount);
      
      if (!receivedAmount || isNaN(received) || received <= 0) {
        alert("Lütfen alınan nakit tutarını giriniz.");
        return;
      }
      
      if (received < dueAmount) {
        alert(`Alınan tutar (₺${received.toFixed(2)}), ödenmesi gereken tutardan (₺${dueAmount.toFixed(2)}) küçük olamaz.`);
        return;
      }
    }

    setSubmittingPaymentId(selectedPayment.id); // ✅ Sadece bu ödeme loading
    try {
      const body: any = { 
        method: paymentMethod, 
        note: paymentNote 
      };
      
      // Nakit ödeme ise alınan tutarı da gönder
      if (paymentMethod === "CASH") {
        body.receivedAmount = parseFloat(receivedAmount);
      }

      const res = await fetch(`/api/waiter/payments/${selectedPayment.id}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      
      if (res.ok) {
        setSelectedPayment(null);
        setPaymentMethod("CASH");
        setPaymentNote("");
        setReceivedAmount("");
        fetchPayments();
      } else {
        const data = await res.json();
        alert(data.error || "Ödeme tamamlanamadı.");
      }
    } catch (e) {
      console.error(e);
      alert("Bir hata oluştu.");
    } finally {
      setSubmittingPaymentId(null); // ✅ Loading state temizle
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

      {selectedPayment && (() => {
        const dueAmount = Number(selectedPayment.amount);
        const received = parseFloat(receivedAmount) || 0;
        const changeAmount = paymentMethod === "CASH" && received > 0 ? received - dueAmount : 0;
        
        return (
          <div className="modal-overlay" onClick={() => setSelectedPayment(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Ödeme Al</h3>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>Masa</p>
                <p style={{ fontSize: 16, fontWeight: 600 }}>{selectedPayment.table?.tableName || `Masa ${selectedPayment.table?.tableNumber}`}</p>
              </div>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>Ödenmesi Gereken Tutar</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: "var(--primary-light)" }}>₺{dueAmount.toFixed(2)}</p>
              </div>
              
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Ödeme Yöntemi</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button 
                    onClick={() => {
                      setPaymentMethod("CASH");
                      setReceivedAmount("");
                    }} 
                    className={`btn ${paymentMethod === "CASH" ? "btn-primary" : "btn-ghost"}`} 
                    style={{ flex: 1 }}
                  >
                    💵 Nakit
                  </button>
                  <button 
                    onClick={() => {
                      setPaymentMethod("CARD");
                      setReceivedAmount("");
                    }} 
                    className={`btn ${paymentMethod === "CARD" ? "btn-primary" : "btn-ghost"}`} 
                    style={{ flex: 1 }}
                  >
                    💳 Kart
                  </button>
                </div>
              </div>

              {paymentMethod === "CASH" && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Alınan Nakit Tutarı</p>
                  <input 
                    type="number" 
                    className="input" 
                    value={receivedAmount} 
                    onChange={(e) => setReceivedAmount(e.target.value)} 
                    placeholder="Örn: 100.00"
                    step="0.01"
                    min="0"
                    style={{ fontSize: 18, fontWeight: 600 }}
                  />
                  {received > 0 && (
                    <div style={{ 
                      marginTop: 12, 
                      padding: 12, 
                      background: changeAmount >= 0 ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)", 
                      borderRadius: 8,
                      border: `1px solid ${changeAmount >= 0 ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`
                    }}>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>Para Üstü</p>
                      <p style={{ 
                        fontSize: 20, 
                        fontWeight: 700, 
                        color: changeAmount >= 0 ? "#22c55e" : "#ef4444" 
                      }}>
                        {changeAmount >= 0 ? `₺${changeAmount.toFixed(2)}` : "⚠️ Yetersiz tutar"}
                      </p>
                      {changeAmount >= 0 && (
                        <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6 }}>
                          Ciroya Eklenecek: ₺{dueAmount.toFixed(2)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Not (Opsiyonel)</p>
                <input className="input" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="Örn: Parçalı ödendi..." />
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button 
                  onClick={() => {
                    setSelectedPayment(null);
                    setReceivedAmount("");
                  }} 
                  className="btn btn-ghost" 
                  style={{ flex: 1 }}
                >
                  İptal
                </button>
                <button onClick={handleComplete} className="btn btn-success" style={{ flex: 2 }} disabled={submittingPaymentId === selectedPayment.id}>
                  {submittingPaymentId === selectedPayment.id ? "İşleniyor..." : "✅ Ödemeyi Tamamla"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
