"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Loader from "@/components/ui/Loader";
import { formatTRY } from "@/lib/format";

export default function SuperAdminDashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState({
    totalBusinesses: 0,
    activeBusinesses: 0,
    totalAdmins: 0,
    totalWaiters: 0,
    monthlyPlatformRevenue: 0,
    totalOrders: 0,
    totalPayments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user.role === "SUPER_ADMIN") {
      fetchDashboardData();
    }
  }, [session]);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch("/api/super-admin/dashboard");
      const data = await res.json();
      if (res.ok) {
        setStats(data.stats);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader />;

  const statCards = [
    { label: "Toplam İşletme", value: stats.totalBusinesses, icon: "🏢", color: "#A3477A" },
    { label: "Aktif İşletme", value: stats.activeBusinesses, icon: "🟢", color: "#3BA55C" },
    { label: "Aylık Platform Geliri", value: formatTRY(stats.monthlyPlatformRevenue), icon: "💎", color: "#A3477A" },
    { label: "Toplam Admin", value: stats.totalAdmins, icon: "👑", color: "#F4A623" },
    { label: "Toplam Garson", value: stats.totalWaiters, icon: "👔", color: "#ef4444" },
    { label: "Toplam Sipariş", value: stats.totalOrders, icon: "📋", color: "#3b82f6" },
  ];

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 24 }}>Platform Özeti</h1>
      
      <div className="stagger" style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 16,
      }}>
        {statCards.map((stat, i) => (
          <div key={i} className="card" style={{ padding: 20, position: "relative", overflow: "hidden" }}>
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 4,
              background: stat.color,
            }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4, fontWeight: 600 }}>
                  {stat.label}
                </p>
                <p style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>
                  {stat.value}
                </p>
              </div>
              <span style={{ fontSize: 36, opacity: 0.8 }}>{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
