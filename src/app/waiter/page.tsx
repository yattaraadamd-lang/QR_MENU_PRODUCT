import type { Metadata } from "next";
import WaiterOrdersScreen from "@/components/waiter-orders/WaiterOrdersScreen";
import { areaTitle } from "@/lib/site";

// Layout ile aynı segmentte: bölge şablonu uygulanmadığı için tam başlık
export const metadata: Metadata = { title: { absolute: areaTitle("Siparişler", "Garson") } };

export default function WaiterOrdersPage() {
  return <WaiterOrdersScreen />;
}
