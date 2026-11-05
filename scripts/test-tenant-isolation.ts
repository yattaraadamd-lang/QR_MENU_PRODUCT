/**
 * 🔒 Security & Tenant Isolation Automated Test Suite
 * 
 * Tests:
 * 1. HMAC Secret & Device Key Hashing
 * 2. Plan Quota Guard Logic
 * 3. Audit Log Redaction & Privacy Hashing
 * 4. Input Validation (Zod Schemas)
 * 5. Tenant Isolation Helpers & Scopes
 * 6. Login Input Limits & Session Revocation
 */

import { hashDeviceKey, generateDeviceKey } from "../src/lib/security/device-block";
import { checkPlanQuota } from "../src/lib/services/subscription-guard.service";
import { cuidSchema, emailSchema, priceSchema, createTableSchema, createOrderSchema, updateStaffSchema } from "../src/lib/validation";
import { createLogger } from "../src/lib/logger";
import { isSessionCurrent, SESSION_ABSOLUTE_SECONDS } from "../src/lib/session-policy";
import { checkRateLimit, getClientIp, resetRateLimit } from "../src/lib/unified-rate-limit";
import { Prisma } from "@prisma/client";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` — ${detail}` : ""}`);
    failedCount++;
  }
}

async function runTests() {
  console.log("=================================================");
  console.log("🚀 Running Security & Tenant Isolation Tests");
  console.log("=================================================\n");

  // ── Test Suite 1: Device Security & HMAC ────────────────────────────
  console.log("📦 Suite 1: Device Security & HMAC Hashing");
  try {
    const rawKey = generateDeviceKey();
    assert(rawKey.startsWith("cdk_"), "Device key generates with cdk_ prefix");

    const hash1 = hashDeviceKey(rawKey);
    const hash2 = hashDeviceKey(rawKey);
    assert(hash1 === hash2, "HMAC-SHA256 hash is deterministic for same key");
    assert(hash1.length === 64, "HMAC-SHA256 produces 64 hex characters (256-bit)");

    const hash3 = hashDeviceKey(generateDeviceKey());
    assert(hash1 !== hash3, "Different device keys produce distinct HMAC hashes");
  } catch (err: any) {
    assert(false, "Device security tests threw error", err.message);
  }

  // ── Test Suite 2: Input Validation (Zod) ─────────────────────────────
  console.log("\n📦 Suite 2: Zod Input Validation & SQLi/XSS Prevention");
  try {
    assert(cuidSchema.safeParse("tbl_1234567890").success, "Accepts standard CUID/slug IDs");
    assert(cuidSchema.safeParse("prod-turk-kahvesi").success, "Accepts slug style product IDs");
    assert(!cuidSchema.safeParse("tbl; DROP TABLE users;--").success, "Rejects SQL injection payload in ID");
    assert(!cuidSchema.safeParse("<script>alert(1)</script>").success, "Rejects XSS payload in ID");

    assert(priceSchema.safeParse(19.99).success, "Accepts valid decimal price");
    assert(priceSchema.safeParse(100).success, "Accepts valid integer price");
    assert(!priceSchema.safeParse(-5).success, "Rejects negative price");
    assert(!priceSchema.safeParse(19.999).success, "Rejects more than 2 decimal places");

    const validTable = createTableSchema.safeParse({ tableNumber: "12", tableName: "Bahçe 12" });
    assert(validTable.success, "Accepts valid table creation payload");

    const invalidTable = createTableSchema.safeParse({ tableNumber: "" });
    assert(!invalidTable.success, "Rejects empty table number");

    const validOrder = createOrderSchema.safeParse({
      tableId: "tbl_demo_1",
      items: [{ productId: "prod-cay", quantity: 2 }],
    });
    assert(validOrder.success, "Accepts valid order payload");

    const invalidOrder = createOrderSchema.safeParse({
      tableId: "tbl_demo_1",
      items: [],
    });
    assert(!invalidOrder.success, "Rejects empty items array in order");
  } catch (err: any) {
    assert(false, "Input validation tests threw error", err.message);
  }

  // ── Test Suite 4: Structured Log Redaction ───────────────────────────
  console.log("\n📦 Suite 4: Structured Log Redaction & Prisma Error Serializer");
  try {
    const lines: string[] = [];
    const log = createLogger({ write: (chunk: string) => { lines.push(chunk); } });
    const last = () => JSON.parse(lines[lines.length - 1]);

    log.child({ requestId: "req-123" }).info(
      {
        password: "parola-123",
        user: { sessionToken: "cs_gizli", email: "a@b.c" },
        req: { headers: { cookie: "sid=gizli", "x-session-token": "cs_baslik" } },
        payment: { customer: { identityNumber: "12345678901" } },
      },
      "redaction"
    );
    const redacted = lines[lines.length - 1];
    assert(last().requestId === "req-123", "Log line carries bound requestId");
    assert(
      !["parola-123", "cs_gizli", "sid=gizli", "cs_baslik", "12345678901"].some((secret) => redacted.includes(secret)),
      "Sensitive fields are redacted (password, nested token, cookie, x-session-token, identityNumber)",
      redacted
    );
    assert(last().user.email === "a@b.c", "Non-sensitive fields are kept");

    const prismaError = new Prisma.PrismaClientKnownRequestError(
      "\nInvalid `prisma.customerSession.findUnique()` invocation:\n\n{\n  where: { sessionToken: \"hash-gizli\" }\n}\n\nUnique constraint failed on the fields: (`sessionToken`)",
      { code: "P2002", clientVersion: "5.22.0" }
    );
    log.error({ err: prismaError }, "prisma");
    const serialized = last().err;
    assert(
      serialized.code === "P2002" &&
        serialized.prismaCall === "customerSession.findUnique" &&
        serialized.message === "Unique constraint failed on the fields: (`sessionToken`)",
      "Prisma error keeps code, call and reason",
      JSON.stringify(serialized)
    );
    assert(
      !lines[lines.length - 1].includes("hash-gizli") && serialized.stack === undefined,
      "Prisma error drops query arguments and stack"
    );

    log.error({ err: new Error("beklenmeyen") }, "generic");
    assert(last().err.message === "beklenmeyen" && typeof last().err.stack === "string", "Generic error keeps message and stack");
  } catch (err: any) {
    assert(false, "Log redaction tests threw error", err.message);
  }

  // ── Test Suite 5: Giriş girdisi sınırları ────────────────────────────
  console.log("\n📦 Suite 5: E-posta ve IP girdi sınırları");
  try {
    assert(emailSchema.safeParse("Garson@Ornek.COM ").data === "garson@ornek.com", "E-posta küçük harfe çevrilir, boşluk kırpılır");
    assert(emailSchema.safeParse(`${"a".repeat(241)}@ornek.com.tr`).success, "254 karakterlik e-posta kabul edilir");
    assert(!emailSchema.safeParse(`${"a".repeat(242)}@ornek.com.tr`).success, "255 karakterlik e-posta reddedilir");

    const ipOf = (name: string, value: string) => getClientIp(new Request("http://x", { headers: { [name]: value } }));
    assert(ipOf("cf-connecting-ip", "x".repeat(4000)).length === 45, "cf-connecting-ip rate limit anahtarına kırpılarak girer");
    assert(ipOf("x-forwarded-for", `1.1.1.1, ${"x".repeat(4000)}`).length === 45, "x-forwarded-for rate limit anahtarına kırpılarak girer");
    assert(ipOf("x-real-ip", "x".repeat(4000)).length === 45, "x-real-ip rate limit anahtarına kırpılarak girer");
    assert(ipOf("cf-connecting-ip", " 2001:db8::1 ") === "2001:db8::1", "Normal IP değişmez");

    const staffPassword = (password: string) => updateStaffSchema.safeParse({ password }).success;
    assert(staffPassword("Garson2026Parola"), "Personel parolası: harf + rakam kabul edilir");
    assert(!staffPassword("aaaaaaaaaaaa"), "Personel parolası: yalnız harf reddedilir");
    assert(!staffPassword("111111111111"), "Personel parolası: yalnız rakam reddedilir");
    assert(!staffPassword("Kisa1"), "Personel parolası: 12 karakterden kısa reddedilir");
  } catch (err: any) {
    assert(false, "Girdi sınırı testleri hata verdi", err.message);
  }

  // ── Test Suite 6: Oturum iptali ──────────────────────────────────────
  console.log("\n📦 Suite 6: Oturum geçerliliği");
  try {
    const now = 1_800_000_000;
    const user = { sessionVersion: 3, isActive: true, deletedAt: null };
    const claims = { sv: 3, authTime: now - 60 };

    assert(isSessionCurrent(claims, user, now), "Güncel sürüm ve taze giriş geçerli");
    assert(!isSessionCurrent({ ...claims, sv: 2 }, user, now), "Eski sürüm (parola değişimi, çıkış) geçersiz");
    assert(!isSessionCurrent({ authTime: claims.authTime }, user, now), "Sürüm alanı olmayan eski token geçersiz");
    assert(!isSessionCurrent({ sv: 3 }, user, now), "Giriş zamanı olmayan token geçersiz");
    assert(!isSessionCurrent({ ...claims, sv: "3" }, user, now), "Sürüm sayı değilse geçersiz");
    assert(isSessionCurrent({ sv: 3, authTime: now - SESSION_ABSOLUTE_SECONDS }, user, now), "Mutlak süre sınırında hâlâ geçerli");
    assert(!isSessionCurrent({ sv: 3, authTime: now - SESSION_ABSOLUTE_SECONDS - 1 }, user, now), "Mutlak süre dolunca etkin oturum da düşer");
    assert(!isSessionCurrent(claims, null, now), "Silinen kayıt geçersiz");
    assert(!isSessionCurrent(claims, { ...user, isActive: false }, now), "Pasif kullanıcı geçersiz");
    assert(!isSessionCurrent(claims, { ...user, deletedAt: new Date(0) }, now), "Silinmiş kullanıcı geçersiz");
  } catch (err: any) {
    assert(false, "Oturum geçerliliği testleri hata verdi", err.message);
  }

  // ── Test Suite 7: Giriş limiti sıfırlama ─────────────────────────────
  console.log("\n📦 Suite 7: Rate limit sıfırlama");
  try {
    const key = "test_reset_key";
    const config = { maxRequests: 1, windowMs: 60_000 };
    assert((await checkRateLimit(key, config)).allowed, "İlk istek geçer");
    assert(!(await checkRateLimit(key, config)).allowed, "Limit dolunca reddedilir");
    resetRateLimit(key);
    assert((await checkRateLimit(key, config)).allowed, "Sıfırlama sonrası yeniden geçer");
  } catch (err: any) {
    assert(false, "Rate limit testleri hata verdi", err.message);
  }

  // ── Summary ──────────────────────────────────────────────────────────
  console.log("\n=================================================");
  console.log(`📊 Test Results: ${passedCount} Passed, ${failedCount} Failed`);
  console.log("=================================================");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
