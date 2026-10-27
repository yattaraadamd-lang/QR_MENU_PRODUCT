/**
 * 🔒 Eşzamanlılık testi — gerçek Postgres ister (CI: Security CI → migrations işi)
 *
 * Tests:
 * 1. Kaybedilen yarış (deterministik): başka bir transaction aktif oturumu eklemiş ama henüz
 *    commit etmemişken openTable çağrılır. İndeks varsa openTable eklemede bekler, P2002 alır
 *    ve kazananın oturumunu döndürür; indeks yoksa ikinci bir oturum açar ve test kırılır.
 * 2. Aynı masaya 20 paralel openTable: hepsi başarılı, tek ACTIVE oturum, tek adisyon
 * 3. Aynı masaya iki paralel bekleyen ORDER_REQUEST: ikincisi P2002 ile reddedilir
 *
 * Kendi işletmesini ve masalarını oluşturur, sonunda siler.
 */

import { prisma } from "../src/lib/prisma";
import { openTable } from "../src/lib/services/table-flow.service";

const RUN_ID = `ci-concurrency-${Date.now()}`;

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function testLostRace(businessId: string, tableId: string) {
  console.log("📦 Suite 1: openTable, commit edilmemiş rakip oturumla yarışı kaybeder");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let markInserted!: () => void;
  const inserted = new Promise<void>((resolve) => (markInserted = resolve));

  const holder = prisma.$transaction(
    async (tx) => {
      const session = await tx.tableSession.create({ data: { businessId, tableId, status: "ACTIVE" } });
      await tx.bill.create({ data: { businessId, tableId, tableSessionId: session.id } });
      markInserted();
      await gate; // commit'i geciktir: rakip bu arada "aktif oturum yok" görür
      return session;
    },
    { timeout: 15_000 }
  );

  await inserted;
  const contender = openTable(tableId, businessId);
  await sleep(500); // rakip findFirst'ü geçip eklemede indekse takılsın
  release();

  const [winner, result] = await Promise.all([holder, contender]);
  const activeSessions = await prisma.tableSession.count({ where: { tableId, status: "ACTIVE" } });

  assert(!result.isNew, "openTable yeni oturum açmadı");
  assert(result.tableSession.id === winner.id, "openTable kazananın oturumunu döndürdü");
  assert(activeSessions === 1, "Masada tek ACTIVE oturum var", `bulunan: ${activeSessions}`);
}

async function runTests(businessId: string, tableId: string) {
  console.log("\n📦 Suite 2: Aynı masaya 20 paralel openTable");
  const results = await Promise.allSettled(
    Array.from({ length: 20 }, () => openTable(tableId, businessId))
  );
  const errors = results.flatMap((r) => (r.status === "rejected" ? [String(r.reason?.message ?? r.reason)] : []));
  const opened = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const activeSessions = await prisma.tableSession.count({ where: { tableId, status: "ACTIVE" } });
  const bills = await prisma.bill.count({ where: { tableId } });

  assert(errors.length === 0, "Hiçbir çağrı hata vermedi", errors.join("; "));
  assert(opened.filter((o) => o.isNew).length === 1, "Yalnız bir çağrı yeni oturum açtı",
    `isNew=true: ${opened.filter((o) => o.isNew).length}`);
  assert(new Set(opened.map((o) => o.tableSession.id)).size === 1, "Tüm çağrılar aynı oturumu döndürdü");
  assert(activeSessions === 1, "Masada tek ACTIVE oturum var", `bulunan: ${activeSessions}`);
  assert(bills === 1, "Tek adisyon oluştu", `bulunan: ${bills}`);

  console.log("\n📦 Suite 3: Aynı masaya iki paralel bekleyen sipariş talebi");
  const attempts = await Promise.allSettled(
    [1, 2].map((n) =>
      prisma.serviceRequest.create({
        data: {
          businessId,
          tableId,
          requestType: "ORDER_REQUEST",
          status: "PENDING",
          idempotencyKey: `${RUN_ID}-${n}`,
        },
      })
    )
  );
  const created = attempts.filter((a) => a.status === "fulfilled").length;
  const uniqueViolations = attempts.filter(
    (a) => a.status === "rejected" && (a.reason as { code?: string })?.code === "P2002"
  ).length;
  assert(created === 1 && uniqueViolations === 1, "İkinci talep P2002 ile reddedildi",
    `oluşan: ${created}, P2002: ${uniqueViolations}`);
}

async function main() {
  console.log("=================================================");
  console.log("🚀 Running Table Concurrency Tests (Postgres)");
  console.log("=================================================\n");

  const business = await prisma.business.create({ data: { name: RUN_ID, slug: RUN_ID } });
  const [raceTable, table] = await Promise.all(
    ["1", "2"].map((tableNumber) => prisma.table.create({ data: { businessId: business.id, tableNumber } }))
  );

  try {
    await testLostRace(business.id, raceTable.id);
    await runTests(business.id, table.id);
  } finally {
    // bills.tableSessionId ve table_sessions.tableId RESTRICT: önce bağımlılar silinir
    await prisma.bill.deleteMany({ where: { businessId: business.id } });
    await prisma.serviceRequest.deleteMany({ where: { businessId: business.id } });
    await prisma.tableSession.deleteMany({ where: { businessId: business.id } });
    await prisma.business.delete({ where: { id: business.id } });
    await prisma.$disconnect();
  }

  console.log("\n=================================================");
  console.log(`📊 Test Results: ${passedCount} Passed, ${failedCount} Failed`);
  console.log("=================================================");
  process.exit(failedCount > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error("❌ Test çalıştırılamadı:", error);
  await prisma.$disconnect();
  process.exit(1);
});
