import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── Production Safety ────────────────────────────────────────────────────────
function checkProductionSafety() {
  const isDemoMode = process.env.DEMO_MODE === "true";
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && !isDemoMode) {
    throw new Error(
      "❌ SECURITY: Mesela Coffe seed cannot run in production without DEMO_MODE=true.\n" +
      "Set DEMO_MODE=true in environment variables to enable.\n" +
      "⚠️  WARNING: This will create accounts with known passwords!"
    );
  }

  if (isProduction && isDemoMode) {
    console.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.warn("⚠️  DEMO MODE ENABLED IN PRODUCTION!");
    console.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  } else {
    console.warn("⚠️  Running Mesela Coffe seed — development only!");
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  checkProductionSafety();

  console.log("☕ Mesela Coffe seed başlatılıyor...\n");

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. İŞLETME (Business)
  // ═══════════════════════════════════════════════════════════════════════════
  const business = await prisma.business.upsert({
    where: { slug: "mesela-coffe" },
    update: {},
    create: {
      id: "mesela-coffe-business-id",
      name: "Mesela Coffe",
      slug: "mesela-coffe",
      description: "Specialty Coffee & Tea — Mesela Coffe",
      email: "meselacoffe@demo.com",
      isActive: true,
    },
  });

  console.log("✅ İşletme oluşturuldu:", business.name);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. ADMIN KULLANICI (User)
  // ═══════════════════════════════════════════════════════════════════════════
  const hashedPassword = await bcrypt.hash("adminmesela123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "meselacoffe@demo.com" },
    update: {},
    create: {
      businessId: business.id,
      name: "Mesela Coffe Admin",
      email: "meselacoffe@demo.com",
      password: hashedPassword,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  console.log("✅ Admin oluşturuldu:", admin.email);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. KATEGORİLER (Categories)
  // ═══════════════════════════════════════════════════════════════════════════
  const categoriesData = [
    { id: "mc-cat-brew-classic",   name: "Brew Classic Coffee", icon: "☕", sortOrder: 1 },
    { id: "mc-cat-milky-coffees",  name: "w / Milky Coffees",   icon: "🥛", sortOrder: 2 },
    { id: "mc-cat-brew-pourover",  name: "Brew Pour Over",      icon: "☕", sortOrder: 3 },
    { id: "mc-cat-tea",           name: "ÇAY / TEA",           icon: "🍵", sortOrder: 4 },
    { id: "mc-cat-cold",          name: "SOĞUK / COLD",         icon: "🧊", sortOrder: 5 },
  ];

  for (const cat of categoriesData) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {},
      create: {
        id: cat.id,
        businessId: business.id,
        name: cat.name,
        icon: cat.icon,
        sortOrder: cat.sortOrder,
        isActive: true,
      },
    });
  }

  console.log(`✅ ${categoriesData.length} kategori oluşturuldu`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. ÜRÜNLER (Products)
  // ═══════════════════════════════════════════════════════════════════════════
  const productsData = [
    // ── Brew Classic Coffee ──────────────────────────────────────────────────
    { id: "mc-prod-espresso",         categoryId: "mc-cat-brew-classic",  name: "Espresso",                       description: "Yoğun ve aromatik tek shot espresso",           price: 55,  sortOrder: 1 },
    { id: "mc-prod-double-espresso",  categoryId: "mc-cat-brew-classic",  name: "Double Espresso",                description: "Çift shot espresso, ekstra yoğun",              price: 70,  sortOrder: 2 },
    { id: "mc-prod-americano",        categoryId: "mc-cat-brew-classic",  name: "Americano",                      description: "Espresso üzerine sıcak su",                     price: 60,  sortOrder: 3 },
    { id: "mc-prod-filter",           categoryId: "mc-cat-brew-classic",  name: "Filter Kahve / Filter Coffee",   description: "Taze çekilmiş filtre kahve",                    price: 65,  sortOrder: 4 },
    { id: "mc-prod-turk-kahvesi",     categoryId: "mc-cat-brew-classic",  name: "Türk Kahvesi / Turkish Coffee",  description: "Geleneksel Türk kahvesi, cezve ile pişirilir",  price: 50,  sortOrder: 5 },

    // ── w / Milky Coffees ────────────────────────────────────────────────────
    { id: "mc-prod-latte",            categoryId: "mc-cat-milky-coffees", name: "Latte",                          description: "Espresso ve buharla ısıtılmış süt",             price: 75,  sortOrder: 1 },
    { id: "mc-prod-cortado",          categoryId: "mc-cat-milky-coffees", name: "Cortado",                        description: "Eşit oranda espresso ve sıcak süt",             price: 70,  sortOrder: 2 },
    { id: "mc-prod-flat-white",       categoryId: "mc-cat-milky-coffees", name: "Flat White",                     description: "Double ristretto ve kadifemsi mikro köpük",      price: 80,  sortOrder: 3 },
    { id: "mc-prod-macchiato",        categoryId: "mc-cat-milky-coffees", name: "Macchiato",                      description: "Espresso üzerine bir tutam süt köpüğü",          price: 65,  sortOrder: 4 },
    { id: "mc-prod-cappuccino",       categoryId: "mc-cat-milky-coffees", name: "Cappuccino",                     description: "Eşit oranda espresso, süt ve süt köpüğü",       price: 75,  sortOrder: 5 },

    // ── Brew Pour Over ───────────────────────────────────────────────────────
    { id: "mc-prod-hario-v60",        categoryId: "mc-cat-brew-pourover", name: "Hario V60",                      description: "V60 dripper ile özenle hazırlanan pour over",    price: 90,  sortOrder: 1 },
    { id: "mc-prod-chemex",           categoryId: "mc-cat-brew-pourover", name: "Chemex",                         description: "Chemex ile temiz ve parlak bir demleme",         price: 100, sortOrder: 2 },

    // ── ÇAY / TEA ────────────────────────────────────────────────────────────
    { id: "mc-prod-cay",              categoryId: "mc-cat-tea",           name: "Çay",                            description: "Demlik çay",                                    price: 20,  sortOrder: 1 },
    { id: "mc-prod-ihlamur",          categoryId: "mc-cat-tea",           name: "Ihlamur / Linden",               description: "Taze ıhlamur çiçeği demlemesi",                  price: 30,  sortOrder: 2 },
    { id: "mc-prod-yesil-cay",        categoryId: "mc-cat-tea",           name: "Yeşil Çay / Green Tea",          description: "Hafif ve ferahlatıcı yeşil çay",                price: 30,  sortOrder: 3 },
    { id: "mc-prod-hibiskus",         categoryId: "mc-cat-tea",           name: "Hibiskus / Hibiscus",            description: "Ekşimsi ve aromatik hibiskus çayı",              price: 35,  sortOrder: 4 },

    // ── SOĞUK / COLD ─────────────────────────────────────────────────────────
    { id: "mc-prod-iced-espresso",    categoryId: "mc-cat-cold",          name: "Iced Espresso",                  description: "Buz üzerine espresso",                          price: 65,  sortOrder: 1 },
    { id: "mc-prod-iced-americano",   categoryId: "mc-cat-cold",          name: "Iced Americano",                 description: "Buz üzerine espresso ve soğuk su",              price: 70,  sortOrder: 2 },
    { id: "mc-prod-iced-latte",       categoryId: "mc-cat-cold",          name: "Iced Latte",                     description: "Buz üzerine espresso ve soğuk süt",             price: 80,  sortOrder: 3 },
    { id: "mc-prod-japanese-iced",    categoryId: "mc-cat-cold",          name: "Japanese Iced Coffee",           description: "Buz üzerine doğrudan demlenen pour over",        price: 85,  sortOrder: 4 },
  ];

  for (const prod of productsData) {
    await prisma.product.upsert({
      where: { id: prod.id },
      update: {},
      create: {
        id: prod.id,
        businessId: business.id,
        categoryId: prod.categoryId,
        name: prod.name,
        description: prod.description,
        price: prod.price,
        isAvailable: true,
        isPopular: false,
        sortOrder: prod.sortOrder,
      },
    });
  }

  console.log(`✅ ${productsData.length} ürün oluşturuldu`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. PRODUCT MODIFIERS (Süt Seçenekleri)
  // ═══════════════════════════════════════════════════════════════════════════
  const modifiersData = [
    { id: "mc-mod-laktozsuz",  name: "+ Laktozsuz Süt", extraPrice: 10, sortOrder: 1 },
    { id: "mc-mod-yagli-sut",  name: "+ Yağlı Süt",     extraPrice: 5,  sortOrder: 2 },
    { id: "mc-mod-badem-sutu", name: "+ Badem Sütü",     extraPrice: 15, sortOrder: 3 },
  ];

  for (const mod of modifiersData) {
    await prisma.productModifier.upsert({
      where: { id: mod.id },
      update: {},
      create: {
        id: mod.id,
        businessId: business.id,
        name: mod.name,
        extraPrice: mod.extraPrice,
        isActive: true,
        sortOrder: mod.sortOrder,
      },
    });
  }

  console.log(`✅ ${modifiersData.length} modifier (süt seçeneği) oluşturuldu`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. PRODUCT ↔ MODIFIER ASSIGNMENTS (Many-to-Many)
  //    "w / Milky Coffees" kategorisindeki 5 ürüne 3 süt modifier'ı ata
  // ═══════════════════════════════════════════════════════════════════════════
  const milkyProductIds = [
    "mc-prod-latte",
    "mc-prod-cortado",
    "mc-prod-flat-white",
    "mc-prod-macchiato",
    "mc-prod-cappuccino",
  ];

  const modifierIds = modifiersData.map((m) => m.id);

  let assignmentCount = 0;
  for (const productId of milkyProductIds) {
    for (const modifierId of modifierIds) {
      // Upsert için unique constraint kullan
      const existing = await prisma.productModifierAssignment.findFirst({
        where: { productId, modifierId },
      });

      if (!existing) {
        await prisma.productModifierAssignment.create({
          data: { productId, modifierId },
        });
        assignmentCount++;
      }
    }
  }

  console.log(`✅ ${assignmentCount} modifier assignment oluşturuldu (5 ürün × 3 modifier)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // ÖZET
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n☕ Mesela Coffe seed tamamlandı!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 İşletme:    Mesela Coffe");
  console.log("👤 Admin:      meselacoffe@demo.com");
  console.log("🔑 Şifre:      (check prisma/seed-mesela-coffe.ts for dev password)");
  console.log("📂 Kategoriler: " + categoriesData.length);
  console.log("   ☕ Brew Classic Coffee    → 5 ürün");
  console.log("   🥛 w / Milky Coffees     → 5 ürün (3 süt modifier ile)");
  console.log("   ☕ Brew Pour Over         → 2 ürün");
  console.log("   🍵 ÇAY / TEA             → 4 ürün");
  console.log("   🧊 SOĞUK / COLD          → 4 ürün");
  console.log("🏷️  Modifiers:  " + modifiersData.length + " (Laktozsuz, Yağlı, Badem)");
  console.log("🔗 Assignments: " + assignmentCount);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch((e) => {
    console.error("❌ Seed hatası:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
