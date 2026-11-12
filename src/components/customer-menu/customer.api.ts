import type { ActiveRequestsResponse } from "@/contracts/requests";
import { apiRequest, isRecord, type ApiResult } from "@/lib/api-client";
import type { ActiveRequests, AuthStatus, MenuResponse } from "./types";

/**
 * Müşteri uçları (FE-ARCH-2.1): hook'lar fetch yerine bu tipli fonksiyonları çağırır.
 * Oturum token'ı x-session-token başlığıyla tek yerden eklenir. Güven akışının yanıtları
 * (oturum durumu, doğrulama kodu) tip korumasıyla okunur; okunamayan yanıt ağ hatası sayılır
 * (önceki davranış: res.json() hatası catch'e düşüyordu).
 */

type Payload = Readonly<Record<string, unknown>>;

const sessionHeaders = (token: string | null): Readonly<Record<string, string>> =>
  token ? { "x-session-token": token } : {};

/** Başarı ya da hata gövdesi; JSON nesnesi yoksa (ağ hatası, boş ya da HTML yanıt) null */
function payloadOf(result: ApiResult<unknown>): Payload | null {
  const payload = result.ok ? result.data : result.body;
  return isRecord(payload) ? payload : null;
}

const text = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

const AUTH_STATUSES: readonly string[] = [
  "VIEW_ONLY",
  "PENDING",
  "AUTHORIZED",
  "REVOKED",
  "TABLE_ALREADY_CLAIMED",
] satisfies readonly AuthStatus[];
const authStatus = (value: unknown): AuthStatus | undefined =>
  typeof value === "string" && AUTH_STATUSES.includes(value) ? (value as AuthStatus) : undefined;

/** Talepteki doğrulama kodu (garson masaya gelince söylenir) */
function verificationCodeOf(request: unknown): string | null {
  if (!isRecord(request)) return null;
  const code = request.verificationCode;
  return typeof code === "string" && code ? code : null;
}

/** Sunucunun makine kodu (ör. SESSION_REVOKED, CUSTOMER_DEVICE_BLOCKED) */
export const errorCode = (result: ApiResult<unknown>): string | undefined => text(payloadOf(result)?.code);

/** Talep yanıtındaki doğrulama kodu: ORDER_REQUEST başarısında ve ORDER_REQUEST_PENDING hatasında gelir */
export const requestCodeOf = (result: ApiResult<unknown>): string | null =>
  verificationCodeOf(payloadOf(result)?.serviceRequest);

// ─── Oturum ──────────────────────────────────────────────────────────────────

/** GET /api/customer/session/status: başarıda ve hata gövdesinde aynı alanlar gelir */
export interface SessionStatus {
  /** Yanıt okunamadı (ağ hatası ya da JSON olmayan yanıt): çağıran kayıtlı token'la devam eder */
  readonly networkError: boolean;
  readonly ok: boolean;
  readonly valid: boolean;
  readonly status?: AuthStatus;
  readonly businessId?: string;
  readonly tableId?: string;
  readonly orderRequestStatus?: string;
  /** Yalnız demoda dolu: sistem onayına kalan süre */
  readonly demoAutoApproveInMs?: number;
  readonly code?: string;
}

export async function getSessionStatus(token: string): Promise<SessionStatus> {
  const result = await apiRequest<unknown>("/api/customer/session/status", { headers: sessionHeaders(token) });
  const payload = payloadOf(result);
  if (!payload) return { networkError: true, ok: false, valid: false };
  return {
    networkError: false,
    ok: result.ok,
    valid: payload.valid === true,
    status: authStatus(payload.authorizationStatus),
    businessId: text(payload.businessId),
    tableId: text(payload.tableId),
    orderRequestStatus: text(payload.orderRequestStatus),
    demoAutoApproveInMs: typeof payload.demoAutoApproveInMs === "number" ? payload.demoAutoApproveInMs : undefined,
    code: text(payload.code),
  };
}

export interface CreateSessionInput {
  readonly businessId: string;
  readonly tableId: string;
  readonly qrToken: string;
  readonly existingToken?: string;
}

export type CreateSessionResult =
  | { readonly kind: "created"; readonly sessionToken: string; readonly status?: AuthStatus }
  | { readonly kind: "rejected"; readonly message?: string }
  | { readonly kind: "networkError" };

/** QR kanıtıyla oturum açar ya da kayıtlı oturumu tazeler */
export async function createCustomerSession(input: CreateSessionInput): Promise<CreateSessionResult> {
  const result = await apiRequest<unknown>("/api/customer/session", { method: "POST", body: input });
  const payload = payloadOf(result);
  if (!payload) return { kind: "networkError" };
  const sessionToken = text(payload.sessionToken);
  if (result.ok && sessionToken) {
    return { kind: "created", sessionToken, status: authStatus(payload.authorizationStatus) };
  }
  return { kind: "rejected", message: text(payload.message) || text(payload.error) };
}

/** Demo: garson süresinde onaylamazsa sistem onaylar; sonucu sonraki yoklama gösterir */
export const approveDemoOrderRequest = (token: string) =>
  apiRequest<unknown>("/api/customer/demo/approve-order-request", { method: "POST", headers: sessionHeaders(token) });

// ─── Menü ve masa etkinliği ──────────────────────────────────────────────────

