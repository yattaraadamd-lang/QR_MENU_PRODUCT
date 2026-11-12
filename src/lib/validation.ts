/**
 * Zod Validation Schemas
 *
 * Tüm API endpoint'leri için input validation. Form alanı olan metinlerin uzunluk sınırı
 * src/contracts'taki `*_LIMITS` sabitlerinden gelir: form (maxLength) aynı sabiti okur (FE-ARCH-3.4).
 */

import "server-only";
import { z } from "zod";
import { OrderStatus, TableStatus, ServiceRequestType, RequestStatus, StockStatus, OrderCancelReasonCode, PaymentMethod } from "@prisma/client";
import { BUSINESS_LIMITS } from "@/contracts/business";
import { CATEGORY_LIMITS } from "@/contracts/categories";
import { ACCESS_BLOCK_LIMITS } from "@/contracts/customer-session";
import { ORDER_LIMITS } from "@/contracts/orders";
import { PAYMENT_LIMITS } from "@/contracts/payments";
import { PRODUCT_LIMITS } from "@/contracts/products";
import { SERVICE_REQUEST_LIMITS } from "@/contracts/requests";
import { TABLE_LIMITS } from "@/contracts/tables";
import { PASSWORD_LIMITS } from "@/contracts/users";
import { ApiError, hasUnstorableChars } from "@/lib/api/handler";

// ============================================================================
// Common Schemas
// ============================================================================

// ✅ Demo string ID'leri de kabul eder: prod-turk-kahvesi, cat-yiyecek, gerçek CUID'ler
export const cuidSchema = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/, "Geçersiz ID formatı");
// Giriş e-postayı küçük harfle arar: büyük harfli kayıt hesabı açılamaz hale getirirdi.
// 254: RFC 5321 üst sınırı; auth.ts daha uzun e-postayı denemeden reddeder.
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const positiveIntSchema = z.number().int().positive();
export const nonNegativeIntSchema = z.number().int().min(0);
export const priceSchema = z.number().positive().multipleOf(0.01);
// 🔒 SECURITY: z.string().url() "javascript:" / "data:" şemalarını da kabul eder; yalnız http(s)
export const httpUrlSchema = z
  .string()
  .url()
  .max(2000)
  .refine((value) => /^https?:\/\//i.test(value), "Yalnızca http(s) bağlantıları kabul edilir");

// ============================================================================
// Table Schemas
// ============================================================================

export const createTableSchema = z.object({
  tableNumber: z.string().min(1).max(TABLE_LIMITS.number),
  tableName: z.string().min(1).max(TABLE_LIMITS.name).optional(),
  qrCode: z.string().optional(),
});

export const updateTableSchema = z.object({
  tableNumber: z.string().min(1).max(TABLE_LIMITS.number).optional(),
  tableName: z.string().min(1).max(TABLE_LIMITS.name).optional().nullable(),
  status: z.nativeEnum(TableStatus).optional(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// Product Schemas
// ============================================================================

export const createProductSchema = z.object({
  name: z.string().min(1).max(PRODUCT_LIMITS.name),
  description: z.string().max(PRODUCT_LIMITS.description).optional().nullable(),
  price: priceSchema,
  categoryId: z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/).optional().nullable(), // ✅ Demo ID + CUID + null desteklenir
  image: httpUrlSchema.optional().nullable(),
  isAvailable: z.boolean().default(true),
  stockStatus: z.nativeEnum(StockStatus).default("IN_STOCK"),
  allergens: z.string().max(PRODUCT_LIMITS.allergens).optional().nullable().or(z.literal("")),
  ingredients: z.string().max(PRODUCT_LIMITS.ingredients).optional().nullable().or(z.literal("")),
  isPopular: z.boolean().optional().default(false), // ✅ Admin formdan geliyor
  sortOrder: z.number().int().min(0).optional().default(0), // ✅ Admin formdan geliyor
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(PRODUCT_LIMITS.name).optional(),
  description: z.string().max(PRODUCT_LIMITS.description).optional().nullable(),
  price: priceSchema.optional(),
  categoryId: z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/).optional().nullable(), // ✅ Demo ID + CUID + null desteklenir
  image: httpUrlSchema.optional().nullable(),
  isAvailable: z.boolean().optional(),
  stockStatus: z.nativeEnum(StockStatus).optional(),
  allergens: z.string().max(PRODUCT_LIMITS.allergens).optional().nullable().or(z.literal("")),
  ingredients: z.string().max(PRODUCT_LIMITS.ingredients).optional().nullable().or(z.literal("")),
  isDeleted: z.boolean().optional(),
  isPopular: z.boolean().optional(), // ✅ Admin formdan geliyor
  sortOrder: z.number().int().min(0).optional(), // ✅ Admin formdan geliyor
});

// ============================================================================
// Category Schemas
// ============================================================================

// Category modeliyle birebir (name, icon, sortOrder, isActive). Önceki şemada modelde olmayan
// description/displayOrder vardı, icon/sortOrder yoktu: oluşturma her seferinde Prisma
// "Unknown argument displayOrder" ile 500 veriyor, düzenleme icon/sortOrder'ı sessizce atıyordu.
export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Kategori adı gereklidir").max(CATEGORY_LIMITS.name),
  icon: z.string().max(CATEGORY_LIMITS.icon).nullish(),
  sortOrder: nonNegativeIntSchema.default(0),
  isActive: z.boolean().default(true),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1, "Kategori adı gereklidir").max(CATEGORY_LIMITS.name).optional(),
  icon: z.string().max(CATEGORY_LIMITS.icon).nullish(),
  sortOrder: nonNegativeIntSchema.optional(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// Order Schemas
// ============================================================================

export const orderItemSchema = z.object({
  // ✅ CUID zorunluluğu kaldırıldı — DB'de slug-style ID'ler (prod-turk-kahvesi) olabilir
  productId: z.string().min(1).max(200),
  quantity: z.number().int().min(1).max(99),
  customerNote: z.string().max(500).optional().nullable(),
});

export const createOrderSchema = z.object({
  tableId: cuidSchema,
  items: z.array(orderItemSchema).min(1).max(50),
  note: z.string().max(1000).optional().nullable(),
});

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  cancellationReason: z.string().max(ORDER_LIMITS.cancelReason).optional().nullable(),
  reasonCode: z.nativeEnum(OrderCancelReasonCode).optional().nullable(),
  outOfStockProductIds: z.array(z.string().min(1).max(200)).max(100).optional().nullable(),
});

