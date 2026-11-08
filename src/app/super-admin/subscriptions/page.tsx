import type { Metadata } from "next";
import SuperAdminSubscriptionsScreen from "@/components/super-admin-platform/SuperAdminSubscriptionsScreen";

export const metadata: Metadata = { title: "Abonelikler" };

export default function SuperAdminSubscriptionsPage() {
  return <SuperAdminSubscriptionsScreen />;
}
