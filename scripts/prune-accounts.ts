/**
 * Demo dışındaki tüm hesapları siler, demo işletmesini tanımına getirir, yeni süper admin açar.
 * GERİ ALINAMAZ: uygulamadan önce yedek alın.
 *
 * Varsayılan kuru çalıştırmadır: salt okunur transaction'da silinecekleri listeler, onay kodu üretir.
 * Uygulama yalnız o kodla çalışır; hedef ya da silinecek işletme/kullanıcı listesi değiştiyse kod
 * tutmaz. Tüm işlem tek transaction'dadır: hata olursa hiçbir satır değişmez.
 *
 *   npx tsx scripts/prune-accounts.ts --super-admin-email=<adres>
 *   npx tsx scripts/prune-accounts.ts --super-admin-email=<adres> --apply --confirm=<kod> --password-file=<repo dışı yol>
 *
 * DATABASE_URL kabuktan verilmek zorunda: verilmezse Prisma sessizce .env'deki veritabanına bağlanırdı.
 * Süper admin parolası rastgele üretilir, yalnız --password-file dosyasına yazılır, ekrana basılmaz.
 * Korunanlar: demo ve platform işletmeleri, abonelik planları, audit_logs, data_retention_runs.
 * Aktif iyzico aboneliği varsa durur: yerel kaydı silmek iyzico'daki tahsilatı durdurmaz.
 */

import { createHash, randomBytes } from "crypto";
import { rmSync, writeFileSync } from "fs";
import path from "path";
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  DEMO_BUSINESS_ID,
  DEMO_CATEGORY_IDS,
  DEMO_EMAILS,
  DEMO_PLAN_CODE,
  DEMO_PRODUCTS,
  DEMO_PRODUCT_IDS,
  DEMO_TABLE_NUMBERS,
  DEMO_USERS,
  hashDemoPasswords,
  syncDemoBusiness,
} from "../prisma/demo-data";
import {
  PLATFORM_BUSINESS_ID,
  SUPER_ADMIN_BCRYPT_COST,
  ensureSuperAdmin,
  isValidAccountPassword,
  isValidEmail,
  normalizeEmail,
} from "../prisma/super-admin";

type Tx = Prisma.TransactionClient;

interface Target {
  url: string;
  host: string;
  port: string;
  database: string;
}

const KEPT_BUSINESS_IDS = [DEMO_BUSINESS_ID, PLATFORM_BUSINESS_ID];
const TX_OPTIONS = { maxWait: 30_000, timeout: 600_000 };

/**
 * Silme adımları; yabancı anahtar sırasıyla. Kuru çalıştırma aynı filtreyle sayar, böylece
 * gösterilen sayı silinecek olanın kendisidir. orders/payments → tables ve order_items → products
 * RESTRICT olduğu için işletmeyi tek DELETE ile silmek kırılır. İşlem verisi (sipariş, ödeme,
 * oturum...) demo dahil hiçbir işletmede kalmaz.
 */
