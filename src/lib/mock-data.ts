// Mock data for demo without database

export const mockBusiness = {
  id: "demo-business-id",
  name: "Demo Restoran",
  description: "QR Menü Demo İşletmesi",
  phone: "+90 555 000 0000",
  email: "demo@qrmenu.com",
  address: "İstanbul, Türkiye",
};

export const mockCategories = [
  {
    id: "cat-yiyecek",
    name: "Yiyecekler",
    icon: "🍽️",
    sortOrder: 1,
    products: [
      {
        id: "prod-1",
        name: "Izgara Köfte",
        description: "Özel baharatlarla hazırlanmış el yapımı köfte",
        ingredients: "Dana kıyma, soğan, maydanoz, baharatlar",
        allergens: "Gluten",
        price: 120,
        isAvailable: true,
        isPopular: true,
      },
      {
        id: "prod-2",
        name: "Tavuk Şiş",
        description: "Marine edilmiş tavuk göğsü şiş",
        ingredients: "Tavuk göğsü, zeytinyağı, limon, baharatlar",
        allergens: null,
        price: 110,
        isAvailable: true,
        isPopular: true,
      },
      {
        id: "prod-3",
        name: "Karışık Pizza",
        description: "Bol malzemeli karışık pizza",
        ingredients: "Un, domates sosu, mozzarella, sucuk, mantar, biber",
        allergens: "Gluten, Süt ürünleri",
        price: 150,
        isAvailable: true,
        isPopular: false,
      },
    ],
  },
  {
    id: "cat-icecek",
    name: "İçecekler",
    icon: "🥤",
    sortOrder: 2,
    products: [
      {
        id: "prod-4",
        name: "Ayran",
        description: "Taze yapılmış soğuk ayran",
        ingredients: "Yoğurt, su, tuz",
        allergens: "Süt ürünleri",
        price: 20,
        isAvailable: true,
        isPopular: true,
      },
      {
        id: "prod-5",
        name: "Türk Çayı",
        description: "Demlik çay",
        ingredients: "Çay",
        allergens: null,
        price: 15,
        isAvailable: true,
        isPopular: false,
      },
      {
        id: "prod-6",
        name: "Limonata",
        description: "Taze sıkılmış limonata",
        ingredients: "Limon, su, şeker, nane",
        allergens: null,
        price: 35,
        isAvailable: true,
        isPopular: true,
      },
    ],
  },
  {
    id: "cat-tatli",
    name: "Tatlılar",
    icon: "🍰",
    sortOrder: 3,
    products: [
      {
        id: "prod-7",
        name: "Sütlaç",
        description: "Fırında pişirilmiş geleneksel sütlaç",
        ingredients: "Süt, pirinç, şeker, vanilya",
        allergens: "Süt ürünleri",
        price: 55,
        isAvailable: true,
        isPopular: true,
      },
      {
        id: "prod-8",
        name: "Baklava",
        description: "Antep fıstıklı ev yapımı baklava",
        ingredients: "Yufka, tereyağı, antep fıstığı, şerbet",
        allergens: "Gluten, Fındık",
        price: 75,
        isAvailable: true,
        isPopular: false,
      },
    ],
  },
];

export const mockTable = {
  id: "table-1",
  tableNumber: "1",
  status: "EMPTY",
};

export const mockPopularProducts = mockCategories
  .flatMap((cat) => cat.products)
  .filter((p) => p.isPopular);
