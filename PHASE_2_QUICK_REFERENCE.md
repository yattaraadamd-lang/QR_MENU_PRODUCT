# Phase 2: Quick Reference Guide

Bu döküman Phase 2 değişikliklerini hızlıca uygulamak için pratik bir rehberdir.

## 🚀 Hızlı Başlangıç

### 1. Import'ları Güncelle

**Eski:**
```typescript
import { requireAdmin, getBusinessId } from "@/lib/auth-helpers";
```

**Yeni:**
```typescript
import { requireAdmin, getBusinessIdFromSession } from "@/lib/tenant";
import { validateBody, createProductSchema } from "@/lib/validation";
```

### 2. Authentication Pattern

**Eski:**
```typescript
const { error, response, session } = await requireAdmin();
if (error) return response!;
const businessId = getBusinessId(session);
```

**Yeni:**
```typescript
const authResult = await requireAdmin();
if (!authResult.success) return authResult.response;
const businessId = getBusinessIdFromSession(authResult.session);
```

### 3. Input Validation Pattern

**Eski:**
```typescript
const body = await request.json();
if (!body.name || !body.price) {
  return NextResponse.json({ error: "Invalid input" }, { status: 400 });
}
```

**Yeni:**
```typescript
const body = await request.json();
const validation = validateBody(createProductSchema, body);
if (!validation.success) {
  return NextResponse.json({ error: validation.error }, { status: 400 });
}
// Use validation.data (type-safe)
```

### 4. Resource Ownership Pattern

**Eski:**
```typescript
const product = await prisma.product.findUnique({ where: { id } });
if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
```

**Yeni:**
```typescript
const product = await prisma.product.findFirst({
  where: { id, businessId }, // Tenant check
  select: { id: true, name: true }, // Minimal select
});
if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
```

### 5. ID Validation Pattern

**Yeni:**
```typescript
import { isValidCuid } from "@/lib/validation";

if (!isValidCuid(params.id)) {
  return NextResponse.json(
    { error: "Geçersiz ID formatı" },
    { status: 400 }
  );
}
```

## 📝 Validation Schemas

### Mevcut Schema'lar

```typescript
// Products
createProductSchema
updateProductSchema

// Categories
createCategorySchema
updateCategorySchema

// Tables
createTableSchema
updateTableSchema

// Orders
createOrderSchema
updateOrderStatusSchema
orderItemSchema

// Service Requests
createServiceRequestSchema
updateServiceRequestSchema

// Staff
createStaffSchema
updateStaffSchema

// Business
updateBusinessSchema

// Payments
createPaymentSchema

// Query Parameters
paginationSchema
orderFilterSchema
productFilterSchema
```

### Schema Kullanımı

```typescript
// Body validation
const validation = validateBody(createProductSchema, body);
if (!validation.success) {
  return NextResponse.json({ error: validation.error }, { status: 400 });
}

// Query validation
const { searchParams } = new URL(request.url);
const validation = validateQuery(paginationSchema, searchParams);
if (validation.success) {
  const { page, limit } = validation.data;
}
```

## 🔐 Tenant Helpers

### requireAuth()
Genel authentication (ADMIN, WAITER, SUPER_ADMIN)

```typescript
const authResult = await requireAuth();
if (!authResult.success) return authResult.response;
```

### requireAdmin()
Sadece ADMIN veya SUPER_ADMIN

```typescript
const authResult = await requireAdmin();
if (!authResult.success) return authResult.response;
```

### requireSuperAdmin()
Sadece SUPER_ADMIN

```typescript
const authResult = await requireSuperAdmin();
if (!authResult.success) return authResult.response;
```

### verifyResourceOwnership()
Kaynak sahipliği kontrolü

```typescript
const isOwned = await verifyResourceOwnership(
  "product", // resourceType
  productId,
  businessId
);

if (!isOwned) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
```

### verifyQRSession()
QR token doğrulama (customer endpoints için)

```typescript
const qrResult = await verifyQRSession(tableId, qrToken);
if (!qrResult.success) return qrResult.response;

const { table } = qrResult;
const businessId = table.businessId;
```

## 📊 Query Patterns

### GET Endpoint (Listing)

```typescript
export async function GET(request: NextRequest) {
  // 1. Authentication
  const authResult = await requireAdmin();
  if (!authResult.success) return authResult.response;
  
  const businessId = getBusinessIdFromSession(authResult.session);
  
  // 2. Query validation
  const { searchParams } = new URL(request.url);
  const validation = validateQuery(paginationSchema, searchParams);
  
  const page = validation.success ? validation.data.page : 1;
  const limit = validation.success ? validation.data.limit : 20;
  
  // 3. Tenant-safe query with minimal select
  const items = await prisma.product.findMany({
    where: { businessId, isDeleted: false },
    select: {
      id: true,
      name: true,
      price: true,
      // Only necessary fields
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });
  
  return NextResponse.json({ items, page, limit });
}
```

