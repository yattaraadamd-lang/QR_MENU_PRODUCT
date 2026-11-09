import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { cancelledPlanEndDate, formatLimit, planAction, trialDaysLeft, usageLevel } from "./subscriptionModel";
import type { PlanDTO, SubscriptionDTO } from "./types";

const NOW = Date.parse("2026-11-08T12:00:00Z");
const HOUR_MS = 3_600_000;

const subscription = (overrides: Partial<SubscriptionDTO> = {}): SubscriptionDTO => ({
  status: "ACTIVE",
  trialEndsAt: null,
  endsAt: null,
  isValid: true,
  plan: { code: "pro", name: "Profesyonel", monthlyPrice: 599 },
  ...overrides,
});

const plan = (overrides: Partial<PlanDTO> = {}): PlanDTO => ({
  id: "p1",
  code: "pro",
  name: "Profesyonel",
  description: null,
  monthlyPrice: 599,
  maxTables: 30,
  maxWaiters: 10,
  maxProducts: 200,
  hasReports: true,
  hasPayments: true,
  canPurchase: true,
  ...overrides,
});

describe("formatLimit", () => {
  test("null sınırsızdır", () => {
    assert.equal(formatLimit(null), "Sınırsız");
    assert.equal(formatLimit(10), "10");
  });
});

describe("usageLevel", () => {
  test("eşikler: %80'de uyarı, sınırda ve üstünde dolu (yüzde 100'de kalır)", () => {
    assert.deepEqual(usageLevel({ current: 7, limit: 10 }), { percent: 70, tone: "primary" });
    assert.deepEqual(usageLevel({ current: 8, limit: 10 }), { percent: 80, tone: "warning" });
    assert.deepEqual(usageLevel({ current: 10, limit: 10 }), { percent: 100, tone: "danger" });
    assert.deepEqual(usageLevel({ current: 12, limit: 10 }), { percent: 100, tone: "danger" });
  });

  test("sınırsız planda çubuk boş", () => {
    assert.deepEqual(usageLevel({ current: 50, limit: null }), { percent: 0, tone: "primary" });
  });
});

describe("trialDaysLeft", () => {
  test("yalnız denemede ve bitiş tarihi varken", () => {
    assert.equal(trialDaysLeft(null, NOW), null);
    assert.equal(trialDaysLeft(subscription(), NOW), null);
    assert.equal(trialDaysLeft(subscription({ status: "TRIAL" }), NOW), null);
  });

  test("kalan gün yukarı yuvarlanır, bitmiş denemede sıfır", () => {
    const endsIn36h = new Date(NOW + 36 * HOUR_MS).toISOString();
    assert.equal(trialDaysLeft(subscription({ status: "TRIAL", trialEndsAt: endsIn36h }), NOW), 2);
    const ended = new Date(NOW - HOUR_MS).toISOString();
    assert.equal(trialDaysLeft(subscription({ status: "TRIAL", trialEndsAt: ended }), NOW), 0);
  });
});

describe("cancelledPlanEndDate", () => {
  test("yalnız iptal edilmiş ve hâlâ geçerli abonelikte", () => {
    assert.equal(cancelledPlanEndDate(null), null);
    assert.equal(cancelledPlanEndDate(subscription({ endsAt: "2026-12-31T10:00:00Z" })), null);
    assert.equal(
      cancelledPlanEndDate(subscription({ status: "CANCELLED", isValid: false, endsAt: "2026-12-31T10:00:00Z" })),
      null,
    );
  });

  test("tarih İstanbul saatiyle: UTC 31 Aralık 22:30, İstanbul'da 1 Ocak", () => {
    const text = cancelledPlanEndDate(subscription({ status: "CANCELLED", endsAt: "2026-12-31T22:30:00Z" }));
    assert.ok(text?.includes("Ocak") && text.includes("2027"), `beklenen 1 Ocak 2027, gelen ${text}`);
  });
});

describe("planAction", () => {
  test("aktif aboneliğin planı mevcut plan", () => {
    assert.deepEqual(planAction(plan(), subscription(), false), { label: "Mevcut plan", disabled: true });
  });

  test("online ödemesi olmayan plan yakında", () => {
    assert.deepEqual(planAction(plan({ code: "business", canPurchase: false }), subscription(), false), {
      label: "Yakında",
      disabled: true,
    });
  });

  test("seçilebilir plan ödeme başlamışsa kilitli; denemedeki plan seçilebilir", () => {
    const other = plan({ code: "business" });
    assert.deepEqual(planAction(other, subscription(), false), { label: "Bu planı seç", disabled: false });
    assert.deepEqual(planAction(other, subscription(), true), { label: "Bu planı seç", disabled: true });
    assert.deepEqual(planAction(plan(), subscription({ status: "TRIAL" }), false), { label: "Bu planı seç", disabled: false });
  });
});
