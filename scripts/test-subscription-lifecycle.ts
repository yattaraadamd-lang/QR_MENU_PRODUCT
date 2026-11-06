/**
 * Abonelik sonu testi — gerçek Postgres ister (CI: Security CI → migrations işi)
 *
 * İlke (Kullanım Koşulları madde 5.1, 5.6): iptal yenilemeyi durdurur, plan ödenmiş dönemin sonuna
 * kadar sürer, sonra yeni ekleme kapanır. Aboneliği bitmiş işletme ücretsiz limitlere düşmez.
 * iyzico yerel bir sahte sunucuyla taklit edilir, dışarı istek çıkmaz.
 *
 * Kendi işletmelerini ve planını oluşturur, sonunda siler.
 */

import http from "node:http";
import type { AddressInfo } from "node:net";

const RUN_ID = `ci-sub-${Date.now()}`;
const DAY_MS = 24 * 60 * 60 * 1000;

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: unknown) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
    failedCount++;
  }
}

function assertLocalDatabase() {
  let host = "";
  try {
    host = new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    /* geçersiz ya da tanımsız */
  }
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    console.error(`❌ test:lifecycle yalnız yerel Postgres'te çalışır (DATABASE_URL host: ${host || "yok"}).`);
    process.exit(2);
  }
}

type RemoteSubscription = { subscriptionStatus: string; endDate?: number; orders?: unknown[] };

