// Erişilebilirlik, hook, inline style ve katman kapıları. CI'da `npm run lint:a11y` olarak
// çalışır; hata varsa PR kırmızıya düşer.
import { readdirSync } from "node:fs";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";

// ─── Katman kapısı (FE-ARCH-1.1) ─────────────────────────────────────────────
// shared ← entities ← features ← app. Kabuklar (*-shell) ve components/*.tsx app katmanındadır.
// Üst katman alttakini import edebilir; tersi ve aynı katmanda yan yana import yasaktır.
const SHARED = ["ui", "brand", "staff"];
// Varlık sırası: soldaki sağdakini import edemez (requests, tables ve payments'ı kullanır)
const ENTITIES = ["payments", "tables", "orders", "categories", "subscription", "requests"];
const SHELLS = ["admin-shell", "waiter-shell", "super-admin-shell"];
const FEATURES = [
  "admin-categories", "admin-dashboard", "admin-orders", "admin-payments", "admin-products",
  "admin-requests", "admin-settings", "admin-staff", "admin-subscription", "admin-tables", "auth",
  "blocked-devices", "customer-menu", "landing", "notifications", "pending-payments",
  "super-admin-businesses", "super-admin-platform", "waiter-orders", "waiter-payments",
  "waiter-requests", "waiter-tables",
];
// İstisna listesi yok (FE-ARCH-2.2): iki özelliğin ortak ihtiyacı bir varlığa ya da ui'ye iner.

// Yeni bir klasör katmanı belirtilmeden kuralların dışında kalmasın
const classified = new Set([...SHARED, ...ENTITIES, ...SHELLS, ...FEATURES]);
const unclassified = readdirSync(new URL("./src/components", import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !classified.has(entry.name))
  .map((entry) => entry.name);
if (unclassified.length > 0) {
  throw new Error(`eslint.config.mjs: katmanı tanımsız klasör: ${unclassified.join(", ")} (SHARED/ENTITIES/SHELLS/FEATURES)`);
}

const importGlobs = (folders) => folders.flatMap((folder) => [`@/components/${folder}/**`, `../${folder}/**`]);

function layer(folder, banned, message) {
  const group = importGlobs(banned.filter((name) => name !== folder));
  return {
    files: [`src/components/${folder}/**/*.{ts,tsx}`],
    rules: { "no-restricted-imports": ["error", { patterns: [{ group, message }] }] },
  };
}

const layerRules = [
  ...SHARED.map((folder) =>
    layer(folder, [...ENTITIES, ...FEATURES, ...SHELLS], "Paylaşılan katman (ui, brand, staff) özellik ya da varlık import edemez."),
  ),
  ...ENTITIES.map((folder, index) =>
    layer(
      folder,
      [...ENTITIES.slice(index + 1), ...FEATURES, ...SHELLS],
      "Varlık; özellik, kabuk ya da ENTITIES listesinde kendinden sonra gelen varlığı import edemez.",
    ),
  ),
  ...FEATURES.map((folder) =>
    layer(folder, [...FEATURES, ...SHELLS], "Özellikler birbirini import etmez. Ortak parçayı bir varlığa ya da components/ui'ye taşıyın."),
  ),
  {
    files: ["src/hooks/**/*.{ts,tsx}", "src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/**", "@/contexts/**"],
              message: "hooks/ ve lib/ paylaşılan katmandır; components ya da contexts import edemez.",
            },
          ],
        },
      ],
    },
  },
  // İstemci kodunda any yok (sunucu tarafı FE-ARCH-3.6 ile)
  {
    files: ["src/components/**/*.{ts,tsx}", "src/hooks/**/*.{ts,tsx}", "src/contexts/**/*.{ts,tsx}", "src/app/**/*.tsx"],
    plugins: { "@typescript-eslint": tsPlugin },
    rules: { "@typescript-eslint/no-explicit-any": "error" },
  },
];

export default [
  { ignores: [".next/**", "node_modules/**", "maturity-audit/**", "scripts/**", "prisma/**"] },
  // Koddaki disable yorumları başka kural setleri için; burada "kullanılmıyor" uyarısı gürültü olur
  { linterOptions: { reportUnusedDisableDirectives: "off" } },
  {
    ...jsxA11y.flatConfigs.recommended,
    files: ["src/**/*.{jsx,tsx}"],
    languageOptions: {
      ...jsxA11y.flatConfigs.recommended.languageOptions,
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  // Hook kuralları. lint:a11y --max-warnings=0 ile çalıştığı için uyarı da CI'ı kırar.
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { parser: tsParser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  // Inline style kapısı (FE-ITEM-3.1, 1305 → 10). Statik değer Tailwind sınıfı ya da token olur:
  // :hover, medya sorgusu ve tema inline style'a uygulanmaz. Yardımcıdan gelen dinamik değer
  // (style={enterDelay(0.2)}) serbest. Literal gerekiyorsa satırda gerekçeyle:
  //   eslint-disable-next-line no-restricted-syntax -- neden çalışma anında hesaplanıyor
  {
    files: ["src/**/*.{jsx,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...[
          "ObjectExpression",
          // { ... } as CSSProperties
          "TSAsExpression > ObjectExpression",
          // style={FIELD_STYLE}: modül sabiti de statik değerdir
          "Identifier[name=/^[A-Z][A-Z0-9_]*$/]",
        ].map((value) => ({
          // overlayStyle, contentStyle gibi prop'lar da aynı kaçış
          selector: `JSXAttribute[name.name=/^(style|[a-zA-Z]+Style)$/] > JSXExpressionContainer > ${value}`,
          message:
            "Statik inline style yerine Tailwind sınıfı ya da token kullanın. Değer çalışma anında hesaplanıyorsa: // eslint-disable-next-line no-restricted-syntax -- neden",
        })),
      ],
    },
  },
  ...layerRules,
];
