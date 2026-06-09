# ✅ TEST CHECKLIST - First Order Bug Fix

## 📋 Overview

This document provides a comprehensive checklist for testing the first order bug fix.

**Fix Date**: June 10, 2026  
**Version**: v1.1.0 + Security Patch  
**Priority**: HIGH (Critical Bug Fix)

---

## 🎯 CRITICAL TEST: First Order (MUST PASS)

### Test Case 1.1: First Order on EMPTY Table

**Preconditions:**
- Table status: EMPTY
- No active CustomerSession for this table
- Business is active

**Steps:**
1. Open mobile browser or Chrome DevTools mobile mode
2. Scan QR code (or navigate to `/menu/{businessId}/{tableNumber}`)
3. Wait for menu to load
4. Verify session token created:
   ```javascript
   // In browser console:
   sessionStorage.getItem("qr_session_token")
   // Should return a token
   ```
5. Add 2-3 products to cart
6. Add optional order note
7. Click "Siparişi Gönder" (Place Order)
8. Open Network tab and verify request:
   ```
   POST /api/customer/orders
   Headers:
     x-session-token: <token>
   Body:
     { businessId, tableId, items, note }
   ```

**Expected Results:**
- ✅ Request status: 201 Created
- ✅ Response: `{ message: "Sipariş gönderildi...", order: {...} }`
- ✅ Toast message: "Siparişiniz gönderildi! Garson onayı bekleniyor..."
- ✅ Cart cleared
- ✅ Order appears in waiter panel
- ✅ Table status changed to OCCUPIED
- ✅ TableSession created
- ✅ Bill created

**Actual Results:**
- [ ] PASS / [ ] FAIL

**Notes:**
_____________________________________

---

## 🔒 SECURITY TESTS (MUST PASS)

### Test Case 2.1: Old Session Token After Table Close

**Preconditions:**
- Table was occupied and payment was collected
- CustomerSession was closed
- Old session token saved somewhere

**Steps:**
1. Save session token before closing table:
   ```javascript
   const oldToken = sessionStorage.getItem("qr_session_token");
   localStorage.setItem("test_old_token", oldToken);
   ```
2. Complete order and payment flow
3. Waiter closes table
4. Try to place order with old token:
   ```javascript
   fetch("/api/customer/orders", {
     method: "POST",
     headers: {
       "Content-Type": "application/json",
       "x-session-token": localStorage.getItem("test_old_token")
     },
     body: JSON.stringify({...orderData})
   })
   ```

**Expected Results:**
- ✅ Request status: 403 Forbidden
- ✅ Response: `{ error: "Müşteri oturumu aktif değil..." }`
- ✅ Order NOT created
- ✅ Table status: EMPTY
- ✅ No notification sent to waiter

**Actual Results:**
- [ ] PASS / [ ] FAIL

**Notes:**
_____________________________________

---

### Test Case 2.2: Expired Session Token

**Preconditions:**
- CustomerSession created
- Session expiration time passed

**Steps:**
1. Create session
2. Manually set expiration in database (optional):
   ```sql
   UPDATE CustomerSession 
   SET expiresAt = NOW() - INTERVAL 1 HOUR
   WHERE sessionToken = 'token';
   ```
3. Try to place order

**Expected Results:**
- ✅ Request status: 403 Forbidden
- ✅ Response: `{ error: "Müşteri oturumunun süresi dolmuş..." }`
- ✅ Session status automatically updated to EXPIRED
- ✅ closedAt timestamp set

**Actual Results:**
- [ ] PASS / [ ] FAIL

**Notes:**
_____________________________________

---

### Test Case 2.3: No Session Token

**Steps:**
1. Clear sessionStorage
2. Try to place order without x-session-token header

**Expected Results:**
- ✅ Request status: 403 Forbidden
- ✅ Response: `{ error: "Aktif müşteri oturumu bulunamadı..." }`

**Actual Results:**
- [ ] PASS / [ ] FAIL

**Notes:**
_____________________________________

---

### Test Case 2.4: Wrong Table ID

**Steps:**
1. Create session for Table A
2. Try to order for Table B using Table A's token

**Expected Results:**
- ✅ Request status: 403 Forbidden
- ✅ Response: `{ error: "Oturum bu masa veya işletme için geçerli değil." }`

**Actual Results:**
- [ ] PASS / [ ] FAIL

**Notes:**
_____________________________________

---

## ⏱️ RATE LIMITING TESTS

### Test Case 3.1: Order Rate Limit (10 seconds)

**Steps:**
1. Place first order → should succeed
2. Immediately place second order (< 10s) → should fail
3. Wait 10 seconds
4. Place third order → should succeed

