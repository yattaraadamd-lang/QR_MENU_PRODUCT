"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type Usage = { current: number; limit: number | null };
type Plan = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  monthlyPrice: number;
  maxTables: number | null;
  maxWaiters: number | null;
  maxProducts: number | null;
  hasReports: boolean;
  hasPayments: boolean;
  canPurchase: boolean;
};
type Data = {
  subscription: null | {
    status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
    trialEndsAt: string | null;
    endsAt: string | null;
    isValid: boolean;
    plan: { code: string | null; name: string; monthlyPrice: number } | null;
  };
  usage: { tables: Usage; waiters: Usage; products: Usage };
  plans: Plan[];
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  TRIAL: { label: "Deneme", color: "#60a5fa" },
  ACTIVE: { label: "Aktif", color: "#10b981" },
  PAST_DUE: { label: "Ödeme Bekleniyor", color: "#f59e0b" },
  CANCELLED: { label: "İptal Edildi", color: "#ef4444" },
  EXPIRED: { label: "Süresi Doldu", color: "#ef4444" },
};

const fmtLimit = (n: number | null) => (n === null ? "Sınırsız" : n);
const labelStyle = { fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 } as const;

function UsageBar({ label, usage }: { label: string; usage: Usage }) {
  const pct = usage.limit ? Math.min(100, (usage.current / usage.limit) * 100) : 0;
  const color = pct >= 100 ? "#ef4444" : pct >= 80 ? "#f59e0b" : "var(--primary)";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span style={{ fontWeight: 700 }}>
          {usage.current} / {fmtLimit(usage.limit)}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: "var(--bg-hover)", overflow: "hidden" }}>
        <div style={{ width: usage.limit ? `${pct}%` : "0%", height: "100%", background: color }} />
      </div>
    </div>
  );
}

