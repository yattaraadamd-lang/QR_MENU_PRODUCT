"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Loader from "@/components/ui/Loader";

export default function SuperAdminPaymentsPage() {
  const { data: session } = useSession();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user.role === "SUPER_ADMIN") {
      fetchPayments();
    }
  }, [session]);

  const fetchPayments = async () => {
    try {
      const res = await fetch("/api/super-admin/platform-payments");
      const data = await res.json();
      if (res.ok) setPayments(data.payments || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(value);
  };

  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  if (loading) return <Loader />;

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Platform Ödemeleri</h2>

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 20, flex: 1, borderLeft: "4px solid #A3477A" }}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Toplam Platform Geliri</p>
          <p style={{ fontSize: 24, fontWeight: 800, color: "var(--purple-text)" }}>{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="card" style={{ padding: 20, flex: 1, borderLeft: "4px solid #3BA55C" }}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Aktif Abonelik</p>
          <p style={{ fontSize: 24, fontWeight: 800, color: "#3BA55C" }}>{payments.length}</p>
        </div>
      </div>

      <div className="card" style={{ padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏗️</div>
        <p style={{ color: "var(--text-secondary)" }}>Platform ödeme kayıtları abonelik sistemi aktifleştirildiğinde burada görünecektir.</p>
      </div>
    </div>
  );
}
