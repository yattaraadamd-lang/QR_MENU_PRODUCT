import type { Metadata } from "next";
import type { ReactNode } from "react";
import WaiterRoot from "@/components/waiter-shell/WaiterRoot";
import { areaTitle, siteTitle } from "@/lib/site";

// Şablon yalnız alt segmentlere uygulanır; /waiter sayfası başlığını `absolute` ile verir
export const metadata: Metadata = {
  title: { template: areaTitle("%s", "Garson"), default: siteTitle("Garson") },
  robots: { index: false, follow: false },
};

export default function WaiterLayout({ children }: { readonly children: ReactNode }) {
  return <WaiterRoot>{children}</WaiterRoot>;
}
