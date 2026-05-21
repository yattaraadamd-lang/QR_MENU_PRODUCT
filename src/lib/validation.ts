/**
 * Zod Validation Schemas
 * 
 * Tüm API endpoint'leri için input validation
 */

import { z } from "zod";
import { OrderStatus, TableStatus, ServiceRequestType, RequestStatus, StockStatus } from "@prisma/client";

// ============================================================================
// Common Schemas
// ============================================================================

export const cuidSchema = z.string().cuid();
export const emailSchema = z.string().email();
export const positiveIntSchema = z.number().int().positive();
export const nonNegativeIntSchema = z.number().int().min(0);
export const priceSchema = z.number().positive().multipleOf(0.01);

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
  categoryId: cuidSchema,
  image: z.string().url().optional().nullable(),
  isAvailable: z.boolean().default(true),
  stockStatus: z.nativeEnum(StockStatus).default("IN_STOCK"),
  allergens: z.string().max(500).optional().nullable(),
  ingredients: z.string().max(1000).optional().nullable(),
  preparationTime: positiveIntSchema.optional().nullable(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  price: priceSchema.optional(),
  categoryId: cuidSchema.optional(),
  image: z.string().url().optional().nullable(),
  isAvailable: z.boolean().optional(),
  stockStatus: z.nativeEnum(StockStatus).optional(),
  allergens: z.string().max(500).optional().nullable(),
  ingredients: z.string().max(1000).optional().nullable(),
  preparationTime: positiveIntSchema.optional().nullable(),
  isDeleted: z.boolean().optional(),
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
  productId: cuidSchema,
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
  password: z.string().min(6).max(100),
  role: z.enum(["ADMIN", "WAITER"]),
});

export const updateStaffSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: emailSchema.optional(),
  password: z.string().min(6).max(100).optional(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// Business Schemas
// ============================================================================

export const updateBusinessSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  email: emailSchema.optional().nullable(),
  logo: z.string().url().optional().nullable(),
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
  isActive: z.boolean().optional(),
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
