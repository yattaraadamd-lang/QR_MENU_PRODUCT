import type { Metadata } from "next";
import AdminSubscriptionScreen from "@/components/subscription/AdminSubscriptionScreen";

export const metadata: Metadata = { title: "Abonelik" };

export default function AdminSubscriptionPage() {
  return <AdminSubscriptionScreen />;
}