function SubscriptionContent() {
  const searchParams = useSearchParams();
  const paymentResult = searchParams.get("payment");

  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [billing, setBilling] = useState({ name: "", surname: "", gsmNumber: "", identityNumber: "", city: "", address: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkoutReady, setCheckoutReady] = useState(false);
  const formHostRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/subscription");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan?.code) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode: selectedPlan.code, customer: billing }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Ödeme başlatılamadı");
        return;
      }
      setCheckoutReady(true);
      // iyzico formu bir <script> olarak gelir; innerHTML script çalıştırmadığı için yeniden oluşturulur
      requestAnimationFrame(() => {
        const tmp = document.createElement("div");
        tmp.innerHTML = json.checkoutFormContent;
        tmp.querySelectorAll("script").forEach((old) => {
          const s = document.createElement("script");
          if (old.src) s.src = old.src;
          s.text = old.text;
          formHostRef.current?.appendChild(s);
        });
      });
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelPaid = async () => {
    if (!confirm("Ücretli aboneliğiniz iptal edilecek. Emin misiniz?")) return;
    const res = await fetch("/api/admin/billing/cancel", { method: "POST" });
    const json = await res.json();
    alert(json.message || json.error);
    load();
  };

  if (loading) return <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 32 }}>Yükleniyor...</p>;
  if (!data) return <p style={{ color: "#ef4444", textAlign: "center", padding: 32 }}>Abonelik bilgisi alınamadı.</p>;

  const sub = data.subscription;
  const status = sub ? STATUS_LABEL[sub.status] : null;
  const trialDaysLeft =
    sub?.status === "TRIAL" && sub.trialEndsAt
      ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86400000))
      : null;

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Abonelik</h2>

      {paymentResult === "success" && (
        <div className="card" style={{ padding: 14, marginBottom: 16, borderLeft: "3px solid #10b981" }}>
          ✅ Ödemeniz alındı, aboneliğiniz aktif.
        </div>
      )}
      {paymentResult === "failed" && (
        <div className="card" style={{ padding: 14, marginBottom: 16, borderLeft: "3px solid #ef4444" }}>
          ❌ Ödeme tamamlanamadı. Lütfen tekrar deneyin.
        </div>
      )}

      {/* Mevcut plan */}
      <div className="card" style={{ padding: 20, marginBottom: 24, maxWidth: 720 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Mevcut plan</p>
            <p style={{ fontSize: 20, fontWeight: 800 }}>{sub?.plan?.name ?? "Plan yok"}</p>
            {trialDaysLeft !== null && (
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                Deneme süresinin bitmesine <strong>{trialDaysLeft} gün</strong> kaldı
              </p>
            )}
            {sub && !sub.isValid && (
              <p style={{ fontSize: 13, color: "#ef4444", marginTop: 4 }}>
                Aboneliğiniz aktif değil — yeni masa, ürün veya garson ekleyemezsiniz.
              </p>
            )}
          </div>
          {status && (
            <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 99, color: status.color, border: `1px solid ${status.color}` }}>
              {status.label}
            </span>
          )}
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <UsageBar label="Masalar" usage={data.usage.tables} />
          <UsageBar label="Garsonlar" usage={data.usage.waiters} />
          <UsageBar label="Ürünler" usage={data.usage.products} />
        </div>

        {sub?.status === "ACTIVE" && (
          <button onClick={cancelPaid} className="btn btn-sm btn-ghost" style={{ marginTop: 20, color: "#ef4444" }}>
            Aboneliği iptal et
          </button>
        )}
      </div>

      {/* Planlar */}
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Planlar</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 24 }}>
        {data.plans.map((plan) => {
          const isCurrent = sub?.status === "ACTIVE" && sub.plan?.code === plan.code;
          return (
            <div key={plan.id} className="card" style={{
              padding: 18,
              border: selectedPlan?.id === plan.id ? "1px solid var(--primary)" : undefined,
            }}>
              <p style={{ fontWeight: 800, fontSize: 16 }}>{plan.name}</p>
              {plan.description && <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{plan.description}</p>}
              <p style={{ fontSize: 24, fontWeight: 800, margin: "12px 0" }}>
                {plan.monthlyPrice.toLocaleString("tr-TR")} ₺<span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}> /ay</span>
              </p>
              <ul style={{ fontSize: 13, color: "var(--text-secondary)", listStyle: "none", padding: 0, display: "grid", gap: 4, marginBottom: 14 }}>
                <li>🪑 {fmtLimit(plan.maxTables)} masa</li>
                <li>👥 {fmtLimit(plan.maxWaiters)} garson</li>
                <li>🍽️ {fmtLimit(plan.maxProducts)} ürün</li>
                {plan.hasReports && <li>📊 Raporlar</li>}
                {plan.hasPayments && <li>💳 Ödeme takibi</li>}
              </ul>
              <button
                className="btn btn-primary btn-sm"
                style={{ width: "100%" }}
                disabled={isCurrent || !plan.canPurchase || checkoutReady}
                onClick={() => { setSelectedPlan(plan); setError(""); }}
              >
                {isCurrent ? "Mevcut plan" : plan.canPurchase ? "Bu planı seç" : "Yakında"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Fatura bilgileri + iyzico formu */}
      {selectedPlan && (
        <div className="card" style={{ padding: 20, maxWidth: 520 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{selectedPlan.name} — Ödeme</h3>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
            Ödeme iyzico güvenli ödeme sayfasında alınır. Kart bilgileriniz bize ulaşmaz.
          </p>

          {error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</p>}

          {!checkoutReady ? (
            <form onSubmit={startCheckout} style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Ad *</label>
                  <input className="input" required value={billing.name} onChange={(e) => setBilling({ ...billing, name: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Soyad *</label>
                  <input className="input" required value={billing.surname} onChange={(e) => setBilling({ ...billing, surname: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Cep Telefonu *</label>
                <input className="input" required placeholder="+905551234567" value={billing.gsmNumber} onChange={(e) => setBilling({ ...billing, gsmNumber: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>T.C. Kimlik No *</label>
                <input className="input" required inputMode="numeric" maxLength={11} value={billing.identityNumber} onChange={(e) => setBilling({ ...billing, identityNumber: e.target.value })} />
                <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>Fatura için iyzico tarafından zorunlu tutulur.</p>
              </div>
              <div>
                <label style={labelStyle}>Şehir *</label>
                <input className="input" required value={billing.city} onChange={(e) => setBilling({ ...billing, city: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Fatura Adresi *</label>
                <input className="input" required value={billing.address} onChange={(e) => setBilling({ ...billing, address: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setSelectedPlan(null)}>Vazgeç</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>
                  {submitting ? "Hazırlanıyor..." : "Ödemeye Geç"}
                </button>
              </div>
            </form>
          ) : (
            <div ref={formHostRef}>
              <div id="iyzipay-checkoutform" className="responsive" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminSubscriptionPage() {
  return (
    <Suspense>
      <SubscriptionContent />
    </Suspense>
  );
}