// Garson ekranı 'cancelReason' ya da 'cancellationReason' gönderebilir — ikisi de kabul edilir
export const updateOrderStatusRequestSchema = z.preprocess((body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const { cancellationReason, cancelReason } = body as Record<string, unknown>;
  return { ...body, cancellationReason: cancellationReason ?? cancelReason ?? null };
}, updateOrderStatusSchema);

// ============================================================================
// Service Request Schemas
// ============================================================================

export const createServiceRequestSchema = z.object({
  tableId: cuidSchema,
  requestType: z.nativeEnum(ServiceRequestType),
  note: z.string().max(500).optional().nullable(),
});

export const updateServiceRequestSchema = z.object({
  status: z.nativeEnum(RequestStatus),
});

// ============================================================================
// User/Staff Schemas
// ============================================================================

// Kayıt ve garson kaydıyla aynı politika: PASSWORD_LIMITS (bcrypt 72 bayttan sonrasını yok sayar),
// en az 1 harf + 1 rakam
const staffPasswordSchema = z
  .string()
  .min(PASSWORD_LIMITS.min, `Şifre en az ${PASSWORD_LIMITS.min} karakter olmalıdır`)
  .max(PASSWORD_LIMITS.max, `Şifre en fazla ${PASSWORD_LIMITS.max} karakter olabilir`)
  .regex(/[a-zA-Z]/, "Şifre en az 1 harf içermelidir")
  .regex(/[0-9]/, "Şifre en az 1 rakam içermelidir");