const MENU_ERROR = "Menü yüklenemedi.";

export type MenuFetchResult =
  | { readonly kind: "fresh"; readonly menu: MenuResponse; readonly etag: string | null }
  | { readonly kind: "notModified" }
  | { readonly kind: "failed"; readonly error: string };

/** Masa menüsü; `etag` verilirse menü değişmediyse gövdesiz 304 döner (notModified) */
export async function getMenu(businessId: string, tableNumber: string, etag: string | null): Promise<MenuFetchResult> {
  const url = `/api/menu/${encodeURIComponent(businessId)}/${encodeURIComponent(tableNumber)}`;
  const result = await apiRequest<Partial<MenuResponse> | null>(url, {
    headers: etag ? { "If-None-Match": etag } : undefined,
    fallbackError: MENU_ERROR,
  });
  if (result.ok) {
    const { business, table, categories }: Partial<MenuResponse> = result.data ?? {};
    if (!business || !table) return { kind: "failed", error: MENU_ERROR };
    return { kind: "fresh", menu: { business, table, categories: categories ?? [] }, etag: result.headers.get("ETag") };
  }
  if (result.status === 304) return { kind: "notModified" };
  return { kind: "failed", error: result.error };
}

export interface TableActivity {
  readonly activeRequests: ActiveRequests;
  readonly verificationCode: string | null;
}

/** Masanın bekleyen talepleri; okunamazsa null (son durum ekranda kalır) */
export async function getActiveRequests(businessId: string, tableId: string, token: string | null): Promise<TableActivity | null> {
  const query = new URLSearchParams({ tableId, businessId });
  const result = await apiRequest<Partial<ActiveRequestsResponse> | null>(`/api/customer/active-requests?${query}`, {
    headers: sessionHeaders(token),
  });
  if (!result.ok || !result.data) return null;
  const { activeRequests = {}, requestDetails } = result.data;
  return { activeRequests, verificationCode: requestDetails?.ORDER_REQUEST?.verificationCode || null };
}

/** Canlı adisyon: `paid` yalnız adisyon kaydı varken gelir (yoksa siparişlerden toplam) */
export interface LiveBillUpdate {
  readonly total: number;
  readonly paid?: number;
}

const CLOSED_ORDER_STATUSES: readonly unknown[] = ["CANCELLED", "REJECTED"];

export async function getLiveBill(token: string): Promise<LiveBillUpdate | null> {
  const result = await apiRequest<unknown>("/api/customer/orders", { headers: sessionHeaders(token) });
  if (!result.ok || !isRecord(result.data)) return null;
  const { bill, orders } = result.data;
  if (isRecord(bill)) return { total: Number(bill.totalAmount) || 0, paid: Number(bill.paidAmount) || 0 };
  if (!Array.isArray(orders)) return null;
  // Adisyon yoksa siparişlerden hesapla
  const total = orders.reduce<number>(
    (sum, order) =>
      isRecord(order) && !CLOSED_ORDER_STATUSES.includes(order.status) ? sum + (Number(order.totalPrice) || 0) : sum,
    0,
  );
  return { total };
}

// ─── Sipariş ve talepler ─────────────────────────────────────────────────────

export interface CartLine {
  readonly productId: string;
  readonly quantity: number;
  readonly customerNote: string | null;
}

export interface OrderSubmission {
  readonly items: readonly CartLine[];
  readonly note: string | null;
  readonly idempotencyKey: string;
}

/** Yetkili oturumun gerçek siparişi */
export const sendOrder = (token: string, order: OrderSubmission) =>
  apiRequest<unknown>("/api/customer/orders", {
    method: "POST",
    headers: sessionHeaders(token),
    body: order,
    fallbackError: "Sipariş gönderilemedi",
  });

export interface OrderRequestSubmission {
  readonly businessId: string;
  readonly tableId: string;
  readonly reason: string;
  readonly items: readonly CartLine[];
  readonly orderNote: string | null;
  readonly idempotencyKey: string;
}

/** Görüntüleme yetkili oturumun sipariş talebi: garson onay koduyla masayı açar */
export const sendOrderRequest = (token: string, request: OrderRequestSubmission) =>
  apiRequest<unknown>("/api/customer/service-requests", {
    method: "POST",
    headers: sessionHeaders(token),
    body: { ...request, requestType: "ORDER_REQUEST" },
    fallbackError: "Talep gönderilemedi",
  });

export interface ServiceRequestSubmission {
  readonly businessId: string;
  readonly tableId: string;
  readonly requestType: string;
  readonly reason: string | null;
  readonly note: string | null;
}

export const sendServiceRequest = (token: string, request: ServiceRequestSubmission) =>
  apiRequest<unknown>("/api/customer/service-requests", {
    method: "POST",
    headers: sessionHeaders(token),
    body: request,
    fallbackError: "Talep gönderilemedi",
  });

export interface PaymentRequestSubmission {
  readonly businessId: string;
  readonly tableId: string;
  readonly note: string | null;
}

export const sendPaymentRequest = (token: string, request: PaymentRequestSubmission) =>
  apiRequest<unknown>("/api/customer/payment-requests", {
    method: "POST",
    headers: sessionHeaders(token),
    body: request,
    fallbackError: "Talep gönderilemedi",
  });
