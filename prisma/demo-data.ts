import { Prisma, StockStatus, SubscriptionStatus, TableStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateQrToken } from "../src/lib/qr-token";

/**
 * Herkese açık demo işletmesinin tanımı ve bir veritabanını bu tanıma getiren işlem.
 *
 * Demo yöneticisinin parolası giriş ekranında yazdığı için ziyaretçiler masa silebiliyor, fiyat
 * değiştirebiliyor, parola bile değiştirebiliyor. Bu yüzden eşitleme eksik olanı eklemekle
 * kalmaz, tanımdaki satırları geri getirir; tanımda olmayan satırlara dokunmaz.
 */

export const DEMO_BUSINESS_ID = "demo-business-id";

/** Çalışan ürünün parola maliyetiyle aynı (kayıt ve personel uçları) */
const BCRYPT_COST = 12;

/** Abonelik ekranı "Plan yok" demesin diye süresiz deneme; deneme platform cirosuna girmez */
export const DEMO_PLAN_CODE = "pro";

const BUSINESS_FIELDS = {
  name: "Demo Kafe",
  slug: "demo-kafe",
  description: "QR Menü Demo İşletmesi - Kafe & Restoran",
  logo: null,
  phone: "+90 555 000 0000",
  email: "demo@qrmenu.com",
  address: "İstanbul, Türkiye",
  isActive: true,
  // Konum kilidi demo ziyaretçisinin sipariş vermesini engeller
  latitude: null,
  longitude: null,
  allowedRadiusMeters: 100,
};

/** Giriş ekranındaki demo düğmeleriyle aynı olmalı: src/components/auth/useSignIn.ts */
export const DEMO_USERS = [
  { email: "admin@demo.com", name: "Admin Kullanıcı", role: UserRole.ADMIN, password: "admin123" },
  { email: "garson@demo.com", name: "Demo Garson", role: UserRole.WAITER, password: "garson123" },
];
export const DEMO_EMAILS = DEMO_USERS.map((user) => user.email);

const CATEGORIES = [
  { id: "cat-sicak-icecek", name: "Sıcak İçecekler", icon: "☕" },
  { id: "cat-soguk-icecek", name: "Soğuk İçecekler", icon: "🥤" },
  { id: "cat-yiyecek", name: "Yiyecekler", icon: "🍽️" },
  { id: "cat-tatli", name: "Tatlılar", icon: "🍰" },
];
export const DEMO_CATEGORY_IDS = CATEGORIES.map((category) => category.id);

