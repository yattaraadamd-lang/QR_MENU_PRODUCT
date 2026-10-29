export type Product = {
  id: string;
  name: string;
  description: string | null;
  ingredients: string | null;
  allergens: string | null;
  price: number;
  image: string | null;
  isAvailable: boolean;
  stockStatus: string;
  isPopular: boolean;
};

export type Category = { id: string; name: string; icon: string | null; products: Product[] };
export type CartItem = { product: Product; quantity: number; customerNote?: string };
export type Business = { id: string; name: string; description: string | null; logo: string | null; phone: string | null };
export type TableInfo = { id: string; tableNumber: string; tableName: string | null };
export type MenuResponse = { business: Business; table: TableInfo; categories: Category[] };

export type AuthStatus = "VIEW_ONLY" | "PENDING" | "AUTHORIZED" | "REVOKED" | "TABLE_ALREADY_CLAIMED";

/** /api/customer/session/status yanıtının kullanılan alanları */
export type CanonicalSessionStatus = {
  ok: boolean;
  status?: AuthStatus;
  tableSessionId?: string;
  customerSessionId?: string;
  businessId?: string;
  tableId?: string;
  orderRequestStatus?: string | null;
  code?: string;
};

/** /api/customer/active-requests: tür → bekleyen talep var mı (ör. CALL_WAITER, PAYMENT_REQUEST_BLOCKED) */
export type ActiveRequests = Record<string, boolean>;

export type LiveBill = { total: number | null; paid: number };

export const orderable = (p: Product) => p.isAvailable && p.stockStatus === "IN_STOCK";

/** fg/bg: açık zeminde rozet, solid: görsel üstünde beyaz yazılı rozet — hepsi ≥4.5:1 */
export function stockLabel(p: Product) {
  if (!p.isAvailable || p.stockStatus === "OUT_OF_STOCK") return { text: "Stokta Yok", fg: "#B42318", bg: "#FDE3E1", solid: "#B42318" };
  if (p.stockStatus === "TEMPORARILY_UNAVAILABLE") return { text: "Geçici Yok", fg: "#8A5208", bg: "#FEF0C7", solid: "#8A5208" };
  return null;
}