/** iyzico'nun abonelik detay ve iptal uçlarının taklidi. readFails: durum okunamıyor senaryosu */
function startIyzicoStub(remote: Map<string, RemoteSubscription>, readFails: Set<string>) {
  const server = http.createServer((req, res) => {
    const match = /^\/v2\/subscription\/subscriptions\/([^/]+)(\/cancel)?$/.exec(req.url ?? "");
    const reference = match?.[1] ?? "";
    const subscription = remote.get(reference);
    res.setHeader("Content-Type", "application/json");
    if (!subscription) {
      res.end(JSON.stringify({ status: "failure", errorMessage: "bulunamadı" }));
      return;
    }
    if (req.method === "POST" && match?.[2]) {
      subscription.subscriptionStatus = "CANCELED";
      // Gerçek iptal anı: endDate'in dönem sonu sanılmadığını sınar
      subscription.endDate = Date.now();
      res.end(JSON.stringify({ status: "success", systemTime: Date.now() }));
      return;
    }
    if (readFails.has(reference)) {
      res.statusCode = 500;
      res.end(JSON.stringify({ status: "failure", errorMessage: "geçici hata" }));
      return;
    }
    res.end(
      JSON.stringify({
        status: "success",
        data: { items: [{ referenceCode: reference, customerReferenceCode: "c", pricingPlanReferenceCode: "p", ...subscription }] },
      })
    );
  });
  return new Promise<http.Server>((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function main() {
  assertLocalDatabase();

  const remote = new Map<string, RemoteSubscription>();
  const readFails = new Set<string>();
  const stub = await startIyzicoStub(remote, readFails);

  // src/lib/iyzico.ts adresi modül yüklenirken okur: aşağıdaki import'lardan önce
  process.env.IYZICO_BASE_URL = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;
  process.env.IYZICO_API_KEY = "stub";
  process.env.IYZICO_SECRET_KEY = "stub";

  const { prisma } = await import("../src/lib/prisma");
  const { cancelPaidSubscription, nextBillingDate, subscriptionEndDate, syncIyzicoSubscription } = await import("../src/lib/billing");
  const { checkPlanQuota, getUsageSummary } = await import("../src/lib/services/subscription-guard.service");

  const businessIds: string[] = [];
  const plan = await prisma.subscriptionPlan.create({
    data: { code: `${RUN_ID}-plan`, name: "Test Planı", monthlyPrice: 100, maxTables: 2, maxWaiters: 1, maxProducts: 5, isActive: false },
  });

  const newBusiness = async (label: string) => {
    const id = `${RUN_ID}-${label}`;
    const business = await prisma.business.create({ data: { id, name: id, slug: id } });
    businessIds.push(business.id);
    return business;
  };
  const paidSubscription = async (businessId: string, reference: string, startedAt: Date, status: "ACTIVE" | "PAST_DUE" = "ACTIVE") =>
    prisma.businessSubscription.create({
      data: { businessId, planId: plan.id, status, startedAt, iyzicoSubscriptionRef: reference, iyzicoCustomerRef: "c" },
    });

  try {
    console.log("\n── Dönem hesabı");
    const d = (iso: string) => new Date(iso);
    assert(
      nextBillingDate(d("2026-01-15T10:00:00Z"), d("2026-03-20T00:00:00Z")).toISOString() === "2026-04-15T10:00:00.000Z",
      "sonraki aylık sınır bulunuyor"
    );
    assert(
      nextBillingDate(d("2026-01-31T10:00:00Z"), d("2026-02-10T00:00:00Z")).toISOString() === "2026-02-28T10:00:00.000Z",
      "kısa ayda ayın son gününe düşüyor"
    );
    assert(
      nextBillingDate(d("2026-01-31T10:00:00Z"), d("2026-03-01T00:00:00Z")).toISOString() === "2026-03-31T10:00:00.000Z",
      "kısa aydan sonra özgün güne dönüyor"
    );
    assert(
      nextBillingDate(d("2026-01-15T10:00:00Z"), d("2026-01-15T10:00:00Z")).toISOString() === "2026-02-15T10:00:00.000Z",
      "başlangıç anında bir sonraki ay"
    );
    assert(
      nextBillingDate(d("2026-01-15T10:00:00Z"), d("2026-02-15T10:00:00Z")).toISOString() === "2026-03-15T10:00:00.000Z",
      "tam sınırda bir sonraki döneme geçiyor"
    );
    assert(
      nextBillingDate(d("2025-12-20T00:00:00Z"), d("2026-01-05T00:00:00Z")).toISOString() === "2026-01-20T00:00:00.000Z",
      "yıl geçişi"
    );

    const now = new Date();
    const local = { status: "ACTIVE" as const, startedAt: new Date(now.getTime() - 10 * DAY_MS) };
    const later = now.getTime() + 20 * DAY_MS;
    assert(
      subscriptionEndDate({ orders: [{ orderStatus: "SUCCESS", endPeriod: later }, { orderStatus: "WAITING", endPeriod: later + 30 * DAY_MS }] }, local, now).getTime() === later,
      "ödemesi alınmamış dönem hakka sayılmıyor"
    );
    assert(
      subscriptionEndDate({ orders: [{ orderStatus: "FAILED", endPeriod: later }] }, local, now).getTime() === now.getTime(),
      "ödenmiş dönem yoksa hak hemen biter"
    );
    assert(subscriptionEndDate(null, local, now).getTime() > now.getTime(), "dönem bilgisi gelmezse aktif abone hakkını kaybetmez");
    assert(
      subscriptionEndDate(null, { ...local, status: "PAST_DUE" }, now).getTime() === now.getTime(),
      "ödemesi gecikmişte ödenmiş dönem sayılmaz"
    );

    console.log("\n── İptal: ödenmiş dönemin sonuna kadar plan sürer");
    const biz = await newBusiness("cancel");
    const reference = `${RUN_ID}-ref`;
    const paidUntil = Date.now() + 12 * DAY_MS;
    remote.set(reference, {
      subscriptionStatus: "ACTIVE",
      orders: [
        { orderStatus: "SUCCESS", startPeriod: Date.now() - 18 * DAY_MS, endPeriod: paidUntil },
        { orderStatus: "WAITING", startPeriod: paidUntil, endPeriod: paidUntil + 30 * DAY_MS },
      ],
    });
    const active = await paidSubscription(biz.id, reference, new Date(Date.now() - 18 * DAY_MS));

    const cancelled = await cancelPaidSubscription(active);
    assert(cancelled.status === "CANCELLED", "durum iptal");
    assert(cancelled.endsAt?.getTime() === paidUntil, "bitiş ödenmiş dönemin sonu, iptal anı değil", cancelled.endsAt);

    await prisma.table.create({ data: { businessId: biz.id, tableNumber: "1" } });
    const within = await checkPlanQuota(biz.id, "TABLE");
    assert(within.allowed && within.limit === 2, "dönem içinde plan limiti geçerli (varsayılan 50 değil)", within);
    await prisma.table.create({ data: { businessId: biz.id, tableNumber: "2" } });
    const full = await checkPlanQuota(biz.id, "TABLE");
    assert(!full.allowed && full.limit === 2, "dönem içinde plan limiti aşılamıyor", full);

    const summaryInside = await getUsageSummary(biz.id);
    assert(summaryInside.subscription?.status === "CANCELLED" && summaryInside.subscription.isValid === true, "özet: iptal ama geçerli", summaryInside.subscription);
    assert(summaryInside.usage.tables.limit === 2, "özet: plan limiti gösteriliyor");

    console.log("\n── Geç bildirim dönemi uzatmaz");
    remote.get(reference)!.orders = [{ orderStatus: "SUCCESS", endPeriod: paidUntil + 90 * DAY_MS }];
    const resynced = await syncIyzicoSubscription(reference);
    assert(resynced?.endsAt?.getTime() === paidUntil, "tekrarlanan bildirim bitişi değiştirmiyor", resynced?.endsAt);

    console.log("\n── Dönem bitince yeni ekleme kapanır");
    await prisma.businessSubscription.update({ where: { id: active.id }, data: { endsAt: new Date(Date.now() - DAY_MS) } });
    const ended = await checkPlanQuota(biz.id, "PRODUCT");
    assert(!ended.allowed && ended.status === "SUBSCRIPTION_ENDED", "biten abonelik varsayılan limite düşmüyor", ended);
    const summaryEnded = await getUsageSummary(biz.id);
    assert(summaryEnded.subscription?.isValid === false && summaryEnded.subscription.plan?.name === "Test Planı", "özet: son plan, geçersiz", summaryEnded.subscription);
    assert(summaryEnded.usage.products.limit === 5, "özet: sınırsız görünmüyor");

    console.log("\n── Bildirimle gelen iptal");
    const hookBiz = await newBusiness("webhook");
    const hookRef = `${RUN_ID}-hook`;
    const hookUntil = Date.now() + 5 * DAY_MS;
    remote.set(hookRef, { subscriptionStatus: "CANCELED", endDate: Date.now(), orders: [{ orderStatus: "SUCCESS", endPeriod: hookUntil }] });
    await paidSubscription(hookBiz.id, hookRef, new Date(Date.now() - 25 * DAY_MS));
    const hooked = await syncIyzicoSubscription(hookRef);
    assert(hooked?.status === "CANCELLED" && hooked.endsAt?.getTime() === hookUntil, "panelden iptalde de ödenmiş dönem korunuyor", hooked);

    const expiredRef = `${RUN_ID}-exp`;
    const expiredBiz = await newBusiness("expired");
    remote.set(expiredRef, { subscriptionStatus: "EXPIRED", orders: [{ orderStatus: "SUCCESS", endPeriod: Date.now() - DAY_MS }] });
    await paidSubscription(expiredBiz.id, expiredRef, new Date(Date.now() - 60 * DAY_MS));
    await syncIyzicoSubscription(expiredRef);
    const expiredQuota = await checkPlanQuota(expiredBiz.id, "TABLE");
    assert(!expiredQuota.allowed && expiredQuota.status === "SUBSCRIPTION_ENDED", "süresi dolan abonelik yeni eklemeyi kapatıyor", expiredQuota);

    console.log("\n── Ödeme gecikmesi");
    const pastDueBiz = await newBusiness("pastdue");
    const pastDueRef = `${RUN_ID}-due`;
    remote.set(pastDueRef, { subscriptionStatus: "UNPAID", orders: [{ orderStatus: "SUCCESS", endPeriod: Date.now() - DAY_MS }, { orderStatus: "FAILED", endPeriod: Date.now() + 29 * DAY_MS }] });
    const pastDue = await paidSubscription(pastDueBiz.id, pastDueRef, new Date(Date.now() - 31 * DAY_MS), "PAST_DUE");
    const pastDueQuota = await checkPlanQuota(pastDueBiz.id, "TABLE");
    assert(!pastDueQuota.allowed && pastDueQuota.status === "PAST_DUE", "gecikmede yeni ekleme kapalı");
    const dueCancelled = await cancelPaidSubscription(pastDue);
    assert((dueCancelled.endsAt?.getTime() ?? Infinity) <= Date.now(), "gecikmişte iptal hemen biter (ödenmiş dönem geçmişte)", dueCancelled.endsAt);

    console.log("\n── Durum okunamasa da iptal kaydolur");
    const failBiz = await newBusiness("readfail");
    const failRef = `${RUN_ID}-fail`;
    remote.set(failRef, { subscriptionStatus: "ACTIVE" });
    readFails.add(failRef);
    const failLocal = await paidSubscription(failBiz.id, failRef, new Date(Date.now() - 3 * DAY_MS));
    const failCancelled = await cancelPaidSubscription(failLocal);
    assert(failCancelled.status === "CANCELLED", "iyzico okunamadı, yerel kayıt yine iptal");
    assert((failCancelled.endsAt?.getTime() ?? 0) > Date.now(), "ödeyen abone hakkını kaybetmiyor", failCancelled.endsAt);

    console.log("\n── Yeniden abonelik");
    const againRef = `${RUN_ID}-again`;
    remote.set(againRef, { subscriptionStatus: "ACTIVE" });
    await paidSubscription(biz.id, againRef, new Date());
    const again = await checkPlanQuota(biz.id, "PRODUCT");
    assert(again.allowed, "yeni abonelik biten kaydın önüne geçiyor", again);

    console.log("\n── Deneme ve eski işletmeler");
    const trialBiz = await newBusiness("trial");
    await prisma.businessSubscription.create({
      data: { businessId: trialBiz.id, planId: plan.id, status: "TRIAL", startedAt: new Date(Date.now() - 20 * DAY_MS), trialEndsAt: new Date(Date.now() - 6 * DAY_MS) },
    });
    const trialQuota = await checkPlanQuota(trialBiz.id, "TABLE");
    assert(!trialQuota.allowed && trialQuota.status === "TRIAL_EXPIRED", "biten deneme yeni eklemeyi kapatıyor", trialQuota);

    const legacyBiz = await newBusiness("legacy");
    const legacy = await checkPlanQuota(legacyBiz.id, "TABLE");
    assert(legacy.allowed && legacy.limit === 50, "hiç aboneliği olmamış eski işletme varsayılan limitte", legacy);
  } finally {
    for (const id of businessIds) {
      await prisma.business.delete({ where: { id } }).catch((e) => console.error("temizlik:", (e as Error).message));
    }
    await prisma.subscriptionPlan.delete({ where: { id: plan.id } }).catch((e) => console.error("temizlik:", (e as Error).message));
    await prisma.$disconnect();
    stub.close();
  }

  console.log(`\n📊 Test Results: ${passedCount} Passed, ${failedCount} Failed`);
  process.exit(failedCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