export const DEMO_PRODUCTS = [
  { id: "prod-turk-kahvesi", name: "Türk Kahvesi", description: "Geleneksel Türk kahvesi", ingredients: "Kahve çekirdeği, su", allergens: null, price: 45, categoryId: "cat-sicak-icecek", isPopular: true },
  { id: "prod-latte", name: "Latte", description: "Espresso üzerine buharla ısıtılmış süt", ingredients: "Espresso, süt", allergens: "Süt ürünleri", price: 65, categoryId: "cat-sicak-icecek", isPopular: true },
  { id: "prod-cay", name: "Çay", description: "Demlik çay, Rize çayı", ingredients: "Çay", allergens: null, price: 15, categoryId: "cat-sicak-icecek", isPopular: true },
  { id: "prod-cappuccino", name: "Cappuccino", description: "Espresso, buharla ısıtılmış süt ve süt köpüğü", ingredients: "Espresso, süt", allergens: "Süt ürünleri", price: 70, categoryId: "cat-sicak-icecek", isPopular: false },
  { id: "prod-sicak-cikolata", name: "Sıcak Çikolata", description: "Gerçek çikolata ile hazırlanan sıcak çikolata", ingredients: "Çikolata, süt, şeker", allergens: "Süt ürünleri", price: 55, categoryId: "cat-sicak-icecek", isPopular: false },
  { id: "prod-ayran", name: "Ayran", description: "Taze yapılmış soğuk ayran", ingredients: "Yoğurt, su, tuz", allergens: "Süt ürünleri", price: 20, categoryId: "cat-soguk-icecek", isPopular: true },
  { id: "prod-limonata", name: "Limonata", description: "Taze sıkılmış ev yapımı limonata", ingredients: "Limon, su, şeker, nane", allergens: null, price: 35, categoryId: "cat-soguk-icecek", isPopular: true },
  { id: "prod-ice-tea", name: "Ice Tea", description: "Soğuk çay, şeftali aromalı", ingredients: "Çay, şeftali aroması, şeker", allergens: null, price: 30, categoryId: "cat-soguk-icecek", isPopular: false },
  { id: "prod-tost", name: "Tost", description: "Kaşarlı karışık tost", ingredients: "Tost ekmeği, kaşar peyniri, domates, salatalık", allergens: "Gluten, Süt ürünleri", price: 60, categoryId: "cat-yiyecek", isPopular: true },
  { id: "prod-hamburger", name: "Hamburger", description: "El yapımı köfte, taze sebzeler ve özel sos ile", ingredients: "Dana kıyma, marul, domates, soğan, turşu, hamburger ekmeği", allergens: "Gluten", price: 120, categoryId: "cat-yiyecek", isPopular: true },
  { id: "prod-izgara-kofte", name: "Izgara Köfte", description: "Özel baharatlarla hazırlanmış el yapımı köfte", ingredients: "Dana kıyma, soğan, maydanoz, baharatlar", allergens: "Gluten", price: 130, categoryId: "cat-yiyecek", isPopular: true },
  { id: "prod-tavuk-sis", name: "Tavuk Şiş", description: "Marine edilmiş tavuk göğsü şiş", ingredients: "Tavuk göğsü, zeytinyağı, limon, baharatlar", allergens: null, price: 110, categoryId: "cat-yiyecek", isPopular: false },
  { id: "prod-karisik-pizza", name: "Karışık Pizza", description: "Bol malzemeli karışık pizza", ingredients: "Un, domates sosu, mozzarella, sucuk, mantar, biber", allergens: "Gluten, Süt ürünleri", price: 150, categoryId: "cat-yiyecek", isPopular: false },
  { id: "prod-cheesecake", name: "Cheesecake", description: "New York usulü klasik cheesecake", ingredients: "Krem peynir, bisküvi, tereyağı, şeker", allergens: "Gluten, Süt ürünleri", price: 85, categoryId: "cat-tatli", isPopular: true },
  { id: "prod-sutlac", name: "Sütlaç", description: "Fırında pişirilmiş geleneksel sütlaç", ingredients: "Süt, pirinç, şeker, vanilya", allergens: "Süt ürünleri", price: 55, categoryId: "cat-tatli", isPopular: true },
  { id: "prod-baklava", name: "Baklava", description: "Antep fıstıklı ev yapımı baklava", ingredients: "Yufka, tereyağı, antep fıstığı, şerbet", allergens: "Gluten, Fındık", price: 75, categoryId: "cat-tatli", isPopular: false },
];
export const DEMO_PRODUCT_IDS = DEMO_PRODUCTS.map((product) => product.id);

const TABLE_NAMES = ["Masa 1", "Masa 2", "Masa 3", "Masa 4", "Bahçe 1", "Bahçe 2", "Teras 1", "Teras 2", "VIP 1", "VIP 2"];
export const DEMO_TABLE_NUMBERS = TABLE_NAMES.map((_, index) => String(index + 1));

/** Transaction dışında çağrılır: bcrypt yavaştır, açık transaction'ı bekletmesin */
export async function hashDemoPasswords(): Promise<Record<string, string>> {
  const entries = await Promise.all(
    DEMO_USERS.map(async (user) => [user.email, await bcrypt.hash(user.password, BCRYPT_COST)] as const),
  );
  return Object.fromEntries(entries);
}

