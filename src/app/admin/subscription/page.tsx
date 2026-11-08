import type { Metadata } from "next";
import AdminSubscriptionScreen from "@/components/admin-subscription/AdminSubscriptionScreen";

export const metadata: Metadata = { title: "Abonelik" };

export default function AdminSubscriptionPage() {
  return <AdminSubscriptionScreen />;
}