function deletionSteps(db: Tx) {
  const notDemo = { businessId: { not: DEMO_BUSINESS_ID } };
  const products = { OR: [notDemo, { id: { notIn: DEMO_PRODUCT_IDS } }] };
  const categories = { OR: [notDemo, { id: { notIn: DEMO_CATEGORY_IDS } }] };
  const tables = { OR: [notDemo, { tableNumber: { notIn: DEMO_TABLE_NUMBERS } }] };
  const users = { email: { notIn: DEMO_EMAILS } };
  const businesses = { id: { notIn: KEPT_BUSINESS_IDS } };

  return [
    { table: "table_events", count: () => db.tableEvent.count(), remove: () => db.tableEvent.deleteMany() },
    { table: "payments", count: () => db.payment.count(), remove: () => db.payment.deleteMany() },
    { table: "order_items", count: () => db.orderItem.count(), remove: () => db.orderItem.deleteMany() },
    { table: "orders", count: () => db.order.count(), remove: () => db.order.deleteMany() },
    { table: "service_requests", count: () => db.serviceRequest.count(), remove: () => db.serviceRequest.deleteMany() },
    { table: "notifications", count: () => db.notification.count(), remove: () => db.notification.deleteMany() },
    { table: "customer_access_blocks", count: () => db.customerAccessBlock.count(), remove: () => db.customerAccessBlock.deleteMany() },
    { table: "customer_sessions", count: () => db.customerSession.count(), remove: () => db.customerSession.deleteMany() },
    { table: "bills", count: () => db.bill.count(), remove: () => db.bill.deleteMany() },
    { table: "table_sessions", count: () => db.tableSession.count(), remove: () => db.tableSession.deleteMany() },
    { table: "waiter_invites", count: () => db.waiterInvite.count(), remove: () => db.waiterInvite.deleteMany() },
    { table: "business_subscriptions", count: () => db.businessSubscription.count(), remove: () => db.businessSubscription.deleteMany() },
    { table: "product_modifier_assignments", count: () => db.productModifierAssignment.count(), remove: () => db.productModifierAssignment.deleteMany() },
    { table: "product_modifiers", count: () => db.productModifier.count(), remove: () => db.productModifier.deleteMany() },
    { table: "products", count: () => db.product.count({ where: products }), remove: () => db.product.deleteMany({ where: products }) },
    { table: "categories", count: () => db.category.count({ where: categories }), remove: () => db.category.deleteMany({ where: categories }) },
    { table: "tables", count: () => db.table.count({ where: tables }), remove: () => db.table.deleteMany({ where: tables }) },
    { table: "users", count: () => db.user.count({ where: users }), remove: () => db.user.deleteMany({ where: users }) },
    { table: "businesses", count: () => db.business.count({ where: businesses }), remove: () => db.business.deleteMany({ where: businesses }) },
  ];
}

/** Canlı şema migration'lardan tam türetilemiyor: bilinmeyen bir tablo silmeyi engellemesin */
async function unexpectedDependents(db: Tx, knownTables: string[]) {
  const rows = await db.$queryRaw<{ child: string; parent: string }[]>`
    select conrelid::regclass::text as child, confrelid::regclass::text as parent
    from pg_constraint
    where contype = 'f' and connamespace = 'public'::regnamespace`;
  const known = new Set(knownTables);
  return rows.filter((row) => !known.has(row.child) && known.has(row.parent));
}

async function demoDrift(db: Tx) {
  const tables = await db.table.findMany({
    where: { businessId: DEMO_BUSINESS_ID },
    select: { tableNumber: true, tableName: true, isDeleted: true },
  });
  const products = await db.product.findMany({
    where: { businessId: DEMO_BUSINESS_ID },
    select: { id: true, name: true, price: true, isDeleted: true, isAvailable: true, stockStatus: true },
  });
  const plan = await db.subscriptionPlan.findUnique({ where: { code: DEMO_PLAN_CODE }, select: { id: true } });

  const standing = new Set(tables.filter((table) => !table.isDeleted).map((table) => table.tableNumber));
  const expected = new Map(DEMO_PRODUCTS.map((product) => [product.id, product]));
  const present = new Set(products.map((product) => product.id));

  return {
    tablesRestored: DEMO_TABLE_NUMBERS.filter((number) => !standing.has(number)),
    tablesRemoved: tables
      .filter((table) => !DEMO_TABLE_NUMBERS.includes(table.tableNumber))
      .map((table) => table.tableName ?? table.tableNumber),
    productsRemoved: products.filter((product) => !expected.has(product.id)).map((product) => product.name),
    productsAdded: DEMO_PRODUCTS.filter((product) => !present.has(product.id)).map((product) => product.name),
    productsChanged: products.flatMap((product) => {
      const definition = expected.get(product.id);
      if (!definition) return [];
      const changes: string[] = [];
      if (Number(product.price) !== definition.price) {
        changes.push(`${product.name}: ${Number(product.price)} → ${definition.price} TL`);
      }
      if (product.isDeleted || !product.isAvailable || product.stockStatus !== "IN_STOCK") {
        changes.push(`${product.name}: menüye geri döner`);
      }
      return changes;
    }),
    planMissing: !plan,
  };
}