async function syncUsers(db: Prisma.TransactionClient, passwordHashes: Record<string, string>) {
  for (const user of DEMO_USERS) {
    const fields = {
      businessId: DEMO_BUSINESS_ID,
      name: user.name,
      password: passwordHashes[user.email],
      phone: null,
      role: user.role,
      isActive: true,
      deletedAt: null,
    };
    await db.user.upsert({
      where: { email: user.email },
      // Ziyaretçi parolayı değiştirmiş olabilir: o parolayla açılmış oturumlar da kapanır
      update: { ...fields, sessionVersion: { increment: 1 } },
      create: { email: user.email, ...fields },
    });
  }
}

async function syncMenu(db: Prisma.TransactionClient) {
  for (const [index, { id, ...category }] of CATEGORIES.entries()) {
    const fields = { ...category, businessId: DEMO_BUSINESS_ID, sortOrder: index + 1, isActive: true };
    await db.category.upsert({ where: { id }, update: fields, create: { id, ...fields } });
  }

  for (const [index, { id, ...product }] of DEMO_PRODUCTS.entries()) {
    const fields = {
      ...product,
      businessId: DEMO_BUSINESS_ID,
      image: null,
      isAvailable: true,
      stockStatus: StockStatus.IN_STOCK,
      sortOrder: index + 1,
      isDeleted: false,
      deletedAt: null,
    };
    await db.product.upsert({ where: { id }, update: fields, create: { id, ...fields } });
  }
}

/**
 * Silinen masa geri gelir (silme qrToken'ı boşaltır). Duran masanın token'ı ve durumu korunur:
 * basılmış QR çalışmaya devam eder, açık oturumu olan masa boş görünmez.
 */
async function syncTables(db: Prisma.TransactionClient) {
  const existing = await db.table.findMany({
    where: { businessId: DEMO_BUSINESS_ID, tableNumber: { in: DEMO_TABLE_NUMBERS } },
    select: { tableNumber: true, isDeleted: true, qrToken: true },
  });
  const byNumber = new Map(existing.map((table) => [table.tableNumber, table]));

  for (const [index, tableName] of TABLE_NAMES.entries()) {
    const tableNumber = DEMO_TABLE_NUMBERS[index];
    const current = byNumber.get(tableNumber);
    if (!current) {
      await db.table.create({
        data: { businessId: DEMO_BUSINESS_ID, tableNumber, tableName, status: TableStatus.EMPTY, qrToken: generateQrToken() },
      });
      continue;
    }
    await db.table.update({
      where: { businessId_tableNumber: { businessId: DEMO_BUSINESS_ID, tableNumber } },
      data: {
        tableName,
        isActive: true,
        isDeleted: false,
        deletedAt: null,
        qrToken: current.qrToken ?? generateQrToken(),
        qrTokenExpiresAt: null,
        ...(current.isDeleted ? { status: TableStatus.EMPTY } : {}),
      },
    });
  }
}

async function syncSubscription(db: Prisma.TransactionClient) {
  const plan = await db.subscriptionPlan.findUnique({ where: { code: DEMO_PLAN_CODE }, select: { id: true } });
  if (!plan) {
    console.warn(`⚠️  "${DEMO_PLAN_CODE}" planı yok, demo aboneliği atlandı. Önce: node prisma/seed-plans.cjs --create-only`);
    return;
  }
  await db.businessSubscription.deleteMany({ where: { businessId: DEMO_BUSINESS_ID, iyzicoSubscriptionRef: null } });
  await db.businessSubscription.create({
    data: {
      businessId: DEMO_BUSINESS_ID,
      planId: plan.id,
      status: SubscriptionStatus.TRIAL,
      startedAt: new Date(),
      trialEndsAt: null,
    },
  });
}

/** Tek transaction içinde çağrılmalı; yarıda kalırsa demo yarım tanımda kalmasın */
export async function syncDemoBusiness(db: Prisma.TransactionClient, passwordHashes: Record<string, string>) {
  await db.business.upsert({
    where: { id: DEMO_BUSINESS_ID },
    update: BUSINESS_FIELDS,
    create: { id: DEMO_BUSINESS_ID, ...BUSINESS_FIELDS },
  });
  await syncUsers(db, passwordHashes);
  await syncMenu(db);
  await syncTables(db);
  await syncSubscription(db);
}
