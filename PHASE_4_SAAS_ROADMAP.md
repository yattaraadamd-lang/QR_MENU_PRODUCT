# Phase 4: SaaS Architecture, Subscription & Billing - Roadmap

## 🎯 Hedef

Projeyi tam SaaS mimarisine dönüştürmek: Subscription yönetimi, billing, feature gates, usage tracking, integrations.

## 📋 Kapsam

### 1. Tenant Settings Genişletme

**Mevcut Business Model'e Eklenecekler:**

```prisma
model Business {
  // ... mevcut alanlar
  
  // SaaS Settings
  currency          String   @default("TRY")
  locale            String   @default("tr")
  timezone          String   @default("Europe/Istanbul")
  
  // Feature Toggles
  orderMode         OrderMode @default(TABLE_SERVICE)
  waiterCallEnabled Boolean   @default(true)
  paymentRequestEnabled Boolean @default(true)
  
  // Branding
  primaryColor      String?
  logoUrl           String?
  customDomain      String?   @unique
  
  // Limits (from subscription)
  maxTables         Int?
  maxWaiters        Int?
  maxProducts       Int?
  maxMonthlyOrders  Int?
}

enum OrderMode {
  TABLE_SERVICE    // Masa servisi (mevcut)
  TAKEAWAY         // Paket servis
  DELIVERY         // Teslimat
  HYBRID           // Karma
}
```

### 2. Feature Gate System

**Yeni Model: FeatureFlag**

```prisma
model FeatureFlag {
  id          String   @id @default(cuid())
  key         String   @unique
  name        String
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  planFeatures PlanFeature[]
  businessFeatureOverrides BusinessFeatureOverride[]
}

model PlanFeature {
  id        String  @id @default(cuid())
  planId    String
  featureId String
  enabled   Boolean @default(true)
  limit     Int?    // null = unlimited
  
  plan    SubscriptionPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  feature FeatureFlag      @relation(fields: [featureId], references: [id], onDelete: Cascade)
  
  @@unique([planId, featureId])
}

model BusinessFeatureOverride {
  id         String   @id @default(cuid())
  businessId String
  featureId  String
  enabled    Boolean
  limit      Int?
  reason     String?  // Why override was applied
  createdAt  DateTime @default(now())
  expiresAt  DateTime?
  
  business Business    @relation(fields: [businessId], references: [id], onDelete: Cascade)
  feature  FeatureFlag @relation(fields: [featureId], references: [id], onDelete: Cascade)
  
  @@unique([businessId, featureId])
}
```

**Feature Keys:**
- `tables.unlimited`
- `waiters.unlimited`
- `products.unlimited`
- `orders.unlimited`
- `reports.advanced`
- `branding.custom`
- `integrations.api`
- `integrations.webhook`
- `integrations.pos`
- `support.priority`
- `analytics.realtime`

### 3. Subscription Plan Genişletme

**SubscriptionPlan Model Güncellemesi:**

```prisma
model SubscriptionPlan {
  id              String   @id @default(cuid())
  name            String
  slug            String   @unique
  description     String?
  monthlyPrice    Decimal  @db.Decimal(10, 2)
  yearlyPrice     Decimal? @db.Decimal(10, 2)
  trialDays       Int      @default(14)
  
  // Limits
  maxTables       Int?     // null = unlimited
  maxWaiters      Int?
  maxProducts     Int?
  maxMonthlyOrders Int?
  
  // Features (deprecated - use PlanFeature instead)
  hasReports      Boolean  @default(false)
  hasPayments     Boolean  @default(false)
  hasLocationLock Boolean  @default(false)
  
  // New Features
  hasCustomBranding Boolean @default(false)
  hasAdvancedReports Boolean @default(false)
  hasIntegrations Boolean @default(false)
  hasPrioritySupport Boolean @default(false)
  hasWhiteLabel   Boolean @default(false)
  
  isActive        Boolean  @default(true)
  displayOrder    Int      @default(0)
  isPopular       Boolean  @default(false)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  subscriptions   BusinessSubscription[]
  planFeatures    PlanFeature[]
}
```

**Örnek Planlar:**

1. **Free Plan**
   - 3 masa, 1 garson, 20 ürün
   - 100 sipariş/ay
   - Temel özellikler

2. **Starter Plan** (₺299/ay)
   - 10 masa, 3 garson, 100 ürün
   - 500 sipariş/ay
   - Temel raporlar