async function buildPlan(db: Tx, target: Target, superAdminEmail: string) {
  const businesses = await db.business.findMany({
    where: { id: { notIn: KEPT_BUSINESS_IDS } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      createdAt: true,
      _count: { select: { users: true, tables: true, products: true, orders: true, payments: true } },
      businessSubscriptions: { select: { status: true, iyzicoSubscriptionRef: true } },
    },
  });
  const paid = await db.payment.groupBy({
    by: ["businessId"],
    where: { status: "PAID" },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const lastOrders = await db.order.groupBy({ by: ["businessId"], _max: { createdAt: true } });
  const users = await db.user.findMany({
    where: { email: { notIn: DEMO_EMAILS } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, email: true, role: true, isActive: true, deletedAt: true, createdAt: true, businessId: true },
  });
  const liveIyzico = await db.businessSubscription.findMany({
    where: { iyzicoSubscriptionRef: { not: null }, status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] } },
    select: { status: true, business: { select: { name: true } } },
  });

  const steps = deletionSteps(db);
  const rowCounts: Record<string, number> = {};
  for (const step of steps) rowCounts[step.table] = await step.count();

  const code = createHash("sha256")
    .update(
      JSON.stringify({
        host: target.host,
        database: target.database,
        superAdminEmail,
        businessIds: businesses.map((business) => business.id),
        userIds: users.map((user) => user.id),
      }),
    )
    .digest("hex")
    .slice(0, 10);

  return {
    code,
    businesses,
    paid: new Map(paid.map((row) => [row.businessId, { count: row._count._all, sum: Number(row._sum.amount ?? 0) }])),
    lastOrders: new Map(lastOrders.map((row) => [row.businessId, row._max.createdAt])),
    users,
    liveIyzico,
    rowCounts,
    drift: await demoDrift(db),
    dependents: await unexpectedDependents(db, steps.map((step) => step.table)),
  };
}

type Plan = Awaited<ReturnType<typeof buildPlan>>;

const day = (date: Date | null | undefined) => (date ? date.toISOString().slice(0, 10) : "-");
const clip = (text: string, max = 40) => (text.length > max ? `${text.slice(0, max)}…` : text);
const list = (items: string[]) => (items.length ? items.map((item) => clip(item)).join(", ") : "yok");

function printPlan(target: Target, superAdminEmail: string, plan: Plan) {
  const activeBusinesses = plan.businesses.filter(
    (business) =>
      business._count.orders > 0 ||
      business._count.payments > 0 ||
      business.businessSubscriptions.some((sub) => sub.iyzicoSubscriptionRef || sub.status === "ACTIVE"),
  );

  console.log("KURU ÇALIŞTIRMA: salt okunur, hiçbir satır değişmedi.");
  console.log(`Hedef: ${target.host} / ${target.database}`);
  console.log(`Korunan işletmeler: ${KEPT_BUSINESS_IDS.join(", ")}`);
  console.log(`Korunan hesaplar: ${DEMO_EMAILS.join(", ")}`);
  console.log(`Oluşturulacak süper admin: ${superAdminEmail}`);

  console.log(`\nSİLİNECEK İŞLETMELER (${plan.businesses.length})`);
  for (const business of plan.businesses) {
    const paid = plan.paid.get(business.id);
    const subs = business.businessSubscriptions;
    const counts = business._count;
    console.log(
      `- ${clip(business.name)} | ${clip(business.slug, 24)} | açılış ${day(business.createdAt)} | ${business.isActive ? "aktif" : "pasif"}` +
        ` | kullanıcı ${counts.users}, masa ${counts.tables}, ürün ${counts.products}, sipariş ${counts.orders}` +
        ` | ödeme ${counts.payments} (PAID ${paid?.count ?? 0}, ${(paid?.sum ?? 0).toFixed(2)} TL)` +
        ` | abonelik ${subs.length ? subs.map((sub) => sub.status).join(",") : "-"}` +
        ` | son sipariş ${day(plan.lastOrders.get(business.id))}`,
    );
  }

  console.log(`\nSİLİNECEK KULLANICILAR (${plan.users.length})`);
  for (const user of plan.users) {
    const state = user.deletedAt ? "silinmiş" : user.isActive ? "aktif" : "pasif";
    console.log(`- ${clip(user.email, 60)} | ${user.role} | ${state} | açılış ${day(user.createdAt)} | işletme ${user.businessId}`);
  }

  console.log("\nGERÇEK MÜŞTERİ OLABİLECEKLER (sipariş, ödeme ya da ücretli abonelik var)");
  console.log(activeBusinesses.length ? activeBusinesses.map((business) => `- ${clip(business.name)}`).join("\n") : "- yok");

  console.log("\nDEMO İŞLETMESİ");
  console.log(`- Geri gelecek masalar: ${list(plan.drift.tablesRestored)}`);
  console.log(`- Kaldırılacak masalar: ${list(plan.drift.tablesRemoved.slice(0, 20))}${plan.drift.tablesRemoved.length > 20 ? ` (toplam ${plan.drift.tablesRemoved.length})` : ""}`);
  console.log(`- Kaldırılacak ürünler: ${list(plan.drift.productsRemoved)}`);
  console.log(`- Eklenecek ürünler: ${list(plan.drift.productsAdded)}`);
  console.log(`- Düzelecek ürünler: ${list(plan.drift.productsChanged)}`);
  console.log(`- Süresiz deneme planı: ${plan.drift.planMissing ? `"${DEMO_PLAN_CODE}" planı yok, atlanacak` : DEMO_PLAN_CODE}`);

  console.log("\nSİLİNECEK SATIRLAR (demo işletmesinin sipariş, ödeme ve oturum geçmişi dahil)");
  for (const [table, count] of Object.entries(plan.rowCounts)) console.log(`- ${table}: ${count}`);

  if (plan.dependents.length) {
    console.log("\n⚠️  Şemada olmayan bağımlı tablolar: uygulama bunlar yüzünden geri dönebilir");
    for (const row of plan.dependents) console.log(`- ${row.child} → ${row.parent}`);
  }

  if (plan.liveIyzico.length) {
    console.log("\n⛔ ENGEL: aktif iyzico aboneliği var. Önce iyzico'da iptal edin, sonra yeniden çalıştırın.");
    for (const sub of plan.liveIyzico) console.log(`- ${clip(sub.business.name)} (${sub.status})`);
    return;
  }

  console.log(`\nOnay kodu: ${plan.code}`);
  console.log("Uygulamak için aynı komuta ekleyin: --apply --confirm=<onay kodu> --password-file=<repo dışı yol>");
}

