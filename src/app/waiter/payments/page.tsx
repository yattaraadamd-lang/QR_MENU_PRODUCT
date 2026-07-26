"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { connectToBusinessRoom } from "@/lib/socket-client";
import { toast } from "sonner";
import { CreditCard, Banknote, Loader2, Clock, Info, Calculator } from "lucide-react";

export default function WaiterPaymentsPage() {
  const { data: session } = useSession();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentNote, setPaymentNote] = useState("");
<<<<<<< HEAD
  const [receivedAmount, setReceivedAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
=======
  const [submittingPaymentId, setSubmittingPaymentId] = useState<string | null>(null); // ✅ Per-payment loading
  const [receivedAmount, setReceivedAmount] = useState<string>(""); // Alınan nakit tutarı
>>>>>>> 1c180c9b6435330c9599466643bfd3610b268fc2

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
      const interval = setInterval(fetchPayments, 5000);
      return () => clearInterval(interval);
    }
  }, [session, fetchPayments]);

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
        toast.success("Ödeme başarıyla tamamlandı!");
        setSelectedPayment(null);
        setPaymentMethod("CASH");
        setPaymentNote("");
        setReceivedAmount("");
        fetchPayments();
      } else {
<<<<<<< HEAD
        toast.error("Ödeme tamamlanamadı. Lütfen tekrar deneyin.");
      }
    } catch {
      toast.error("Bağlantı hatası.");
=======
        const data = await res.json();
        alert(data.error || "Ödeme tamamlanamadı.");
      }
    } catch (e) {
      console.error(e);
      alert("Bir hata oluştu.");
>>>>>>> 1c180c9b6435330c9599466643bfd3610b268fc2
    } finally {
      setSubmittingPaymentId(null); // ✅ Loading state temizle
    }
  };

  const billAmount = selectedPayment ? Number(selectedPayment.amount) : 0;
  const received = parseFloat(receivedAmount) || 0;
  const change = received > billAmount ? received - billAmount : 0;

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 14 }} />)}
    </div>
  );

  return (
    <div>
      <h2 style={{ fontSize: 19, fontWeight: 800, marginBottom: 16 }}>Bekleyen Ödemeler</h2>

      {payments.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <CreditCard size={48} color="var(--text-muted)" strokeWidth={1.5} style={{ margin: "0 auto 12px" }} />
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Bekleyen ödeme talebi yok</p>
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
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Clock size={12} />
                    Talep: {new Date(p.requestedAt).toLocaleTimeString("tr-TR")}
                  </p>
                </div>
                <span className="badge badge-warning" style={{ gap: 4 }}>
                  <Clock size={11} /> Ödeme İstendi
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid var(--border-color)" }}>
                <span style={{ fontWeight: 700, fontSize: 18, color: "var(--primary-light)" }}>
                  {Number(p.amount).toFixed(2)} ₺
                </span>
                <button onClick={() => { setSelectedPayment(p); setReceivedAmount(""); }} className="btn btn-sm btn-success" style={{ gap: 4 }}>
                  <CreditCard size={14} /> Ödemeyi Al
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

<<<<<<< HEAD
      {/* Payment Modal */}
      {selectedPayment && (
        <div className="modal-overlay" onClick={() => setSelectedPayment(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
              <Calculator size={20} /> Ödeme Al
            </h3>

            {/* Table info */}
            <div style={{ marginBottom: 16, padding: "12px 16px", background: "var(--bg-hover)", borderRadius: 12 }}>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Masa</p>
              <p style={{ fontSize: 16, fontWeight: 700 }}>{selectedPayment.table?.tableName || `Masa ${selectedPayment.table?.tableNumber}`}</p>
            </div>

            {/* Bill amount */}
            <div style={{
              marginBottom: 16, padding: "16px", borderRadius: 14,
              background: "linear-gradient(135deg, var(--primary-glow), rgba(217,119,6,0.05))",
              border: "1px solid rgba(217,119,6,0.15)",
            }}>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, fontWeight: 600 }}>
                Ödenmesi Gereken Tutar
              </p>
              <p style={{ fontSize: 28, fontWeight: 800, color: "var(--primary-light)" }}>
                {billAmount.toFixed(2)} ₺
              </p>
            </div>

            {/* Received amount (only for CASH) */}
            {paymentMethod === "CASH" && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text-secondary)" }}>
                  Müşteriden Alınan Para
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    className="input"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    placeholder={billAmount.toFixed(2)}
                    min={0}
                    step="0.01"
                    style={{ fontSize: 18, fontWeight: 700, paddingRight: 32 }}
                  />
                  <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontWeight: 600 }}>₺</span>
                </div>
              </div>
            )}

            {/* Change calculation */}
            {paymentMethod === "CASH" && received > 0 && (
              <div style={{
                marginBottom: 16, padding: "12px 16px", borderRadius: 12,
                background: change > 0 ? "rgba(5,150,105,0.08)" : "var(--bg-hover)",
                border: `1px solid ${change > 0 ? "rgba(5,150,105,0.2)" : "var(--border-subtle)"}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Para Üstü</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: change > 0 ? "#10b981" : "var(--text-primary)" }}>
                    {change.toFixed(2)} ₺
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Ciroya Yansıyacak</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--primary-light)" }}>
                    {billAmount.toFixed(2)} ₺
                  </span>
                </div>
              </div>
            )}

            {/* Info box */}
            <div style={{
              marginBottom: 16, padding: "10px 14px", borderRadius: 10,
              background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.12)",
              display: "flex", alignItems: "flex-start", gap: 8,
            }}>
              <Info size={16} color="#3b82f6" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                Ciroya sadece hesap tutarı ({billAmount.toFixed(2)} ₺) yansır. Müşteriden fazla para alınsa bile ciro değişmez.
              </p>
            </div>

            {/* Payment method */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Ödeme Yöntemi</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setPaymentMethod("CASH")} className={`btn ${paymentMethod === "CASH" ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1, gap: 6 }}>
                  <Banknote size={18} /> Nakit
                </button>
                <button onClick={() => setPaymentMethod("CARD")} className={`btn ${paymentMethod === "CARD" ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1, gap: 6 }}>
                  <CreditCard size={18} /> Kart
                </button>
              </div>
            </div>

            {/* Note */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Not (Opsiyonel)</p>
              <input className="input" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="Örn: Parçalı ödendi..." />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setSelectedPayment(null)} className="btn btn-ghost" style={{ flex: 1 }}>İptal</button>
              <button onClick={handleComplete} className="btn btn-success" style={{ flex: 2, gap: 6 }} disabled={submitting}>
                {submitting ? (
                  <><Loader2 size={16} className="animate-spin" /> İşleniyor...</>
                ) : (
                  <><CreditCard size={16} /> Ödemeyi Tamamla</>
                )}
              </button>
            </div>
=======
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
>>>>>>> 1c180c9b6435330c9599466643bfd3610b268fc2
          </div>
        );
      })()}
    </div>
  );
}