### POST Endpoint (Create)

```typescript
export async function POST(request: NextRequest) {
  // 1. Authentication
  const authResult = await requireAdmin();
  if (!authResult.success) return authResult.response;
  
  const businessId = getBusinessIdFromSession(authResult.session);
  
  // 2. Validation
  const body = await request.json();
  const validation = validateBody(createProductSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  
  // 3. Business logic (duplicate check, etc.)
  const duplicate = await prisma.product.findFirst({
    where: { businessId, name: validation.data.name },
  });
  
  if (duplicate) {
    return NextResponse.json({ error: "Already exists" }, { status: 400 });
  }
  
  // 4. Create with businessId from session
  const item = await prisma.product.create({
    data: {
      ...validation.data,
      businessId, // From session
    },
    select: {
      id: true,
      name: true,
      // Minimal select
    },
  });
  
  return NextResponse.json({ message: "Created", item }, { status: 201 });
}
```

### PUT Endpoint (Update)

```typescript
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Authentication
  const authResult = await requireAdmin();
  if (!authResult.success) return authResult.response;
  
  const businessId = getBusinessIdFromSession(authResult.session);
  
  // 2. ID validation
  if (!isValidCuid(params.id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }
  
  // 3. Body validation
  const body = await request.json();
  const validation = validateBody(updateProductSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  
  // 4. Ownership verification
  const existing = await prisma.product.findFirst({
    where: { id: params.id, businessId },
  });
  
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  
  // 5. Update
  const item = await prisma.product.update({
    where: { id: params.id },
    data: validation.data,
    select: {
      id: true,
      name: true,
      // Minimal select
    },
  });
  
  return NextResponse.json({ message: "Updated", item });
}
```

### DELETE Endpoint (Soft Delete)

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Authentication
  const authResult = await requireAdmin();
  if (!authResult.success) return authResult.response;
  
  const businessId = getBusinessIdFromSession(authResult.session);
  
  // 2. ID validation
  if (!isValidCuid(params.id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }
  
  // 3. Ownership verification
  const existing = await prisma.product.findFirst({
    where: { id: params.id, businessId, isDeleted: false },
  });
  
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  
  // 4. Soft delete
  await prisma.product.update({
    where: { id: params.id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  });
  
  return NextResponse.json({ message: "Deleted" });
}
```

## 🎯 Best Practices

### 1. ASLA businessId'yi request'ten alma
```typescript
// ❌ YANLIŞ
const { businessId } = await request.json();

// ✅ DOĞRU
const businessId = getBusinessIdFromSession(authResult.session);
```

### 2. Her zaman minimal select kullan
```typescript
// ❌ YANLIŞ
const products = await prisma.product.findMany({
  where: { businessId },
  include: { category: true }, // Tüm alanlar
});

// ✅ DOĞRU
const products = await prisma.product.findMany({
  where: { businessId },
  select: {
    id: true,
    name: true,
    price: true,
    category: { select: { name: true } },
  },
});
```

### 3. Her zaman validation kullan
```typescript
// ❌ YANLIŞ
const { name, price } = await request.json();
if (!name || !price) { ... }

// ✅ DOĞRU
const body = await request.json();
const validation = validateBody(createProductSchema, body);
if (!validation.success) { ... }
```

### 4. Her zaman ownership check yap
```typescript
// ❌ YANLIŞ
const product = await prisma.product.findUnique({ where: { id } });

// ✅ DOĞRU
const product = await prisma.product.findFirst({
  where: { id, businessId },
});
```

### 5. Transaction kullan (kritik işlemler için)
```typescript
// ✅ DOĞRU
const result = await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ ... });
  await tx.table.update({ ... });
  await tx.notification.create({ ... });
  return order;
});
```

## 🔍 Debugging Tips

### 1. Tenant Isolation Kontrolü
```typescript
// Log businessId to verify it's from session
console.log("BusinessId from session:", businessId);
console.log("User ID:", authResult.session.userId);
```

### 2. Validation Error Kontrolü
```typescript
// Log validation errors
if (!validation.success) {
  console.error("Validation error:", validation.error);
  return NextResponse.json({ error: validation.error }, { status: 400 });
}
```

### 3. Ownership Kontrolü
```typescript
// Log ownership check
const existing = await prisma.product.findFirst({
  where: { id: params.id, businessId },
});
console.log("Ownership check:", { found: !!existing, id: params.id, businessId });
```

## 📚 Daha Fazla Bilgi

- **Detaylı Migration Guide:** `PHASE_2_MIGRATION_GUIDE.md`
- **Security Improvements:** `SECURITY_IMPROVEMENTS_COMPLETE.md`
- **Progress Summary:** `PHASE_2_PROGRESS_SUMMARY.txt`
- **Code Examples:** `src/app/api/orders/route.ts`, `src/app/api/admin/products/route.ts`

---

**Son Güncelleme:** 21 Mayıs 2026  
**Versiyon:** Phase 2 - v0.65
