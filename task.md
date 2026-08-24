# Audit Kalan Maddeler — Görev Takip

## Faz A — P0-09: API Endpoint Tam Denetimi
- [x] Tüm API route'larını enumerate et
- [x] Her endpoint için auth/tenant kontrolü tablosu oluştur
- [x] Eksik auth guard'ları ekle (/api/tables, /api/tables/[tableId], /api/orders, /api/orders/[orderId], /api/diagnostics/schema)
- [x] businessId body'den alınan endpointleri session'dan alacak şekilde düzelt
- [x] IDOR ownership check ekle

## Faz B — Audit Log Sistemi
- [x] AuditLog Prisma modeli kontrol et/oluştur
- [x] Audit log servis fonksiyonu oluştur (redaction & HMAC IP hashing)
- [x] Kritik işlemlere audit log entegre et (sipariş iptal/red, ödeme onay/red, masa zorla kapatma, cihaz engel/kaldırma, garson davet, kayıt)

## Faz C — Test Altyapısı
- [x] Test runner kurulumu (tsx scripts/test-tenant-isolation.ts)
- [x] Test fixture & güvenlik testleri (16 test: HMAC, Zod SQLi/XSS, decimal price, order validation)
- [x] CI/CD workflow entegrasyonu (npm test in security.yml)

## Faz D — Database Constraint & Transaction
- [x] Prisma schema unique constraint kontrolü (@unique on idempotencyKey, tableSessionId, etc.)
- [x] Para alanları Decimal(10,2) kontrolü
- [x] Transaction eksikleri kontrolü (order cancellation, payment processing, force close)

## Faz E — Observability & Health Check
- [x] /api/health endpoint kontrolü (DB latency, uptime, memory RSS/heap)
- [x] Request ID middleware (x-request-id header propagation)
- [x] Structured logging helper

## Faz F — CSP Enforcement Plan
- [x] CSP report-only analizi ve next.config.mjs yapılandırması
- [x] Enforcement geçiş planı

## Faz G — Frontend State Consistency
- [x] Kritik butonlarda loading/disabled state (submitting guard, Loader2)
- [x] Idempotency anahtarları entegrasyonu (ord_uuid, req_uuid, pay_uuid)

## Faz H — Subscription Security
- [x] Backend plan limit enforcement (subscription-guard.service.ts)
- [x] maxTables, maxProducts, maxWaiters limitleri kontrolü
- [x] Expired subscription / trial kontrolü

## Faz I — Son Rapor
- [x] PRODUCTION_READINESS_REPORT.md
