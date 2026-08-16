"useClient";
"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { connectToBusinessRoom } from "@/lib/socket-client";
import { toast } from "sonner";
import { CreditCard, Banknote, Loader2, Clock, Info, Calculator, ShieldAlert, CheckCircle2, XCircle } from "lucide-react";

export default function WaiterPaymentsPage() {
  const { data: session } = useSession();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentNote, setPaymentNote] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    const accessToken = (session as any).accessToken;
    if (!accessToken) return;
    const socket = connectToBusinessRoom(accessToken, fetchPayments);
    socket.on("payment_request", fetchPayments);
    socket.on("payment_approval_requested", fetchPayments);
    socket.on("payment_approved", fetchPayments);
    socket.on("payment_rejected", fetchPayments);
    socket.on("payment_collected", fetchPayments);
    return () => {
      socket.off("payment_request", fetchPayments);
      socket.off("payment_approval_requested", fetchPayments);
      socket.off("payment_approved", fetchPayments);
      socket.off("payment_rejected", fetchPayments);
      socket.off("payment_collected", fetchPayments);
    };
  }, [session, fetchPayments]);

  const openModalForPayment = (p: any) => {
    setSelectedPayment(p);
    setPaymentMethod(p.method || "CASH");
    setPaymentNote(p.note || "");
    const dueAmount = Number(p.amount);
    setCustomAmount(dueAmount.toString());
    setReceivedAmount(p.receivedAmount ? Number(p.receivedAmount).toString() : "");
  };

  const handleRequestApproval = async () => {
    if (!selectedPayment) return;

    const amountToSend = parseFloat(customAmount);
    if (isNaN(amountToSend) || amountToSend <= 0) {
      toast.error("Lütfen geçerli bir tahsilat tutarı giriniz.");
      return;
    }

    const dueAmount = Number(selectedPayment.amount);
    if (amountToSend > dueAmount) {
      toast.error(`Tahsil edilecek tutar kalan borçtan (₺${dueAmount.toFixed(2)}) fazla olamaz.`);
      return;
    }

    // Nakit ödeme için validasyon
    if (paymentMethod === "CASH") {
      const received = parseFloat(receivedAmount);

      if (!receivedAmount || isNaN(received) || received <= 0) {
        toast.error("Lütfen alınan nakit tutarını giriniz.");
        return;
      }

      if (received < amountToSend) {
        toast.error(`Alınan tutar (₺${received.toFixed(2)}), tahsil edilecek tutardan (₺${amountToSend.toFixed(2)}) küçük olamaz.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const body: any = {
        method: paymentMethod,
        amount: amountToSend,
        note: paymentNote,
      };

      if (paymentMethod === "CASH") {
        body.receivedAmount = parseFloat(receivedAmount);
      }

      const res = await fetch(`/api/waiter/payments/${selectedPayment.id}/request-approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success("Ödeme bilgisi admin onayına gönderildi!");
        setSelectedPayment(null);
        setPaymentMethod("CASH");
        setPaymentNote("");
        setReceivedAmount("");
        setCustomAmount("");
        fetchPayments();
      } else {
        toast.error(data.error || "Onay talebi gönderilemedi. Lütfen tekrar deneyin.");
      }
    } catch {
      toast.error("Bağlantı hatası.");
    } finally {
      setSubmitting(false);
    }
  };

  const dueAmount = selectedPayment ? Number(selectedPayment.amount) : 0;
  const amountToPay = parseFloat(customAmount) || 0;
  const received = parseFloat(receivedAmount) || 0;
  const change = paymentMethod === "CASH" && received > amountToPay ? received - amountToPay : 0;

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 14 }} />)}
    </div>
  );

  return (
    <div>
      <h2 style={{ fontSize: 19, fontWeight: 800, marginBottom: 16 }}>Ödeme Talepleri ve Garson Bildirimleri</h2>

      {payments.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <CreditCard size={48} color="var(--text-muted)" strokeWidth={1.5} style={{ margin: "0 auto 12px" }} />
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Bekleyen ödeme talebi yok</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {payments.map((p) => {
            const isAwaitingApproval = p.status === "AWAITING_ADMIN_APPROVAL";
            const isRejected = p.status === "REJECTED";
            const isPending = p.status === "PENDING";

            return (
              <div
                key={p.id}
                className="card animate-fade-in"
                style={{
                  padding: 16,
                  borderLeft: isAwaitingApproval
                    ? "4px solid #3b82f6"
                    : isRejected
                    ? "4px solid #ef4444"
                    : "4px solid #f59e0b",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 10 }}>
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: 16 }}>
                      {p.table?.tableName || `Masa ${p.table?.tableNumber}`}
                    </h3>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <Clock size={12} />
                      Talep: {new Date(p.requestedAt || p.createdAt).toLocaleTimeString("tr-TR")}
                    </p>
                  </div>
                  <div>
                    {isPending && (
                      <span className="badge badge-warning" style={{ gap: 4 }}>
                        <Clock size={11} /> Müşteri Talebi
                      </span>
                    )}
                    {isAwaitingApproval && (
                      <span className="badge" style={{ background: "rgba(59,130,246,0.15)", color: "#3b82f6", gap: 4 }}>
                        <CheckCircle2 size={11} /> Admin Onayı Bekleniyor
                      </span>
                    )}
                    {isRejected && (
                      <span className="badge badge-danger" style={{ gap: 4 }}>
                        <XCircle size={11} /> Admin Reddetti
                      </span>
                    )}
                  </div>
                </div>

                {isRejected && p.rejectionReason && (
                  <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", marginBottom: 10, fontSize: 13, color: "#dc2626" }}>
                    <strong>Red Nedeni:</strong> {p.rejectionReason}
                  </div>
                )}

                {isAwaitingApproval && (
                  <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(59,130,246,0.08)", marginBottom: 10, fontSize: 13, color: "#2563eb" }}>
                    Garson {p.requestedByName ? `(${p.requestedByName})` : ""} admin onayına gönderdi. (Yöntem: {p.method === "CASH" ? "Nakit" : "Kart"}, Tutar: ₺{Number(p.amount).toFixed(2)})
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid var(--border-color)" }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 18, color: "var(--primary-light)" }}>
                      ₺{Number(p.amount).toFixed(2)}
                    </span>
                    {p.bill && (
                      <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 8 }}>
                        (Adisyon Kalanı: ₺{Number(p.bill.remainingAmount).toFixed(2)})
                      </span>
                    )}
                  </div>

                  {isAwaitingApproval ? (
                    <button disabled className="btn btn-sm btn-ghost" style={{ opacity: 0.6, cursor: "not-allowed" }}>
                      Onay Bekleniyor...
                    </button>
                  ) : (
                    <button
                      onClick={() => openModalForPayment(p)}
                      className={`btn btn-sm ${isRejected ? "btn-danger" : "btn-primary"}`}
                      style={{ gap: 4 }}
                    >
                      <CreditCard size={14} />
                      {isRejected ? "Düzenle ve Tekrar Gönder" : "Admin Onayına Gönder"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Payment Approval Modal */}
      {selectedPayment && (
        <div className="modal-overlay" onClick={() => setSelectedPayment(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: 24, maxWidth: 460 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
              <Calculator size={20} /> Ödeme Bilgisini Admin Onayına Gönder
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
                Adisyon / Kalan Borç
              </p>
              <p style={{ fontSize: 26, fontWeight: 800, color: "var(--primary-light)" }}>
                ₺{dueAmount.toFixed(2)}
              </p>
            </div>

            {/* Amount to collect input */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text-secondary)" }}>
                Tahsil Edilecek Tutar (₺)
              </label>
              <input
                type="number"
                className="input"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                step="0.01"
                min="0.01"
                max={dueAmount}
                style={{ fontSize: 18, fontWeight: 700 }}
              />
            </div>

            {/* Payment method */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Ödeme Yöntemi</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setPaymentMethod("CASH")} className={`btn ${paymentMethod === "CASH" ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1, gap: 6 }}>
                  <Banknote size={18} /> Nakit
                </button>
                <button onClick={() => { setPaymentMethod("CARD"); setReceivedAmount(""); }} className={`btn ${paymentMethod === "CARD" ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1, gap: 6 }}>
                  <CreditCard size={18} /> Kart
                </button>
              </div>
            </div>

            {/* Received amount (only for CASH) */}
            {paymentMethod === "CASH" && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text-secondary)" }}>
                  Müşteriden Alınan Nakit (₺)
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    className="input"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    placeholder={amountToPay.toFixed(2)}
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
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Hesaplanan Para Üstü</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: change > 0 ? "#10b981" : "var(--text-primary)" }}>
                    ₺{change.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Info box for waiter */}
            <div style={{
              marginBottom: 16, padding: "10px 14px", borderRadius: 10,
              background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.12)",
              display: "flex", alignItems: "flex-start", gap: 8,
            }}>
              <Info size={16} color="#3b82f6" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                Garson doğrudan ödemeyi tamamlayamaz. Gönderilen bilgiler admin onayından sonra ciroya yansıyacaktır.
              </p>
            </div>

            {/* Note */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Not (Opsiyonel)</p>
              <input className="input" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="Örn: 200 TL nakit alındı..." />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setSelectedPayment(null)} className="btn btn-ghost" style={{ flex: 1 }}>İptal</button>
              <button onClick={handleRequestApproval} className="btn btn-primary" style={{ flex: 2, gap: 6 }} disabled={submitting}>
                {submitting ? (
                  <><Loader2 size={16} className="animate-spin" /> İletiliyor...</>
                ) : (
                  <><CreditCard size={16} /> Admin Onayına Gönder</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
