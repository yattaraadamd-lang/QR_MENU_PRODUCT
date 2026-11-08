import type { Metadata } from "next";
import SuperAdminDashboardScreen from "@/components/super-admin-platform/SuperAdminDashboardScreen";

export const metadata: Metadata = { title: "Platform Özeti" };

export default function SuperAdminDashboardPage() {
  return <SuperAdminDashboardScreen />;
}
