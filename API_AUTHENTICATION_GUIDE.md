# 🔐 API Authentication Guide - Customer Orders

**Endpoint**: `/api/customer/orders`  
**Method**: POST  
**Authentication Type**: Session Token (Not API Key)

---

## 🎯 AUTHENTICATION MECHANISM

### **NOT an API Key System** ❌
This endpoint does **NOT** use traditional API keys. It uses **session-based authentication** with QR code tokens.

### **Session Token System** ✅
- Customers scan a QR code at their table
- QR code contains a unique token that creates a `CustomerSession`
- Session token is stored as SHA-256 hash in database
- Token is sent via HTTP header: `x-session-token`

---

## 📋 AUTHENTICATION FLOW

### 1. Customer Scans QR Code
```
QR Code URL: /qr/[qrToken]
Example: https://yourapp.com/qr/abc123xyz789
```

### 2. QR Token → Customer Session
- Backend validates QR token
- Creates/retrieves `CustomerSession`
- Returns session token to frontend
- Frontend stores token and sends with every request

### 3. Order Request with Session Token
```http
POST /api/customer/orders
Headers:
  x-session-token: raw_session_token_value
  Content-Type: application/json
  Cookie: customer_device_id=device_uuid

Body:
{
  "items": [
    {
      "productId": "clx123",
      "quantity": 2,
      "customerNote": "Az şekerli"
    }
  ],
  "note": "Hızlı gelsin",
  "idempotencyKey": "uuid-v4-unique-key"
}
```

---

## 🔒 SECURITY LAYERS

### Layer 1: Session Token Validation
**Function**: `validateAuthorizedTableSession()`  
**Checks**:
- ✅ Session token exists in header (`x-session-token`)
- ✅ Token hash found in database
- ✅ Session status is `ACTIVE` (not EXPIRED, REVOKED, CLOSED)
- ✅ Session not expired (timestamp check)
- ✅ Authorization status is `AUTHORIZED` (not PENDING, VIEW_ONLY, REVOKED)
- ✅ Table session is ACTIVE

**Header**:
```http
x-session-token: [raw_token_value]
```

**Hash Mechanism**:
```typescript
// Frontend sends raw token
const rawToken = "abc123xyz789...";

// Backend hashes it for lookup
const tokenHash = crypto
  .createHash("sha256")
  .update(rawToken)
  .digest("hex");

// Finds in database
const session = await prisma.customerSession.findUnique({
  where: { sessionToken: tokenHash }
});
```

---

### Layer 2: Device Block Check
**Purpose**: Prevent blocked devices from placing orders  
**Mechanism**:
- Device ID stored in cookie: `customer_device_id`
- Device key hashed: SHA-256
- Checked against `CustomerAccessBlock` table
- If blocked → 403 Forbidden

**Cookie**:
```http
Cookie: customer_device_id=550e8400-e29b-41d4-a716-446655440000
```

**Check**:
```typescript
if (deviceKeyHash) {
  const isBlocked = await checkDeviceBlock(businessId, deviceKeyHash);
  if (isBlocked) {
    return { error: "Bu cihazın bu işletmede işlem yapması engellendi.", status: 403 };
  }
}
```

---

### Layer 3: Rate Limiting
**Limit**: 1 order per 10 seconds per session  
**Key**: `order:{sessionToken}`  
**Response**: 429 Too Many Requests

**Implementation**:
```typescript
const rateLimit = await checkRateLimit(
  `order:${sessionToken}`, 
  RATE_LIMITS.ORDER_CREATE
);

if (!rateLimit.allowed) {
  const waitSeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
  return {
    error: `Lütfen ${waitSeconds} saniye bekleyip tekrar deneyin.`,
    code: "RATE_LIMITED",
    status: 429
  };
}
```

---

### Layer 4: Idempotency Key
**Purpose**: Prevent duplicate orders  
**Scope**: businessId + customerSessionId + idempotencyKey  
**Format**: String, 8-128 characters (typically UUID v4)

