import { PrismaClient, UserRole, TableStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seed başlatılıyor...");

  // İşletme oluştur
  const business = await prisma.business.upsert({
    where: { slug: "demo-kafe" },
    update: {},
    create: {
      id: "demo-business-id",
      name: "Demo Kafe",
      slug: "demo-kafe",
      description: "QR Menü Demo İşletmesi - Kafe & Restoran",
      phone: "+90 555 000 0000",
      email: "demo@qrmenu.com",
      address: "İstanbul, Türkiye",
      isActive: true,
    },
  });

  console.log("✅ İşletme oluşturuldu:", business.name);

  // Admin kullanıcı oluştur
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: {
      businessId: business.id,
      name: "Admin Kullanıcı",
      email: "admin@demo.com",
      password: hashedPassword,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  console.log("✅ Admin oluşturuldu:", admin.email);

  // Garson kullanıcı oluştur
  const waiterPassword = await bcrypt.hash("garson123", 10);
  const waiter = await prisma.user.upsert({
    where: { email: "garson@demo.com" },
    update: {},
    create: {
      businessId: business.id,
      name: "Demo Garson",
      email: "garson@demo.com",
      password: waiterPassword,
      role: UserRole.WAITER,
      isActive: true,
    },
  });

  console.log("✅ Garson oluşturuldu:", waiter.email);

  // Kategoriler oluştur
  const catSicakIcecekler = await prisma.category.upsert({
    where: { id: "cat-sicak-icecek" },
    update: {},
    create: {
      id: "cat-sicak-icecek",
      businessId: business.id,
      name: "Sıcak İçecekler",
      icon: "☕",
      sortOrder: 1,
      isActive: true,
    },
  });

  const catSogukIcecekler = await prisma.category.upsert({
    where: { id: "cat-soguk-icecek" },
    update: {},
    create: {
      id: "cat-soguk-icecek",
      businessId: business.id,
      name: "Soğuk İçecekler",
      icon: "🥤",
      sortOrder: 2,
      isActive: true,
    },
  });

  const catYiyecekler = await prisma.category.upsert({
    where: { id: "cat-yiyecek" },
    update: {},
    create: {
      id: "cat-yiyecek",
      businessId: business.id,
      name: "Yiyecekler",
      icon: "🍽️",
      sortOrder: 3,
      isActive: true,
    },
  });

  const catTatlilar = await prisma.category.upsert({
    where: { id: "cat-tatli" },
    update: {},
    create: {
      id: "cat-tatli",
      businessId: business.id,
      name: "Tatlılar",
      icon: "🍰",
      sortOrder: 4,
      isActive: true,
    },
  });

  console.log("✅ Kategoriler oluşturuldu");

  // Ürünler oluştur
  const products = [
    // Sıcak İçecekler
    {
      id: "prod-turk-kahvesi",
      name: "Türk Kahvesi",
      description: "Geleneksel Türk kahvesi, ince öğütülmüş kahve çekirdeği ile hazırlanır",
      ingredients: "Kahve çekirdeği, su",
      allergens: null,
      price: 45,
      categoryId: "cat-sicak-icecek",
      isPopular: true,
    },
    {
      id: "prod-latte",
      name: "Latte",
      description: "Espresso üzerine buharla ısıtılmış süt",
      ingredients: "Espresso, süt",
      allergens: "Süt ürünleri",
      price: 65,
      categoryId: "cat-sicak-icecek",
      isPopular: true,
    },
    {
      id: "prod-cay",
      name: "Çay",
      description: "Demlik çay, Rize çayı",
      ingredients: "Çay",
      allergens: null,
      price: 15,
      categoryId: "cat-sicak-icecek",
      isPopular: true,
    },
    {
      id: "prod-cappuccino",
      name: "Cappuccino",
      description: "Espresso, buharla ısıtılmış süt ve süt köpüğü",
      ingredients: "Espresso, süt",
      allergens: "Süt ürünleri",
      price: 70,
      categoryId: "cat-sicak-icecek",
      isPopular: false,
    },
    {
      id: "prod-sicak-cikolata",
      name: "Sıcak Çikolata",
      description: "Gerçek çikolata ile hazırlanan sıcak çikolata",
      ingredients: "Çikolata, süt, şeker",
      allergens: "Süt ürünleri",
      price: 55,
      categoryId: "cat-sicak-icecek",
      isPopular: false,
    },
    // Soğuk İçecekler
    {
      id: "prod-ayran",
      name: "Ayran",
      description: "Taze yapılmış soğuk ayran",
      ingredients: "Yoğurt, su, tuz",
      allergens: "Süt ürünleri",
      price: 20,
      categoryId: "cat-soguk-icecek",
      isPopular: true,
    },
    {
      id: "prod-limonata",
      name: "Limonata",
      description: "Taze sıkılmış ev yapımı limonata",
      ingredients: "Limon, su, şeker, nane",
      allergens: null,
      price: 35,
      categoryId: "cat-soguk-icecek",
      isPopular: true,
    },
    {
      id: "prod-ice-tea",
      name: "Ice Tea",
      description: "Soğuk çay, şeftali aromalı",
      ingredients: "Çay, şeftali aroması, şeker",
      allergens: null,
      price: 30,
      categoryId: "cat-soguk-icecek",
      isPopular: false,
    },
    // Yiyecekler
    {
      id: "prod-tost",
      name: "Tost",
      description: "Kaşarlı karışık tost",
      ingredients: "Tost ekmeği, kaşar peyniri, domates, salatalık",
      allergens: "Gluten, Süt ürünleri",
      price: 60,
      categoryId: "cat-yiyecek",
      isPopular: true,
    },
    {
      id: "prod-hamburger",
      name: "Hamburger",
      description: "El yapımı köfte, taze sebzeler ve özel sos ile",
      ingredients: "Dana kıyma, marul, domates, soğan, turşu, hamburger ekmeği",
      allergens: "Gluten",
      price: 120,
      categoryId: "cat-yiyecek",
      isPopular: true,
    },
    {
      id: "prod-izgara-kofte",
      name: "Izgara Köfte",
      description: "Özel baharatlarla hazırlanmış el yapımı köfte",
      ingredients: "Dana kıyma, soğan, maydanoz, baharatlar",
      allergens: "Gluten",
      price: 130,
      categoryId: "cat-yiyecek",
      isPopular: true,
    },
    {
      id: "prod-tavuk-sis",
      name: "Tavuk Şiş",
      description: "Marine edilmiş tavuk göğsü şiş",
      ingredients: "Tavuk göğsü, zeytinyağı, limon, baharatlar",
      allergens: null,
      price: 110,
      categoryId: "cat-yiyecek",
      isPopular: false,
    },
    {
      id: "prod-karisik-pizza",
      name: "Karışık Pizza",
      description: "Bol malzemeli karışık pizza",
      ingredients: "Un, domates sosu, mozzarella, sucuk, mantar, biber",
      allergens: "Gluten, Süt ürünleri",
      price: 150,
      categoryId: "cat-yiyecek",
      isPopular: false,
    },
    // Tatlılar
    {
      id: "prod-cheesecake",
      name: "Cheesecake",
      description: "New York usulü klasik cheesecake",
      ingredients: "Krem peynir, bisküvi, tereyağı, şeker",
      allergens: "Gluten, Süt ürünleri",
      price: 85,
      categoryId: "cat-tatli",
      isPopular: true,
    },
    {
      id: "prod-sutlac",
      name: "Sütlaç",
      description: "Fırında pişirilmiş geleneksel sütlaç",
      ingredients: "Süt, pirinç, şeker, vanilya",
      allergens: "Süt ürünleri",
      price: 55,
      categoryId: "cat-tatli",
      isPopular: true,
    },
    {
      id: "prod-baklava",
      name: "Baklava",
      description: "Antep fıstıklı ev yapımı baklava",
      ingredients: "Yufka, tereyağı, antep fıstığı, şerbet",
      allergens: "Gluten, Fındık",
      price: 75,
      categoryId: "cat-tatli",
      isPopular: false,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {},
      create: {
        id: product.id,
        businessId: business.id,
        categoryId: product.categoryId,
        name: product.name,
        description: product.description,
        ingredients: product.ingredients,
        allergens: product.allergens,
        price: product.price,
        isAvailable: true,
        isPopular: product.isPopular,
      },
    });
  }

  console.log("✅ Ürünler oluşturuldu (" + products.length + " adet)");

  // Masalar oluştur (QR token ile)
  const tableNames = [
    "Masa 1", "Masa 2", "Masa 3", "Masa 4",
    "Bahçe 1", "Bahçe 2", "Teras 1", "Teras 2",
    "VIP 1", "VIP 2"
  ];

  for (let i = 0; i < tableNames.length; i++) {
    const tableNumber = `${i + 1}`;
    const qrToken = `qr_${business.slug}_${tableNumber}_${uuidv4().slice(0, 8)}`;

    await prisma.table.upsert({
      where: {
        businessId_tableNumber: {
          businessId: business.id,
          tableNumber,
        },
      },
      update: {
        tableName: tableNames[i],
        qrToken: undefined, // don't overwrite existing tokens
      },
      create: {
        businessId: business.id,
        tableNumber,
        tableName: tableNames[i],
        status: TableStatus.EMPTY,
        qrToken,
      },
    });
  }

  console.log("✅ " + tableNames.length + " masa oluşturuldu");

  // Davet kodları oluştur
  const inviteCodes = ["DEMO2024", "GARSON001", "GARSON002"];
  for (const code of inviteCodes) {
    await prisma.waiterInvite.upsert({
      where: { inviteCode: code },
      update: {},
      create: {
        businessId: business.id,
        inviteCode: code,
        isUsed: code === "DEMO2024", // İlk kodu kullanılmış olarak işaretle
      },
    });
  }

  console.log("✅ Davet kodları oluşturuldu: " + inviteCodes.join(", "));

  console.log("\n🎉 Seed tamamlandı!");
  console.log("─────────────────────────────────");
  console.log("Admin giriş bilgileri:");
  console.log("  E-posta: admin@demo.com");
  console.log("  Şifre:   admin123");
  console.log("\nGarson giriş bilgileri:");
  console.log("  E-posta: garson@demo.com");
  console.log("  Şifre:   garson123");
  console.log("\nGarson davet kodları: GARSON001, GARSON002");
  console.log("Demo işletme slug: demo-kafe");
  console.log("─────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