export const createStaffSchema = z.object({
  name: z.string().min(1).max(100),
  email: emailSchema,
  password: staffPasswordSchema,
  role: z.enum(["ADMIN", "WAITER"]),
});

export const updateStaffSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: emailSchema.optional(),
  password: staffPasswordSchema.optional(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// Business Schemas
// ============================================================================

// 🔒 SECURITY: isActive bilerek yok — askıya alınan işletmeyi yalnız Super Admin açabilir
export const updateBusinessSchema = z.object({
  name: z.string().trim().min(1).max(BUSINESS_LIMITS.name).optional(),
  description: z.string().max(BUSINESS_LIMITS.description).optional().nullable(),
  address: z.string().max(BUSINESS_LIMITS.address).optional().nullable(),
  phone: z.string().max(BUSINESS_LIMITS.phone).optional().nullable(),
  // Ayarlar formu sunucu mesajını gösterir: "a@b" tarayıcı doğrulamasından geçer, burada takılır
  email: z.string().email("Geçerli bir e-posta adresi girin.").optional().nullable().or(z.literal("")),
  logo: httpUrlSchema.optional().nullable().or(z.literal("")),
});

// ============================================================================
// Payment Schemas
// ============================================================================

export const createPaymentSchema = z.object({
  orderId: cuidSchema.optional(),
  tableId: cuidSchema,
  amount: priceSchema,
  paymentMethod: z.enum(["CASH", "CARD", "ONLINE"]),
  note: z.string().max(500).optional().nullable(),
});

// ============================================================================
// Customer API Schemas (QR menü — kimliksiz/oturum token'lı uçlar)
// ============================================================================

// NUL ve eşi olmayan surrogate Postgres'e yazılamıyor. parseJson gövdenin tamamını zaten
// tarıyor; bu refine, şemanın parseJson dışında kullanıldığı yerlerde de alana özel mesaj verir.
function storableTextSchema(max: number, label: string) {
  return z
    .string()
    .max(max, `${label} maksimum ${max} karakter olabilir.`)
    .refine((value) => !hasUnstorableChars(value), `${label} geçersiz karakter içeriyor.`);
}

// İstemci `ord_<uuid>` / `or_<uuid>` üretir; uzunluk kuralları route'ta kendi mesajlarıyla kalır
const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]+$/, "Geçersiz idempotency key formatı.");

export const customerSessionCreateSchema = z.object({
  businessId: cuidSchema,
  tableId: cuidSchema,
  qrToken: z.string().max(200).nullish(),
  existingToken: z.string().max(200).nullish(),
});

export const customerOrderCreateSchema = z.object({
  items: z
    .array(
      z.object({
        productId: cuidSchema,
        quantity: z
          .number()
          .int("Geçersiz ürün adedi. Adet 1-100 arasında tam sayı olmalıdır.")
          .min(1, "Geçersiz ürün adedi. Adet 1-100 arasında tam sayı olmalıdır.")
          .max(100, "Geçersiz ürün adedi. Adet 1-100 arasında tam sayı olmalıdır."),
        customerNote: storableTextSchema(ORDER_LIMITS.itemNote, "Ürün notu").nullish(),
      })
    )
    .min(1, "Geçersiz sipariş bilgileri")
    .max(50, "Bir siparişte maksimum 50 farklı ürün olabilir."),
  note: storableTextSchema(ORDER_LIMITS.note, "Sipariş notu").nullish(),
  idempotencyKey: idempotencyKeySchema
    .min(8, "Idempotency key format geçersiz. 8-128 karakter arası string olmalıdır.")
    .max(128, "Idempotency key format geçersiz. 8-128 karakter arası string olmalıdır.")
    .nullish(),
});