3. **Professional Plan** (₺799/ay)
   - 30 masa, 10 garson, 500 ürün
   - 2000 sipariş/ay
   - Gelişmiş raporlar, özel branding

4. **Enterprise Plan** (₺1999/ay)
   - Sınırsız
   - Tüm özellikler
   - Öncelikli destek, API erişimi

### 4. Usage Tracking

**Yeni Model: UsageMetric**

```prisma
model UsageMetric {
  id          String   @id @default(cuid())
  businessId  String
  metricType  UsageMetricType
  value       Int
  period      String   // YYYY-MM format
  recordedAt  DateTime @default(now())
  
  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  
  @@unique([businessId, metricType, period])
  @@index([businessId, period])
}

enum UsageMetricType {
  ORDERS_COUNT
  TABLES_COUNT
  WAITERS_COUNT
  PRODUCTS_COUNT
  API_CALLS_COUNT
  WEBHOOK_CALLS_COUNT
  STORAGE_MB
}

model UsageEvent {
  id          String   @id @default(cuid())
  businessId  String
  eventType   String
  metadata    Json?
  createdAt   DateTime @default(now())
  
  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  
  @@index([businessId, createdAt])
  @@index([eventType, createdAt])
}
```

### 5. Billing Integration Abstraction

**Yeni Model: BillingProvider**

```prisma
model BillingProvider {
  id          String   @id @default(cuid())
  name        String   @unique
  slug        String   @unique
  isActive    Boolean  @default(true)
  config      Json?    // Provider-specific config
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  invoices Invoice[]
}

model Invoice {
  id              String        @id @default(cuid())
  businessId      String
  subscriptionId  String?
  providerId      String
  providerInvoiceId String?     @unique
  
  amount          Decimal       @db.Decimal(10, 2)
  currency        String        @default("TRY")
  status          InvoiceStatus @default(PENDING)
  
  billingPeriodStart DateTime
  billingPeriodEnd   DateTime
  
  dueDate         DateTime?
  paidAt          DateTime?
  
  invoiceUrl      String?
  metadata        Json?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  business     Business              @relation(fields: [businessId], references: [id], onDelete: Cascade)
  subscription BusinessSubscription? @relation(fields: [subscriptionId], references: [id])
  provider     BillingProvider       @relation(fields: [providerId], references: [id])
  
  @@index([businessId, status])
  @@index([status, dueDate])
}

enum InvoiceStatus {
  PENDING
  PAID
  OVERDUE
  CANCELLED
  REFUNDED
}
```

**Provider Interface (TypeScript):**

```typescript
// src/lib/billing/provider.interface.ts
export interface BillingProviderInterface {
  // Customer Management
  createCustomer(business: Business): Promise<string>; // Returns provider customer ID
  updateCustomer(customerId: string, data: any): Promise<void>;
  deleteCustomer(customerId: string): Promise<void>;
  
  // Subscription Management
  createSubscription(customerId: string, planId: string): Promise<string>;
  updateSubscription(subscriptionId: string, planId: string): Promise<void>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  
  // Payment Methods
  attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>;
  detachPaymentMethod(paymentMethodId: string): Promise<void>;
  
  // Invoices
  createInvoice(customerId: string, amount: number): Promise<string>;
  getInvoice(invoiceId: string): Promise<Invoice>;
  
  // Webhooks
  verifyWebhook(payload: string, signature: string): boolean;
  handleWebhook(event: any): Promise<void>;
}
```

### 6. API Key System

**Yeni Model: ApiKey**

```prisma
model ApiKey {
  id          String   @id @default(cuid())
  businessId  String
  name        String
  keyHash     String   @unique
  keyPrefix   String   // First 8 chars for identification
  
  scopes      String[] // ["orders:read", "orders:write", "products:read"]
  
  isActive    Boolean  @default(true)
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  revokedAt   DateTime?
  revokedBy   String?
  revokeReason String?
  
  createdAt   DateTime @default(now())
  createdBy   String
  
  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  
  @@index([businessId, isActive])
  @@index([keyPrefix])
}

model ApiKeyUsage {
  id          String   @id @default(cuid())
  apiKeyId    String
  endpoint    String
  method      String
  statusCode  Int
  responseTime Int     // milliseconds
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())
  
  @@index([apiKeyId, createdAt])
  @@index([createdAt])
}
```

