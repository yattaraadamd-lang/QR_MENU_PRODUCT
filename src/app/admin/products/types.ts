export type Product = {
  id: string; name: string; description: string | null;
  ingredients: string | null; allergens: string | null;
  price: number; isAvailable: boolean;
  stockStatus: "IN_STOCK" | "OUT_OF_STOCK" | "TEMPORARILY_UNAVAILABLE";
  isPopular: boolean; sortOrder: number;
  category: { id: string; name: string } | null;
};
export type Category = { id: string; name: string };

// color: kendi saydam zemini (bg) ve kart üzerinde ≥4.5:1 metin rengi
export const STOCK_OPTIONS = [
  { value: "IN_STOCK",               label: "Stokta Var",    color: "var(--success-text)", bg: "rgba(59,165,92,0.12)" },
  { value: "OUT_OF_STOCK",           label: "Stokta Yok",    color: "var(--danger-text)", bg: "rgba(239,68,68,0.12)" },
  { value: "TEMPORARILY_UNAVAILABLE",label: "Geçici Yok",    color: "#F4A623",            bg: "rgba(244,166,35,0.12)" },
];
export type StockOption = typeof STOCK_OPTIONS[number];

export const stockInfo = (s: Product["stockStatus"]): StockOption =>
  STOCK_OPTIONS.find(o => o.value === s) || STOCK_OPTIONS[0];