**Check**:
```typescript
if (idempotencyKey) {
  const existingOrder = await prisma.order.findFirst({
    where: {
      idempotencyKey,
      businessId,        // ✅ Tenant isolation
      customerSessionId, // ✅ Session scope
    },
  });
  
  if (existingOrder) {
    // Return existing order (200 OK)
    return { message: "Sipariş zaten gönderilmiş.", order: existingOrder };
  }
}
```

---

### Layer 5: Spam Prevention
**Check**: Duplicate product list in last 30 seconds  
**Mechanism**: Product signature comparison

**Implementation**:
```typescript
// Create signature: productId:quantity sorted
const incomingSignature = items
  .map(item => `${item.productId}:${item.quantity}`)
  .sort()
  .join("|");

// Example: "clx123:2|clx456:1"

// Check recent orders
const recentOrders = await prisma.order.findMany({
  where: {
    customerSessionId: session.id,
    status: { in: ["PENDING", "ACCEPTED"] },
    createdAt: { gte: new Date(Date.now() - 30000) },
  },
});

// Compare signatures
for (const recent of recentOrders) {
  const recentSignature = recent.items
    .map(item => `${item.productId}:${item.quantity}`)
    .sort()
    .join("|");
  
  if (recentSignature === incomingSignature) {
    return { 
      error: "Bu siparişi zaten 30 saniye içinde verdiniz.", 
      status: 429 
    };
  }
}
```

---

### Layer 6: Business & Table Validation
**Checks**:
- ✅ Business is active (`business.isActive = true`)
- ✅ Table is active and not deleted
- ✅ Table session is ACTIVE
- ✅ Product belongs to the same business (tenant isolation)

---

### Layer 7: Product Validation
**Checks**:
- ✅ Product exists and not deleted (`isDeleted = false`)
- ✅ Product belongs to customer's business (tenant isolation)
- ✅ Product is available (`isAvailable = true`)
- ✅ Product is in stock (`stockStatus = IN_STOCK`)
- ✅ Price is valid (non-negative, finite)
- ✅ Quantity is valid (1-100, integer)

**Server-Side Price Validation**:
```typescript
// Backend retrieves product with current price
const product = await prisma.product.findFirst({
  where: { id: productId, businessId, isDeleted: false }
});

// Uses backend price (ignores frontend price)
const backendPrice = Number(product.price);
const itemTotal = backendPrice * quantity;
totalPrice += itemTotal;
```

---

### Layer 8: Input Validation
**Limits**:
- ✅ Items array: 1-50 products
- ✅ Quantity per item: 1-100 (integer)
- ✅ Order note: max 500 characters
- ✅ Product note: max 200 characters
- ✅ Total price: max 1,000,000
- ✅ Idempotency key: 8-128 characters (string)
- ✅ Product ID: string, non-empty

---

## 📝 REQUEST EXAMPLE

