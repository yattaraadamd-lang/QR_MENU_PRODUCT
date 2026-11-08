import type { Metadata } from "next";
import WaiterTablesScreen from "@/components/waiter-tables/WaiterTablesScreen";

export const metadata: Metadata = { title: "Masa Durumları" };

export default function WaiterTablesPage() {
  return <WaiterTablesScreen />;
}
