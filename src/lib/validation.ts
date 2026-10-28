/**
 * Zod Validation Schemas
 * 
 * Tüm API endpoint'leri için input validation
 */

import { z } from "zod";
import { OrderStatus, TableStatus, ServiceRequestType, RequestStatus, StockStatus, OrderCancelReasonCode, PaymentMethod } from "@prisma/client";
import { ApiError, hasUnstorableChars } from "@/lib/api/handler";

// ============================================================================
// Common Schemas
// ============================================================================

// ✅ Demo string ID'leri de kabul eder: prod-turk-kahvesi, cat-yiyecek, gerçek CUID'ler
export const cuidSchema = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/, "Geçersiz ID formatı");
export const emailSchema = z.string().email();
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
  tableNumber: z.string().min(1).max(50),
  tableName: z.string().min(1).max(100).optional(),
  qrCode: z.string().optional(),
});

export const updateTableSchema = z.object({
  tableNumber: z.string().min(1).max(50).optional(),
  tableName: z.string().min(1).max(100).optional().nullable(),
  status: z.nativeEnum(TableStatus).optional(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// Product Schemas
// ============================================================================

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  price: priceSchema,
  categoryId: z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/).optional().nullable(), // ✅ Demo ID + CUID + null desteklenir
  image: httpUrlSchema.optional().nullable(),
  isAvailable: z.boolean().default(true),
  stockStatus: z.nativeEnum(StockStatus).default("IN_STOCK"),
  allergens: z.string().max(500).optional().nullable().or(z.literal("")),
  ingredients: z.string().max(1000).optional().nullable().or(z.literal("")),
  isPopular: z.boolean().optional().default(false), // ✅ Admin formdan geliyor
  sortOrder: z.number().int().min(0).optional().default(0), // ✅ Admin formdan geliyor
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  price: priceSchema.optional(),
  categoryId: z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/).optional().nullable(), // ✅ Demo ID + CUID + null desteklenir
  image: httpUrlSchema.optional().nullable(),
  isAvailable: z.boolean().optional(),
  stockStatus: z.nativeEnum(StockStatus).optional(),
  allergens: z.string().max(500).optional().nullable().or(z.literal("")),
  ingredients: z.string().max(1000).optional().nullable().or(z.literal("")),
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
  name: z.string().trim().min(1, "Kategori adı gereklidir").max(100),
  icon: z.string().max(50).nullish(),
  sortOrder: nonNegativeIntSchema.default(0),
  isActive: z.boolean().default(true),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1, "Kategori adı gereklidir").max(100).optional(),
  icon: z.string().max(50).nullish(),
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
  cancellationReason: z.string().max(500).optional().nullable(),
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

export const createStaffSchema = z.object({
  name: z.string().min(1).max(100),
  email: emailSchema,
  password: z.string().min(12, "Şifre en az 12 karakter olmalıdır").max(72, "Şifre en fazla 72 karakter olabilir"),
  role: z.enum(["ADMIN", "WAITER"]),
});

export const updateStaffSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: emailSchema.optional(),
  password: z.string().min(12, "Şifre en az 12 karakter olmalıdır").max(72, "Şifre en fazla 72 karakter olabilir").optional(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// Business Schemas
// ============================================================================

// 🔒 SECURITY: isActive bilerek yok — askıya alınan işletmeyi yalnız Super Admin açabilir
export const updateBusinessSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: emailSchema.optional().nullable().or(z.literal("")),
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
        customerNote: storableTextSchema(200, "Ürün notu").nullish(),
      })
    )
    .min(1, "Geçersiz sipariş bilgileri")
    .max(50, "Bir siparişte maksimum 50 farklı ürün olabilir."),
  note: storableTextSchema(500, "Sipariş notu").nullish(),
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
  note: storableTextSchema(500, "Not alanı").nullish(),
  reason: storableTextSchema(200, "Sebep alanı").nullish(),
  orderNote: storableTextSchema(500, "Sipariş notu").nullish(),
  idempotencyKey: idempotencyKeySchema.nullish(),
  // Yalnız ORDER_REQUEST önizlemesi; adet route'ta 1-99 aralığına sıkıştırılıyor
  items: z
    .array(
      z.object({
        productId: cuidSchema,
        quantity: z.number().finite().nullish(),
        customerNote: storableTextSchema(200, "Ürün notu").nullish(),
      })
    )
    .max(50, "Bir siparişte maksimum 50 farklı ürün olabilir.")
    .nullish(),
});

export const customerPaymentRequestSchema = z.object({
  businessId: cuidSchema,
  tableId: cuidSchema,
  note: storableTextSchema(500, "Not alanı").nullish(),
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

export const accessBlockRevokeSchema = z.object({
  note: storableTextSchema(2000, "Not").nullish(),
});

export const adminOrderCancelSchema = z.object({
  cancelReason: storableTextSchema(500, "İptal nedeni").nullish(),
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
  note: storableTextSchema(500, "Not").nullish(),
  idempotencyKey: idempotencyKeySchema.max(128).nullish(),
});

export const paymentRejectSchema = z.object({
  reason: storableTextSchema(500, "Red nedeni").nullish(),
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
  name: storableTextSchema(200, "İşletme adı").nullish(),
  email: z.string().max(254).nullish(),
  phone: z.string().max(30).nullish(),
  address: storableTextSchema(500, "Adres").nullish(),
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