**Expected Results:**
- ✅ First order: 201 Created
- ✅ Second order: 429 Too Many Requests
- ✅ Message: "Lütfen X saniye bekleyip tekrar deneyin"
- ✅ Third order: 201 Created

**Actual Results:**
- [ ] PASS / [ ] FAIL

**Notes:**
_____________________________________

---

### Test Case 3.2: Service Request Rate Limit (60 seconds)

**Steps:**
1. Call waiter → should succeed
2. Immediately call waiter again (< 60s) → should fail
3. Wait 60 seconds
4. Call waiter again → should succeed

**Expected Results:**
- ✅ First request: 201 Created
- ✅ Second request: 429 Too Many Requests
- ✅ Third request: 201 Created

**Actual Results:**
- [ ] PASS / [ ] FAIL

**Notes:**
_____________________________________

---

### Test Case 3.3: Payment Request Rate Limit (60 seconds)

**Steps:**
1. Request payment → should succeed
2. Cancel and immediately request again (< 60s) → should fail
3. Wait 60 seconds
4. Request payment again → should succeed

**Expected Results:**
- ✅ First request: 201 Created
- ✅ Second request: 429 Too Many Requests
- ✅ Third request: 201 Created

**Actual Results:**
- [ ] PASS / [ ] FAIL

**Notes:**
_____________________________________

---

## 🚫 SPAM PROTECTION TESTS

### Test Case 4.1: Duplicate Waiter Call

**Steps:**
1. Call waiter (type: CALL_WAITER) → should succeed
2. Immediately call waiter again → should fail
3. Waiter completes the request
4. Call waiter again → should succeed

**Expected Results:**
- ✅ First call: 201 Created, ServiceRequest status: PENDING
- ✅ Second call: 409 Conflict
- ✅ Message: "Bu masa için zaten bekleyen bir garson çağrısı var"
- ✅ After completion: 201 Created

**Actual Results:**
- [ ] PASS / [ ] FAIL

**Notes:**
_____________________________________

---

### Test Case 4.2: Duplicate Payment Request

**Steps:**
1. Request payment → should succeed
2. Request payment again → should fail
3. Waiter completes payment
4. Request payment again → should succeed (new session)

**Expected Results:**
- ✅ First request: 201 Created
- ✅ Second request: 409 Conflict
- ✅ After completion: New session, new request possible

**Actual Results:**
- [ ] PASS / [ ] FAIL

**Notes:**
_____________________________________

---

## 💳 PAYMENT REQUEST TESTS

### Test Case 5.1: Payment Request on EMPTY Table

**Preconditions:**
- Table status: EMPTY
- CustomerSession: ACTIVE
- No orders placed

**Steps:**
1. Scan QR code
2. Try to request payment without placing order

**Expected Results:**
- ✅ Request status: 400 Bad Request
- ✅ Response: `{ error: "Ödeme talebi göndermek için önce sipariş vermeniz gerekir." }`

**Actual Results:**
- [ ] PASS / [ ] FAIL

**Notes:**
_____________________________________

---

### Test Case 5.2: Payment Request on OCCUPIED Table

**Preconditions:**
- Table status: OCCUPIED (orders exist)
- CustomerSession: ACTIVE
- Bill exists and is OPEN

**Steps:**
1. Place order
2. Request payment

**Expected Results:**
- ✅ Request status: 201 Created
- ✅ Payment record created
- ✅ ServiceRequest created (type: PAYMENT_REQUEST)
- ✅ Table status changed to PAYMENT_REQUESTED
- ✅ Waiter receives notification

**Actual Results:**
- [ ] PASS / [ ] FAIL

**Notes:**
_____________________________________

---

## 🔄 COMPLETE FLOW TEST

### Test Case 6.1: End-to-End Customer Journey

**Steps:**
1. **Scan QR** → Session created, table stays EMPTY
2. **Browse Menu** → Categories and products display
3. **Add to Cart** → Cart updates correctly
4. **Place First Order** → Order created, table becomes OCCUPIED
5. **Wait for Waiter Approval** → Waiter approves order
6. **Place Second Order** → Additional order created, bill updated
7. **Call Waiter** → ServiceRequest created
8. **Request Payment** → Payment request created
9. **Waiter Collects Payment** → Session closed, table becomes EMPTY
10. **Try Old Token** → Rejected (403)

**Expected Results:**
- ✅ All steps complete without errors
- ✅ Table lifecycle correct: EMPTY → OCCUPIED → PAYMENT_REQUESTED → EMPTY
- ✅ Session lifecycle correct: ACTIVE → CLOSED
- ✅ Old token rejected after close

**Actual Results:**
- [ ] PASS / [ ] FAIL

**Notes:**
_____________________________________

---

## 🌐 FRONTEND INTEGRATION TESTS

### Test Case 7.1: Session Token Storage

