import type { Metadata } from "next";
import WaiterPaymentsScreen from "@/components/waiter-payments/WaiterPaymentsScreen";

export const metadata: Metadata = { title: "Ödeme Talepleri ve Garson Bildirimleri" };

export default function WaiterPaymentsPage() {
  return <WaiterPaymentsScreen />;
}
