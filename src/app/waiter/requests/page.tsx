import type { Metadata } from "next";
import WaiterRequestsScreen from "@/components/waiter-requests/WaiterRequestsScreen";

export const metadata: Metadata = { title: "Talepler" };

export default function WaiterRequestsPage() {
  return <WaiterRequestsScreen />;
}