**API Key Scopes:**
- `orders:read` - Siparişleri okuma
- `orders:write` - Sipariş oluşturma
- `orders:update` - Sipariş güncelleme
- `products:read` - Ürünleri okuma
- `products:write` - Ürün oluşturma/güncelleme
- `tables:read` - Masaları okuma
- `tables:write` - Masa yönetimi
- `reports:read` - Raporlara erişim
- `webhooks:manage` - Webhook yönetimi

### 7. Webhook System

**Yeni Model: Webhook**

```prisma
model Webhook {
  id          String   @id @default(cuid())
  businessId  String
  url         String
  secret      String   // For signature verification
  
  events      String[] // ["order.created", "order.updated"]
  
  isActive    Boolean  @default(true)
  lastTriggeredAt DateTime?
  failureCount Int     @default(0)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  deliveries WebhookDelivery[]
  
  @@index([businessId, isActive])
}

model WebhookDelivery {
  id          String   @id @default(cuid())
  webhookId   String
  event       String
  payload     Json
  
  status      WebhookDeliveryStatus @default(PENDING)
  statusCode  Int?
  response    String?
  error       String?
  
  attemptCount Int     @default(0)
  nextRetryAt DateTime?
  
  createdAt   DateTime @default(now())
  deliveredAt DateTime?
  
  webhook Webhook @relation(fields: [webhookId], references: [id], onDelete: Cascade)
  
  @@index([webhookId, status])
  @@index([status, nextRetryAt])
}

enum WebhookDeliveryStatus {
  PENDING
  DELIVERED
  FAILED
  CANCELLED
}
```

**Webhook Events:**
- `order.created` - Yeni sipariş
- `order.updated` - Sipariş güncellendi
- `order.cancelled` - Sipariş iptal edildi
- `payment.requested` - Ödeme talep edildi
- `payment.paid` - Ödeme yapıldı
- `product.created` - Ürün eklendi
- `product.updated` - Ürün güncellendi
- `product.stock_updated` - Stok güncellendi
- `table.session_started` - Masa oturumu başladı
- `table.session_ended` - Masa oturumu bitti

### 8. Audit Log System

**Yeni Model: AuditLog**

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  businessId  String?
  userId      String?
  
  action      String   // "product.create", "order.cancel"
  entityType  String   // "Product", "Order"
  entityId    String?
  
  oldValues   Json?
  newValues   Json?
  metadata    Json?
  
  ipAddress   String?
  userAgent   String?
  
  createdAt   DateTime @default(now())
  
  business Business? @relation(fields: [businessId], references: [id], onDelete: Cascade)
  user     User?     @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  @@index([businessId, createdAt])
  @@index([userId, createdAt])
  @@index([entityType, entityId])
  @@index([action, createdAt])
}
```

---

## 🏗️ Implementation Strategy

### Phase 4.1: Schema & Models (1 hafta)

**Week 1:**
- [ ] Prisma schema güncellemeleri
- [ ] Migration oluşturma
- [ ] Seed data güncelleme
- [ ] Model test'leri

### Phase 4.2: Feature Gate System (1 hafta)

**Week 1:**
- [ ] Feature flag service
- [ ] `assertFeatureEnabled()` helper
- [ ] Plan feature seeding
- [ ] Feature gate middleware

### Phase 4.3: Usage Tracking (1 hafta)

**Week 1:**
- [ ] Usage metric service
- [ ] Usage event tracking
- [ ] Limit check helpers
- [ ] Usage dashboard (admin)

### Phase 4.4: Billing Abstraction (1-2 hafta)

**Week 1:**
- [ ] Billing provider interface
- [ ] Mock provider implementation
- [ ] Invoice management
- [ ] Subscription lifecycle

**Week 2:**
- [ ] Stripe provider (opsiyonel)
- [ ] iyzico provider (opsiyonel)
- [ ] Webhook handling

### Phase 4.5: API Key System (1 hafta)

**Week 1:**
- [ ] API key generation
- [ ] API key authentication middleware
- [ ] Scope validation
- [ ] Usage tracking

### Phase 4.6: Webhook System (1 hafta)

**Week 1:**
- [ ] Webhook registration
- [ ] Event emission
- [ ] Delivery queue
- [ ] Retry mechanism

### Phase 4.7: Audit Log (3-5 gün)

- [ ] Audit log service
- [ ] Automatic logging middleware
- [ ] Audit log viewer (admin)

---

## 📦 New Dependencies

```json
{
  "stripe": "^14.0.0",              // Stripe integration (opsiyonel)
  "crypto": "built-in",             // API key hashing
  "bull": "^4.12.0",                // Job queue for webhooks
  "ioredis": "^5.3.2",              // Redis for queue
  "@sentry/node": "^7.91.0"         // Error tracking
}
```

---

## 🔒 Security Considerations

### API Key Security

1. **Key Generation:**
   - Use cryptographically secure random
   - Format: `qrm_live_xxxxxxxxxxxxx` or `qrm_test_xxxxxxxxxxxxx`
   - Store only hash (bcrypt)

2. **Key Rotation:**
   - Support multiple active keys
   - Graceful deprecation period
   - Automatic expiration

3. **Rate Limiting:**
   - Per-key rate limits
   - Scope-based limits
   - Burst protection

### Webhook Security

1. **Signature Verification:**
   - HMAC-SHA256 signature
   - Timestamp validation
   - Replay attack prevention

2. **Retry Strategy:**
   - Exponential backoff
   - Max 5 attempts
   - Dead letter queue

3. **Payload Validation:**
   - Schema validation
   - Size limits
   - Content-type check

---

## 📊 Usage Limits & Enforcement

### Limit Check Flow

```typescript
// Before creating order
await assertUsageLimit(businessId, 'orders', 'monthly');

