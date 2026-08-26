# 📋 `/api/customer/orders` API Documentation

## 🔐 Authentication & Authorization

### Required Header
```
x-session-token: <raw_session_token>
```

**What is this token?**
- A secure, hashed customer session token created when a customer scans a QR code
- Each QR code at a table generates a unique session token
- The token is SHA-256 hashed before database lookup for security

### Authentication Flow

```
Customer scans QR → Creates CustomerSession → Gets sessionToken → Use in API calls
```

### Authorization Levels

This endpoint requires **AUTHORIZED** customer session status:

| Status | Can View Menu? | Can Order? | Notes |
|--------|---------------|------------|-------|
| `VIEW_ONLY` | ✅ Yes | ❌ No | Customer can browse menu but not order |
| `PENDING` | ✅ Yes | ❌ No | Waiting for waiter approval |
| `AUTHORIZED` | ✅ Yes | ✅ Yes | Full access - can create orders |
| `REVOKED` | ❌ No | ❌ No | Session blocked by staff |
| `EXPIRED` | ❌ No | ❌ No | Session time limit reached |

### Validation Chain

The endpoint performs these security checks **in order**:

1. ✅ **Session Token Validation**
   - Header `x-session-token` must be present
   - Token must exist in database (hashed lookup)
   - Returns `403` if missing or invalid

2. ✅ **Device Block Check**
   - Checks if the device has been blocked by admin
   - Uses `customer_device_id` cookie or stored `deviceKeyHash`
   - Returns `403` if device is blocked

3. ✅ **Business Status Check**
   - Business must have `isActive = true`
   - Returns `403` if business is inactive

4. ✅ **Session Status Check**
   - CustomerSession.status must be `ACTIVE`
   - Not `CLOSED`, `REVOKED`, or `EXPIRED`
   - Returns `403` if inactive

5. ✅ **Session Expiry Check**
   - `expiresAt` must be in the future
   - Auto-closes expired sessions
   - Returns `403` if expired

6. ✅ **Table Status Check**
   - Table must exist, not deleted, and active
   - Returns `403` if table is inactive

7. ✅ **Authorization Status Check**
   - `authorizationStatus` must be `AUTHORIZED`
   - Not `PENDING`, `VIEW_ONLY`, or `REVOKED`
   - Returns `403` if not authorized

8. ✅ **Table Session Link Check**
   - `tableSessionId` must be set
   - Linked TableSession must be `ACTIVE`
   - TableSession must match same table/business
   - Returns `403` if session link is broken

---

## 📝 API Endpoint Specification

### Endpoint
```
POST /api/customer/orders
```

### Request Headers
```http
Content-Type: application/json
x-session-token: <customer_session_token>
Cookie: customer_device_id=<device_id> (optional, for device tracking)
```

### Request Body
```typescript
{
  items: Array<{
    productId: string;           // Product UUID
    quantity: number;            // Integer 1-100
    customerNote?: string;       // Optional, max 200 chars
  }>;
  note?: string;                 // Optional order note, max 500 chars
  idempotencyKey?: string;       // Optional, 8-128 chars, prevents duplicates
}
```

### Response (Success - 201)
```typescript
{
  message: "Sipariş gönderildi. Garson onayı bekleniyor.",
  order: {
    id: string;
    businessId: string;
    tableId: string;
    tableSessionId: string;
    customerSessionId: string;
    totalPrice: number;
    status: "PENDING";           // Waiter approval required
    paymentStatus: "UNPAID";
    note: string | null;
    idempotencyKey: string | null;
    createdAt: string;
    items: Array<{
      id: string;
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      customerNote: string | null;
      product: {
        id: string;
        name: string;
        price: number;
        // ... other product fields
      };
    }>;
    table: {
      id: string;
      tableNumber: string;
      tableName: string | null;
      // ... other table fields
    };
  },
  status: "PENDING"
}
```

---

## 🛡️ Security Features

### 1. Rate Limiting
- **Limit**: 1 order every 10 seconds per session
- **Scope**: Per `x-session-token`
- **Response**: `429 Too Many Requests`
- **Error Message**: `"Lütfen {X} saniye bekleyip tekrar deneyin."`

### 2. Idempotency Protection
- Optional `idempotencyKey` prevents duplicate orders
- Scoped to: `businessId + customerSessionId + idempotencyKey`
- Returns existing order if duplicate detected (200 OK)
- **Format**: 8-128 character string
- **Use Case**: Prevent double-submission on slow networks

### 3. Spam Prevention
- Checks for identical orders in last 30 seconds
- Compares: same products + same quantities
- **Response**: `429` with message
- **Scope**: Same table, same session, same products

### 4. Input Validation

#### Items Array
- ❌ Empty array → `400 Bad Request`
- ❌ More than 50 items → `400` "Maksimum 50 farklı ürün"
- ✅ Must contain at least 1 item