function generatePassword(): string {
  for (;;) {
    const candidate = randomBytes(24).toString("base64url");
    if (isValidAccountPassword(candidate)) return candidate;
  }
}

/** Beklenen son durum değilse transaction geri alınır */
async function verifyFinalState(tx: Tx, superAdminEmail: string, superAdminPassword: string) {
  const users = await tx.user.findMany({ select: { email: true, role: true, password: true, isActive: true, deletedAt: true } });
  const emails = users.map((user) => user.email).sort();
  if (JSON.stringify(emails) !== JSON.stringify([...DEMO_EMAILS, superAdminEmail].sort())) {
    throw new Error(`Doğrulama: beklenmeyen kullanıcı listesi (${users.length} hesap).`);
  }

  const expectedPasswords = new Map([
    ...DEMO_USERS.map((user) => [user.email, user.password] as const),
    [superAdminEmail, superAdminPassword] as const,
  ]);
  for (const user of users) {
    const valid = await bcrypt.compare(expectedPasswords.get(user.email) ?? "", user.password);
    if (!valid || !user.isActive || user.deletedAt) throw new Error("Doğrulama: bir hesapla giriş yapılamayacak durumda.");
  }
  if (users.filter((user) => user.role === "SUPER_ADMIN").length !== 1) {
    throw new Error("Doğrulama: tam olarak bir süper admin olmalı.");
  }

  const businesses = await tx.business.findMany({ select: { id: true } });
  if (JSON.stringify(businesses.map((business) => business.id).sort()) !== JSON.stringify([...KEPT_BUSINESS_IDS].sort())) {
    throw new Error(`Doğrulama: beklenmeyen işletme listesi (${businesses.length} işletme).`);
  }

  const [tables, products] = await Promise.all([
    tx.table.count({ where: { businessId: DEMO_BUSINESS_ID, isDeleted: false, isActive: true } }),
    tx.product.count({ where: { businessId: DEMO_BUSINESS_ID, isDeleted: false, isAvailable: true } }),
  ]);
  if (tables !== DEMO_TABLE_NUMBERS.length || products !== DEMO_PRODUCTS.length) {
    throw new Error(`Doğrulama: demo işletmesi eksik (${tables} masa, ${products} ürün).`);
  }
}