### Complete Request
```http
POST /api/customer/orders HTTP/1.1
Host: yourapp.com
Content-Type: application/json
x-session-token: abc123xyz789def456ghi012jkl345mno678pqr901stu234vwx567
Cookie: customer_device_id=550e8400-e29b-41d4-a716-446655440000

{
  "items": [
    {
      "productId": "clx1a2b3c4d5e6f7g8h9",
      "quantity": 2,
      "customerNote": "Az şekerli lütfen"
    },
    {
      "productId": "clx9i8u7y6t5r4e3w2q1",
      "quantity": 1,
      "customerNote": null
    }
  ],
  "note": "Hızlı olabilir mi?",
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Success Response (201 Created)
```json
{
  "message": "Sipariş gönderildi. Garson onayı bekleniyor.",
  "status": "PENDING",
  "order": {
    "id": "clx123",
    "businessId": "clx456",
    "tableId": "clx789",
    "tableSessionId": "clx012",
    "customerSessionId": "clx345",
    "totalPrice": 85.50,
    "status": "PENDING",
    "paymentStatus": "UNPAID",
    "note": "Hızlı olabilir mi?",
    "createdAt": "2026-08-26T10:30:00Z",
    "items": [
      {
        "id": "clx678",
        "productId": "clx1a2b3c4d5e6f7g8h9",
        "productName": "Türk Kahvesi",
        "quantity": 2,
        "unitPrice": 35.00,
        "totalPrice": 70.00,
        "customerNote": "Az şekerli lütfen"
      },
      {
        "id": "clx901",
        "productId": "clx9i8u7y6t5r4e3w2q1",
        "productName": "Su",
        "quantity": 1,
        "unitPrice": 15.50,
        "totalPrice": 15.50,
        "customerNote": null
      }
    ],
    "table": {
      "id": "clx789",
      "tableNumber": 5,
      "tableName": "Bahçe 5"
    }
  }
}
```

---

## ❌ ERROR RESPONSES

### 400 Bad Request - Invalid Input
```json
{
  "error": "Geçersiz sipariş bilgileri"
}
```

### 403 Forbidden - No Session
```json
{
  "error": "Aktif müşteri oturumu bulunamadı. Lütfen QR kodu okutun.",
  "code": "NO_SESSION_TOKEN"
}
```

### 403 Forbidden - Session Not Authorized
```json
{
  "error": "Bu masa başka bir aktif oturuma ait veya henüz garson onayı alınmamış.",
  "code": "SESSION_NOT_AUTHORIZED_FOR_TABLE"
}
```

### 403 Forbidden - Device Blocked
```json
{
  "error": "Bu cihazın bu işletmede işlem yapması engellendi.",
  "code": "CUSTOMER_DEVICE_BLOCKED"
}
```

### 404 Not Found - Product Not Found
```json
{
  "error": "Ürün bulunamadı: clx123"
}
```

### 429 Too Many Requests - Rate Limited
```json
{
  "error": "Lütfen 8 saniye bekleyip tekrar deneyin.",
  "code": "RATE_LIMITED"
}
```

### 429 Too Many Requests - Duplicate Order
```json
{
  "error": "Bu siparişi zaten 30 saniye içinde verdiniz. Lütfen bekleyip garsonun onayını kontrol edin."
}
```

### 409 Conflict - Idempotency Key Conflict
```json
{
  "error": "Sipariş oluşturulamadı. Lütfen tekrar deneyin."
}
```

### 500 Internal Server Error
```json
{
  "error": "Sipariş oluşturulurken bir hata oluştu"
}
```

---

## 🔑 HOW TO GET A SESSION TOKEN

### Method 1: QR Code Flow (Production)

**Step 1**: Customer scans QR code
```
QR Code URL: https://yourapp.com/qr/[qrToken]
```

**Step 2**: Backend validates QR and creates session
```typescript
// GET /api/qr/[qrToken]
const qrCode = await prisma.qRCode.findUnique({
  where: { token: qrToken }
});

// Create customer session
const session = await prisma.customerSession.create({
  data: {
    businessId: qrCode.businessId,
    tableId: qrCode.tableId,
    sessionToken: hashedToken,
    status: "ACTIVE",
    authorizationStatus: "PENDING", // Needs waiter approval
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
  }
});

// Return raw token to frontend
return { sessionToken: rawToken };
```

**Step 3**: Frontend stores token
```typescript
// Store in memory or localStorage
localStorage.setItem("session_token", sessionToken);

