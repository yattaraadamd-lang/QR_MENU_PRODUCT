/**
 * Zod Validation Schemas
 * 
 * Tüm API endpoint'leri için input validation
 */

import { z } from "zod";
import { OrderStatus, TableStatus, ServiceRequestType, RequestStatus, StockStatus, OrderCancelReasonCode } from "@prisma/client";

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
  preparationTime: positiveIntSchema.optional().nullable(),
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
  preparationTime: positiveIntSchema.optional().nullable(),
  isDeleted: z.boolean().optional(),
  isPopular: z.boolean().optional(), // ✅ Admin formdan geliyor
  sortOrder: z.number().int().min(0).optional(), // ✅ Admin formdan geliyor
});

// ============================================================================
// Category Schemas
// ============================================================================

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  displayOrder: nonNegativeIntSchema.default(0),
  isActive: z.boolean().default(true),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  displayOrder: nonNegativeIntSchema.optional(),
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

/** NUL ve eşi olmayan surrogate Postgres'e yazılamıyor; route 500 dönüyordu */
function hasUnstorableChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code === 0) return true;
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        i++;
        continue;
      }
      return true;
    }
    if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
}

function customerTextSchema(max: number, label: string) {
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
        customerNote: customerTextSchema(200, "Ürün notu").nullish(),
      })
    )
    .min(1, "Geçersiz sipariş bilgileri")
    .max(50, "Bir siparişte maksimum 50 farklı ürün olabilir."),
  note: customerTextSchema(500, "Sipariş notu").nullish(),
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
  note: customerTextSchema(500, "Not alanı").nullish(),
  reason: customerTextSchema(200, "Sebep alanı").nullish(),
  orderNote: customerTextSchema(500, "Sipariş notu").nullish(),
  idempotencyKey: idempotencyKeySchema.nullish(),
  // Yalnız ORDER_REQUEST önizlemesi; adet route'ta 1-99 aralığına sıkıştırılıyor
  items: z
    .array(
      z.object({
        productId: cuidSchema,
        quantity: z.number().finite().nullish(),
        customerNote: customerTextSchema(200, "Ürün notu").nullish(),
      })
    )
    .max(50, "Bir siparişte maksimum 50 farklı ürün olabilir.")
    .nullish(),
});

export const customerPaymentRequestSchema = z.object({
  businessId: cuidSchema,
  tableId: cuidSchema,
  note: customerTextSchema(500, "Not alanı").nullish(),
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