**Steps:**
1. Scan QR
2. Check sessionStorage:
   ```javascript
   sessionStorage.getItem("qr_session_token")
   ```

**Expected Results:**
- ✅ Token exists
- ✅ Token is a valid string
- ✅ Token persists across page navigation

**Actual Results:**
- [ ] PASS / [ ] FAIL

**Notes:**
_____________________________________

---

### Test Case 7.2: Request Headers

**Steps:**
1. Place order
2. Check Network tab for request headers

**Expected Results:**
- ✅ Header present: `x-session-token: <token>`
- ✅ Header value matches sessionStorage value

**Actual Results:**
- [ ] PASS / [ ] FAIL

**Notes:**
_____________________________________

---

### Test Case 7.3: Error Message Display

**Steps:**
1. Trigger various errors (expired session, rate limit, spam, etc.)
2. Verify error messages display correctly

**Expected Results:**
- ✅ Toast notifications appear
- ✅ Messages are user-friendly in Turkish
- ✅ No console errors
- ✅ UI remains functional

**Actual Results:**
- [ ] PASS / [ ] FAIL

**Notes:**
_____________________________________

---

## 🗄️ DATABASE INTEGRITY TESTS

### Test Case 8.1: Transaction Rollback

**Steps:**
1. Manually cause a transaction failure (e.g., invalid product ID in order)
2. Verify no partial data created

**Expected Results:**
- ✅ Order NOT created
- ✅ OrderItems NOT created
- ✅ Bill NOT updated
- ✅ Table status unchanged
- ✅ Database consistent

**Actual Results:**
- [ ] PASS / [ ] FAIL

**Notes:**
_____________________________________

---

### Test Case 8.2: Session Closing on Payment

**Steps:**
1. Complete payment flow
2. Check database:
   ```sql
   SELECT status, closedAt 
   FROM CustomerSession 
   WHERE tableId = 'table-id';
   ```

**Expected Results:**
- ✅ CustomerSession.status = CLOSED
- ✅ CustomerSession.closedAt is set
- ✅ TableSession.status = CLOSED
- ✅ Bill.status = PAID

**Actual Results:**
- [ ] PASS / [ ] FAIL

**Notes:**
_____________________________________

---

## 📱 MOBILE DEVICE TESTS

### Test Case 9.1: iOS Safari

- [ ] QR scan works
- [ ] Session created
- [ ] First order works
- [ ] All features functional

**Notes:**
_____________________________________

---

### Test Case 9.2: Android Chrome

- [ ] QR scan works
- [ ] Session created
- [ ] First order works
- [ ] All features functional

**Notes:**
_____________________________________

---

### Test Case 9.3: Various Screen Sizes

- [ ] Small phone (320px)
- [ ] Standard phone (375px)
- [ ] Large phone (414px)
- [ ] Tablet (768px)

**Notes:**
_____________________________________

---

## 🔧 PERFORMANCE TESTS

### Test Case 10.1: Multiple Concurrent Orders

**Steps:**
1. 5 different tables place orders simultaneously
2. Verify all orders processed correctly

**Expected Results:**
- ✅ All orders created
- ✅ No race conditions
- ✅ Transactions maintain integrity
- ✅ Response time < 2s per order

**Actual Results:**
- [ ] PASS / [ ] FAIL

**Notes:**
_____________________________________

---

## 📊 TEST SUMMARY

### Results Overview

| Category | Tests | Passed | Failed | Notes |
|----------|-------|--------|--------|-------|
| Critical (First Order) | 1 | | | |
| Security | 4 | | | |
| Rate Limiting | 3 | | | |
| SPAM Protection | 2 | | | |
| Payment | 2 | | | |
| Complete Flow | 1 | | | |
| Frontend | 3 | | | |
| Database | 2 | | | |
| Mobile | 3 | | | |
| Performance | 1 | | | |
| **TOTAL** | **22** | | | |

---

## ✅ SIGN-OFF

### Test Execution

**Tested By**: _________________________  
**Date**: _________________________  
**Environment**: _________________________  
**Build Version**: v1.1.0 + Security Patch  

### Approval

**Status**: [ ] APPROVED / [ ] REJECTED  
**Approved By**: _________________________  
**Date**: _________________________  

**Comments:**
_____________________________________________
_____________________________________________
_____________________________________________

---

## 🚀 DEPLOYMENT CHECKLIST

After all tests pass:

- [ ] Database backup completed
- [ ] Environment variables verified
- [ ] Migration applied (if needed)
- [ ] Staging deployment tested
- [ ] Production deployment scheduled
- [ ] Rollback plan prepared
- [ ] Monitoring alerts configured
- [ ] Team notified

---

**Document Version**: 1.0  
**Last Updated**: June 10, 2026  
**Status**: Ready for Testing