// Send with every request
fetch("/api/customer/orders", {
  method: "POST",
  headers: {
    "x-session-token": sessionToken,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(orderData),
});
```

---

### Method 2: Demo Business (Development)

**Direct Menu Access**:
```
URL: /menu/demo-business-id/1
```

**Demo Session Creation**:
```typescript
// For demo business, session may be auto-created or pre-seeded
// Check if demo session exists in database:
const demoSession = await prisma.customerSession.findFirst({
  where: {
    businessId: "demo-business-id",
    tableId: "demo-table-1",
    status: "ACTIVE",
  }
});

// Use demo session token in requests
```

---

## 🛡️ SECURITY BEST PRACTICES

### For Frontend Developers

1. **Never Expose Session Tokens**
   - Don't log tokens to console
   - Don't commit tokens to git
   - Don't share tokens between users

2. **Store Tokens Securely**
   - Use memory storage for short sessions
   - Use localStorage with caution (XSS risk)
   - Clear tokens on session end

3. **Handle Errors Gracefully**
   - Check for 403 errors → prompt to scan QR again
   - Check for 429 errors → show cooldown timer
   - Check for 404 errors → remove item from cart

4. **Use Idempotency Keys**
   - Generate UUID v4 for each order
   - Store key with order in frontend state
   - Retry with same key if network fails

### For Backend Developers

1. **Always Hash Tokens**
   - Never store raw tokens in database
   - Use SHA-256 for hashing
   - Use constant-time comparison

2. **Validate Tenant Isolation**
   - Always check `businessId` matches
   - Always check `customerSessionId` matches
   - Never trust client-provided IDs

3. **Rate Limit Everything**
   - Order creation: 1 per 10 seconds
   - Payment requests: 1 per 30 seconds
   - Service requests: 1 per 10 seconds

4. **Log Security Events**
   - Log device blocks
   - Log rate limit hits
   - Log authorization failures
   - Never log tokens or PII

---

## 📊 SESSION LIFECYCLE

```
1. QR Scan
   └─> Customer scans QR code at table
       
2. Session Creation
   └─> Backend creates CustomerSession
       └─> Status: ACTIVE
       └─> Authorization: PENDING (needs waiter approval)
       
3. Waiter Approval
   └─> Waiter approves table access
       └─> Authorization: AUTHORIZED
       └─> Links to active TableSession
       
4. Customer Orders
   └─> Customer places orders
       └─> Validated with session token
       └─> Rate limited
       └─> Device checked
       
5. Session End
   └─> Customer requests bill or waiter closes table
       └─> Status: CLOSED
       └─> Authorization: REVOKED
       └─> Further requests rejected
```

---

## 🔍 DEBUGGING TIPS

### Check Session Token in Database
```sql
-- Find session by token (you need to hash it first)
SELECT * FROM "CustomerSession" 
WHERE "sessionToken" = '[hashed_token]';

-- Find active sessions for a table
SELECT * FROM "CustomerSession" 
WHERE "tableId" = 'clx123' 
AND status = 'ACTIVE';

-- Find authorized sessions
SELECT * FROM "CustomerSession" 
WHERE "authorizationStatus" = 'AUTHORIZED'
AND status = 'ACTIVE';
```

### Check Device Blocks
```sql
SELECT * FROM "CustomerAccessBlock" 
WHERE "businessId" = 'clx456' 
AND "deviceKeyHash" = '[hashed_device_key]'
AND "isActive" = true;
```

### Check Rate Limits
- Rate limits stored in memory (not in database)
- Check application logs for rate limit hits

---

## 📞 RELATED ENDPOINTS

### Customer Endpoints (Session Token Required)
- `POST /api/customer/orders` - Place order
- `GET /api/customer/orders` - Get customer's orders
- `POST /api/customer/service-requests` - Request service (waiter, cleaning, bill)
- `POST /api/customer/payment-requests` - Request to pay bill
- `GET /api/customer/session` - Get session details
- `GET /api/customer/session/status` - Check authorization status
- `GET /api/customer/active-requests` - Get pending requests

### Public Endpoints (No Auth)
- `GET /api/qr/[qrToken]` - Validate QR and create session
- `GET /api/menu/[businessId]/[tableNumber]` - Get menu (for demo)
- `GET /api/business/[slug]` - Get business info

---

## ✅ SUMMARY

**Authentication Type**: Session Token (SHA-256 hashed)  
**Header**: `x-session-token: [raw_token]`  
**Cookie**: `customer_device_id: [device_uuid]`  
**Authorization**: Must be AUTHORIZED by waiter  
**Rate Limit**: 1 order per 10 seconds  
**Tenant Isolation**: businessId + customerSessionId  
**Security Layers**: 8 (session, device, rate, idempotency, spam, business, product, input)

**NOT an API Key System** ❌  
**Session-Based Authentication** ✅  
**QR Code Flow** ✅  
**Multi-Layer Security** ✅  
**Production Ready** ✅

---

**Documentation Updated**: 2026-08-26  
**Version**: 1.0  
**Endpoint**: `/api/customer/orders`  
**Status**: Production

