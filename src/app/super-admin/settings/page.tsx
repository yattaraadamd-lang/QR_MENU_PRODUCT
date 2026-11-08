import type { Metadata } from "next";
import SuperAdminSettingsScreen from "@/components/super-admin-platform/SuperAdminSettingsScreen";

export const metadata: Metadata = { title: "Platform Ayarları" };

export default function SuperAdminSettingsPage() {
  return <SuperAdminSettingsScreen />;
}