function checkPasswordFile(file: string | undefined): string {
  if (!file) throw new Error("--password-file zorunlu: parola yalnız bu dosyaya yazılır.");
  const resolved = path.resolve(file);
  const relative = path.relative(process.cwd(), resolved);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    throw new Error("--password-file repo dışında olmalı: parola repoya yazılmaz.");
  }
  return resolved;
}

async function apply(prisma: PrismaClient, target: Target, email: string, confirm: string | undefined, passwordFile: string | undefined) {
  if (!confirm) throw new Error("--confirm zorunlu: önce kuru çalıştırmayı inceleyin.");
  const file = checkPasswordFile(passwordFile);

  const password = generatePassword();
  const [passwordHash, demoHashes] = await Promise.all([
    bcrypt.hash(password, SUPER_ADMIN_BCRYPT_COST),
    hashDemoPasswords(),
  ]);

  // wx: henüz saklanmamış eski bir parola dosyasının üstüne yazılmaz
  writeFileSync(file, `E-posta: ${email}\nParola: ${password}\n`, { flag: "wx", mode: 0o600 });

  let deleted: Record<string, number>;
  try {
    deleted = await prisma.$transaction(async (tx) => {
      const plan = await buildPlan(tx, target, email);
      if (plan.liveIyzico.length) throw new Error("Aktif iyzico aboneliği var: önce iyzico'da iptal edin.");
      if (plan.code !== confirm) {
        throw new Error("Onay kodu tutmuyor: hedef ya da silinecek liste değişti. Kuru çalıştırmayı yeniden inceleyin.");
      }

      const removed: Record<string, number> = {};
      for (const step of deletionSteps(tx)) removed[step.table] = (await step.remove()).count;

      await syncDemoBusiness(tx, demoHashes);
      // Oturum kalmadı; eski masa durumları boşa döner
      await tx.table.updateMany({ where: { businessId: DEMO_BUSINESS_ID }, data: { status: "EMPTY" } });
      await ensureSuperAdmin(tx, { email, passwordHash });
      await tx.auditLog.create({
        data: {
          action: "ACCOUNTS_PRUNED",
          actorRole: "SYSTEM",
          entityType: "Maintenance",
          metadata: { confirmCode: confirm, deleted: removed },
        },
      });
      await verifyFinalState(tx, email, password);
      return removed;
    }, TX_OPTIONS);
  } catch (error) {
    // Parola veritabanına yazılmadı; dosyası kafa karıştırmasın
    rmSync(file, { force: true });
    throw error;
  }

  console.log(`UYGULANDI: ${target.host} / ${target.database}`);
  for (const [table, count] of Object.entries(deleted)) console.log(`- ${table}: ${count} silindi`);
  console.log(`Kalan hesaplar: ${[...DEMO_EMAILS, email].join(", ")}`);
  console.log(`Süper admin parolası ${file} dosyasında. Parola yöneticinize taşıyıp dosyayı silin.`);
}

function readTarget(): Target {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL kabukta tanımlı değil. Hedefi bilerek seçin; .env okunmaz.");
  const parsed = new URL(url);
  return { url, host: parsed.hostname, port: parsed.port, database: parsed.pathname.slice(1) };
}

async function main() {
  const argv = process.argv.slice(2);
  const option = (name: string) => argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

  const target = readTarget();
  const email = normalizeEmail(option("super-admin-email") ?? "");
  if (!isValidEmail(email)) throw new Error("--super-admin-email geçerli bir e-posta olmalı.");
  if (target.port === "6543") console.warn("⚠️  Pooler adresi (6543): doğrudan bağlantı adresini kullanın.\n");

  const prisma = new PrismaClient({ datasources: { db: { url: target.url } } });
  try {
    if (argv.includes("--apply")) {
      await apply(prisma, target, email, option("confirm"), option("password-file"));
    } else {
      const plan = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        return buildPlan(tx, target, email);
      }, TX_OPTIONS);
      printPlan(target, email, plan);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`❌ ${String(error?.message ?? error).replace(/postgres(ql)?:\/\/\S+/g, "[adres]")}`);
  process.exit(1);
});