// Before creating product
await assertUsageLimit(businessId, 'products', 'total');

// Before API call
await assertUsageLimit(businessId, 'api_calls', 'daily');
```

### Soft vs Hard Limits

**Soft Limits:**
- Warning at 80%
- Email notification
- Dashboard alert

**Hard Limits:**
- Block at 100%
- Upgrade prompt
- Grace period (3 days)

---

## 🎨 Admin UI Components

### Subscription Management

- [ ] Plan selector
- [ ] Usage dashboard
- [ ] Billing history
- [ ] Payment method management
- [ ] Invoice download

### Feature Management

- [ ] Feature flag list
- [ ] Feature override form
- [ ] Usage metrics charts
- [ ] Limit warnings

### API & Webhooks

- [ ] API key generator
- [ ] API key list with usage
- [ ] Webhook configuration
- [ ] Webhook delivery logs
- [ ] Webhook testing tool

---

## 🧪 Testing Strategy

### Unit Tests

- Feature gate logic
- Usage tracking
- Billing calculations
- API key validation
- Webhook signature

### Integration Tests

- Subscription lifecycle
- Usage limit enforcement
- Webhook delivery
- API key authentication

### E2E Tests

- Plan upgrade flow
- Feature unlock flow
- API key usage flow
- Webhook integration flow

---

## 📝 Migration Notes

### Breaking Changes

- Business model'e yeni alanlar eklendi
- Subscription plan model değişti
- Yeni enum'lar eklendi

### Data Migration

```sql
-- Add default values for existing businesses
UPDATE businesses 
SET currency = 'TRY', 
    locale = 'tr', 
    timezone = 'Europe/Istanbul',
    orderMode = 'TABLE_SERVICE',
    waiterCallEnabled = true,
    paymentRequestEnabled = true
WHERE currency IS NULL;

-- Migrate old plan features to new system
-- (Manual script needed)
```

### Backward Compatibility

- Eski plan feature boolean'ları deprecated
- Yeni PlanFeature sistemi kullanılmalı
- 3 ay grace period

---

## 🚀 Deployment Checklist

- [ ] Prisma migration
- [ ] Seed data update
- [ ] Environment variables
- [ ] Redis setup (for queues)
- [ ] Webhook endpoint setup
- [ ] Billing provider config
- [ ] Feature flags seeded
- [ ] Usage tracking active
- [ ] Audit logging active

---

## 📞 Support

### Documentation

- API Key documentation
- Webhook documentation
- Billing integration guide
- Feature gate guide

### Developer Resources

- API reference
- Webhook event catalog
- SDK examples
- Postman collection

---

**Status:** 📋 Planning  
**Start Date:** TBD  
**Estimated Duration:** 6-8 hafta  
**Priority:** Medium (Phase 2 ve 3 tamamlandıktan sonra)