// requestType listesi ve PAYMENT_REQUEST yönlendirmesi route'ta kendi mesajlarıyla kalır
export const customerServiceRequestCreateSchema = z.object({
  businessId: cuidSchema,
  tableId: cuidSchema,
  requestType: z.string().max(50),
  note: storableTextSchema(SERVICE_REQUEST_LIMITS.note, "Not alanı").nullish(),
  reason: storableTextSchema(SERVICE_REQUEST_LIMITS.reason, "Sebep alanı").nullish(),
  orderNote: storableTextSchema(ORDER_LIMITS.note, "Sipariş notu").nullish(),
  idempotencyKey: idempotencyKeySchema.nullish(),
  // Yalnız ORDER_REQUEST önizlemesi; adet route'ta 1-99 aralığına sıkıştırılıyor
  items: z
    .array(
      z.object({
        productId: cuidSchema,
        quantity: z.number().finite().nullish(),
        customerNote: storableTextSchema(ORDER_LIMITS.itemNote, "Ürün notu").nullish(),
      })
    )
    .max(50, "Bir siparişte maksimum 50 farklı ürün olabilir.")
    .nullish(),
});

export const customerPaymentRequestSchema = z.object({
  businessId: cuidSchema,
  tableId: cuidSchema,
  note: storableTextSchema(SERVICE_REQUEST_LIMITS.note, "Not alanı").nullish(),
});

export const customerActiveRequestsQuerySchema = z.object({
  tableId: cuidSchema,
  businessId: cuidSchema,
});

// Kod ya da davet linkinin tamamı gelebilir (extractInviteCode ayıklar); yalnız biçim denetlenir
export const inviteVerifySchema = z.object({
  code: z.string().max(2000),
});

// ============================================================================
// Staff API Schemas (admin / garson mutasyonları)
//
// Şemalar tip ve boyut denetler: nesne/dizi ya da kaydedilemeyen karakter Prisma'ya ulaşıp
// 500 üretmesin. Route'un kendi mesajıyla denetlediği zorunluluk ve iş kuralları (tutar > 0,
// geçerli durum listesi vb.) route'ta kalır; bu yüzden o alanlar burada nullish.
// ============================================================================

const PAYMENT_METHODS: Record<string, PaymentMethod> = {
  CASH: "CASH",
  CARD: "CARD",
  CREDIT_CARD: "CARD", // eski istemci adı
  ONLINE: "ONLINE",
  OTHER: "OTHER",
};

/**
 * Ödeme yöntemi: bilinmeyen değer servislerde denetlenmiyor, Prisma enum hatasıyla 500
 * veriyordu; artık 400. Boş değer undefined döner (zorunluluğu route kendi mesajıyla denetler).
 */
export function toPaymentMethod(raw: string | null | undefined): PaymentMethod | undefined {
  if (raw == null || raw === "") return undefined;
  const method = PAYMENT_METHODS[raw];
  if (!method) throw new ApiError(400, "INVALID_PAYMENT_METHOD", "Geçersiz ödeme yöntemi.");
  return method;
}

/**
 * İptal nedeni kodu: servis kodu doğrudan enum alanına yazıyor; bilinmeyen değer Prisma enum
 * hatasıyla 500 verirdi. Boş değer null döner.
 */
export function toCancelReasonCode(raw: string | null | undefined): OrderCancelReasonCode | null {
  if (raw == null || raw === "") return null;
  if (!(Object.values(OrderCancelReasonCode) as string[]).includes(raw)) {
    throw new ApiError(400, "INVALID_CANCEL_REASON", "Geçersiz iptal nedeni kodu.");
  }
  return raw as OrderCancelReasonCode;
}

// Formlardan tutar sayı ya da metin ("45.50") gelebilir; route'lar Number() ile çevirir
const amountInputSchema = z.union([z.number(), z.string().trim().max(32)]);

const sortItemsSchema = z
  .array(
    z.object({
      id: cuidSchema,
      sortOrder: z.number().int("Geçersiz sıralama formatı").min(0, "Geçersiz sıralama formatı"),
    })
  )
  .nullish();

export const categoryReorderSchema = z.object({ items: sortItemsSchema });
export const productReorderSchema = z.object({ items: sortItemsSchema });