#### Quantity
- ✅ Must be integer between 1-100
- ❌ Non-integer, zero, negative, or >100 → `400`

#### Product Validation
- ✅ Product must exist in database
- ✅ Product must belong to same business
- ✅ Product must not be deleted
- ✅ Product must be available (`isAvailable = true`)
- ✅ Product must be in stock (`stockStatus = IN_STOCK`)
- ❌ Invalid product → `404` or `400`

#### Price Validation
- ✅ Server-side price lookup (client price ignored)
- ✅ Total order price must be < 1,000,000
- ✅ Price must be non-negative and finite

#### Notes
- Order note: max 500 characters
- Item customer note: max 200 characters per item

---

## 🔄 Business Logic Flow

### Order Creation Process

```
1. Validate session → AUTHORIZED
2. Check rate limit → 10s cooldown
3. Check idempotency → duplicate protection
4. Check spam → 30s duplicate order detection
5. Validate business status → isActive
6. Validate products → exist, available, in-stock, correct business
7. Calculate server-side total price
8. START TRANSACTION:
   a. Find or verify open Bill for tableSession
   b. Create Order with status=PENDING
   c. Create OrderItems
   d. Update Bill totalAmount and remainingAmount
   e. Update Table status → HAS_ORDER
   f. Create Notification (NEW_ORDER)
9. COMMIT TRANSACTION
10. Emit Socket.IO event → real-time notification to staff
11. Return 201 Created
```

### Status Transitions

```
Order Created → PENDING (waiter approval required)
              ↓
         ACCEPTED (waiter approved)
              ↓
        COMPLETED (served)

Or:
         PENDING
              ↓
         REJECTED (waiter rejected)
              ↓
         CANCELLED (system cancelled)
```

---

## ❌ Error Responses

### 400 Bad Request
```json
{
  "error": "Geçersiz sipariş bilgileri"
}
```

**Causes**:
- Empty items array
- Invalid quantity (not 1-100 integer)
- Invalid productId format
- Note too long (>500 chars)
- Customer note too long (>200 chars)
- Product not available or out of stock
- More than 50 items
- Total price > 1,000,000
- Invalid idempotency key format

### 403 Forbidden
```json
{
  "error": "Bu masa başka bir aktif oturuma ait veya henüz garson onayı alınmamış.",
  "code": "SESSION_NOT_AUTHORIZED_FOR_TABLE"
}
```

**Causes**:
- No `x-session-token` header → `NO_SESSION_TOKEN`
- Session not found → `SESSION_NOT_FOUND`
- Device blocked → `CUSTOMER_DEVICE_BLOCKED`
- Business inactive → `BUSINESS_INACTIVE`
- Session revoked → `SESSION_REVOKED`
- Session not active → `SESSION_INACTIVE`
- Session expired → `SESSION_EXPIRED`
- Table inactive → `TABLE_INACTIVE`
- Not authorized status → `SESSION_NOT_AUTHORIZED_FOR_TABLE`
- Product from different business

### 404 Not Found
```json
{
  "error": "Ürün bulunamadı: {productId}"
}
```

**Causes**:
- Product doesn't exist or is deleted

### 409 Conflict
```json
{
  "error": "Sipariş oluşturulamadı. Lütfen tekrar deneyin."
}
```

**Causes**:
- Idempotency key collision (rare edge case)

### 429 Too Many Requests
```json
{
  "error": "Lütfen 8 saniye bekleyip tekrar deneyin.",
  "code": "RATE_LIMITED"
}
```

**Causes**:
- Rate limit: >1 order in 10 seconds
- Spam detection: identical order in last 30 seconds

### 500 Internal Server Error
```json
{
  "error": "Sipariş oluşturulurken bir hata oluştu"
}
```

**Causes**:
- Database error
- Transaction failure
- Invalid product price data
- Missing bill for table session

---

## 📊 Related API Endpoints

| Endpoint | Purpose | Auth Required |
|----------|---------|---------------|
| `POST /api/customer/session/start` | Create customer session (scan QR) | None |
| `POST /api/customer/session/request-access` | Request table authorization | x-session-token (VIEW_ONLY ok) |
| `GET /api/customer/menu` | Get menu items | x-session-token (VIEW_ONLY ok) |
| `POST /api/customer/orders` | Create order | x-session-token (AUTHORIZED only) |
| `POST /api/customer/service-request` | Call waiter, request payment | x-session-token (AUTHORIZED only) |

---

## 🔧 How to Obtain Session Token

### Step 1: Customer Scans QR Code
Each table has a unique QR code containing:
```
https://{domain}/menu/{businessId}/{tableNumber}?token={qrToken}
```

### Step 2: Frontend Calls Session Start
```http
POST /api/customer/session/start
Content-Type: application/json

{
  "qrToken": "token_from_qr_code"
}
```

