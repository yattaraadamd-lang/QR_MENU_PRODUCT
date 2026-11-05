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
export type Business = { id: string; name: string; description: string | null; logo: string | null };
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
  /** Yalnız demoda dolu: sistem onayına kalan süre */
  demoAutoApproveInMs?: number | null;
  code?: string;
};

/** /api/customer/active-requests: tür → bekleyen talep var mı (ör. CALL_WAITER, PAYMENT_REQUEST_BLOCKED) */
export type ActiveRequests = Record<string, boolean>;

export type LiveBill = { total: number | null; paid: number };

export const orderable = (p: Product) => p.isAvailable && p.stockStatus === "IN_STOCK";

/** Stok rozeti: metin ve ton (renkler temada) */
export function stockLabel(p: Product): { text: string; tone: "danger" | "warning" } | null {
  if (p.stockStatus === "OUT_OF_STOCK") return { text: "Stokta Yok", tone: "danger" };
  if (p.stockStatus === "TEMPORARILY_UNAVAILABLE") return { text: "Geçici Yok", tone: "warning" };
  return null;
}