// Önceden 2000'di; form zaten 500'le sınırlıyordu, artık ikisi aynı sabit
export const accessBlockRevokeSchema = z.object({
  note: storableTextSchema(ACCESS_BLOCK_LIMITS.note, "Not").nullish(),
});

export const adminOrderCancelSchema = z.object({
  cancelReason: storableTextSchema(ORDER_LIMITS.cancelReason, "İptal nedeni").nullish(),
  reasonCode: z.string().max(50).nullish(),
  outOfStockProductIds: z.array(cuidSchema).max(100).nullish(),
});

// Onay, tamamlama, doğrudan tahsilat, garson tahsilatı ve onaya gönderme aynı alanları kullanır
export const staffPaymentSchema = z.object({
  tableSessionId: cuidSchema.nullish(),
  amount: amountInputSchema.nullish(),
  receivedAmount: amountInputSchema.nullish(),
  method: z.string().max(20).nullish(),
  paymentMethod: z.string().max(20).nullish(),
  note: storableTextSchema(PAYMENT_LIMITS.note, "Not").nullish(),
  idempotencyKey: idempotencyKeySchema.max(128).nullish(),
});

export const paymentRejectSchema = z.object({
  reason: storableTextSchema(PAYMENT_LIMITS.rejectReason, "Red nedeni").nullish(),
});

export const forceCloseTableSchema = z.object({
  closeReason: storableTextSchema(500, "Kapatma nedeni").nullish(),
});

export const openTableRequestSchema = z.object({
  verificationCode: z.union([z.string().max(20), z.number()]).nullish(),
});

export const rejectOrderRequestSchema = z.object({
  reason: storableTextSchema(100, "Red nedeni").nullish(),
});

export const serviceRequestStatusSchema = z.object({
  status: z.string().max(20).nullish(),
});

export const waiterTableStatusSchema = z.object({
  tableId: cuidSchema.nullish(),
  status: z.string().max(30).nullish(),
});

export const tableSessionCloseSchema = z.object({
  forceClose: z.boolean().nullish(),
  closeReason: storableTextSchema(500, "Kapatma nedeni").nullish(),
});

// Zorunluluk, e-posta biçimi ve şifre politikası route'ta kendi mesajlarıyla denetlenir
export const superAdminBusinessCreateSchema = z.object({
  name: storableTextSchema(BUSINESS_LIMITS.name, "İşletme adı").nullish(),
  email: z.string().max(254).nullish(),
  phone: z.string().max(BUSINESS_LIMITS.phone).nullish(),
  address: storableTextSchema(BUSINESS_LIMITS.address, "Adres").nullish(),
  adminName: storableTextSchema(100, "Admin adı").nullish(),
  adminEmail: z.string().max(254).nullish(),
  adminPassword: z.string().max(200).nullish(),
});

// ============================================================================
// Query Parameter Schemas
// ============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const orderFilterSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  tableId: cuidSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const productFilterSchema = z.object({
  categoryId: cuidSchema.optional(),
  isAvailable: z.coerce.boolean().optional(),
  stockStatus: z.nativeEnum(StockStatus).optional(),
  search: z.string().max(100).optional(),
});

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Validate request body with Zod schema
 */
export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        success: false,
        error: `${firstError.path.join(".")}: ${firstError.message}`,
      };
    }
    return { success: false, error: "Geçersiz veri formatı" };
  }
}

/**
 * Validate query parameters with Zod schema
 */
export function validateQuery<T>(schema: z.ZodSchema<T>, params: URLSearchParams): { success: true; data: T } | { success: false; error: string } {
  try {
    const obj: Record<string, string> = {};
    params.forEach((value, key) => {
      obj[key] = value;
    });
    const validated = schema.parse(obj);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        success: false,
        error: `${firstError.path.join(".")}: ${firstError.message}`,
      };
    }
    return { success: false, error: "Geçersiz query parametreleri" };
  }
}

/**
 * Safe CUID validation
 */
export function isValidCuid(id: string): boolean {
  return cuidSchema.safeParse(id).success;
}
