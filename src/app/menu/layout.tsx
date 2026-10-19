import type { Metadata } from "next";

// Masa bazlı müşteri menüsü: her masa için ayrı URL olduğundan dizine eklenmez.
export const metadata: Metadata = {
  title: "Menü",
  robots: { index: false, follow: false },
};

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return children;
}