### Step 3: Receive Session Token
```json
{
  "sessionToken": "abc123...",
  "customerSession": { ... },
  "authorizationStatus": "PENDING" | "VIEW_ONLY" | "AUTHORIZED"
}
```

### Step 4: Store Token and Use in API Calls
```javascript
// Store token
localStorage.setItem('customer_session_token', sessionToken);

// Use in API calls
fetch('/api/customer/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-session-token': sessionToken
  },
  body: JSON.stringify({ items: [...] })
});
```

---

## 💡 Usage Examples

### Example 1: Simple Order
```javascript
const response = await fetch('/api/customer/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-session-token': 'your_session_token_here'
  },
  body: JSON.stringify({
    items: [
      {
        productId: 'product-uuid-1',
        quantity: 2
      },
      {
        productId: 'product-uuid-2',
        quantity: 1,
        customerNote: 'Az şekerli lütfen'
      }
    ],
    note: 'Acil sipariş'
  })
});

const data = await response.json();
console.log(data.order.id); // Order created
```

### Example 2: Order with Idempotency
```javascript
const idempotencyKey = crypto.randomUUID(); // Generate once per order attempt

const response = await fetch('/api/customer/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-session-token': 'your_session_token_here'
  },
  body: JSON.stringify({
    items: [
      { productId: 'prod-1', quantity: 3 }
    ],
    idempotencyKey: idempotencyKey
  })
});

// If network fails and you retry with same idempotencyKey,
// you'll get the same order back (no duplicate)
```

### Example 3: Error Handling
```javascript
async function createOrder(sessionToken, items) {
  try {
    const response = await fetch('/api/customer/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': sessionToken
      },
      body: JSON.stringify({ items })
    });

    const data = await response.json();

    if (!response.ok) {
      switch (response.status) {
        case 400:
          console.error('Invalid order data:', data.error);
          break;
        case 403:
          console.error('Not authorized:', data.error, data.code);
          if (data.code === 'SESSION_NOT_AUTHORIZED_FOR_TABLE') {
            // Redirect to request access page
            window.location.href = '/request-access';
          }
          break;
        case 429:
          console.error('Rate limited or spam:', data.error);
          // Show countdown timer
          break;
        default:
          console.error('Order failed:', data.error);
      }
      return null;
    }

    return data.order;
  } catch (error) {
    console.error('Network error:', error);
    return null;
  }
}
```

---

## 🔔 Real-time Notifications

After order creation, the system emits a Socket.IO event:

### Event Name
```
new_order
```

### Event Data
```typescript
{
  orderId: string;
  tableNumber: string;
  tableName: string | null;
  message: string;
  soundType: "new_order";
  totalPrice: number;
  itemCount: number;
  status: "PENDING";
  createdAt: Date;
}
```

### Room
- Emitted to: `business:{businessId}`
- Recipients: All connected admin/waiter clients for that business

---

## 🧪 Testing the Endpoint

### Using curl
```bash
curl -X POST https://qr-menu-product.onrender.com/api/customer/orders \
  -H "Content-Type: application/json" \
  -H "x-session-token: YOUR_SESSION_TOKEN" \
  -d '{
    "items": [
      {
        "productId": "PRODUCT_UUID",
        "quantity": 2
      }
    ],
    "note": "Test order"
  }'
```

### Using Postman
1. Set method to `POST`
2. URL: `https://qr-menu-product.onrender.com/api/customer/orders`
3. Headers:
   - `Content-Type: application/json`
   - `x-session-token: YOUR_SESSION_TOKEN`
4. Body (raw JSON):
```json
{
  "items": [
    {
      "productId": "uuid-here",
      "quantity": 1
    }
  ]
}
```

---

## 🔍 Troubleshooting

### "Aktif müşteri oturumu bulunamadı"
- ❌ Missing `x-session-token` header
- ✅ Add header with valid session token

### "Bu masa başka bir aktif oturuma ait"
- ❌ Session status is `PENDING` or `VIEW_ONLY`
- ✅ Customer needs waiter approval first
- ✅ Call `POST /api/customer/service-request` with `type: "ACCESS_REQUEST"`

### "Bu cihazın bu işletmede işlem yapması engellendi"
- ❌ Device has been blocked by admin
- ✅ Contact restaurant staff to unblock

### "Sipariş oluşturulurken bir hata oluştu"
- ❌ Server error or database issue
- ✅ Check server logs
- ✅ Verify all products exist and belong to correct business

---

## 📚 See Also

- [API Authentication Guide](./API_AUTHENTICATION_GUIDE.md)
- [Security Audit Findings](./SECURITY_AUDIT_INITIAL_FINDINGS.md)
- [Customer Session Flow](./E2E_ROUND2_STATUS.md)

---

**Last Updated**: 2026-08-26  
**API Version**: v1  
**Endpoint Status**: ✅ Production Ready
