// Erişilebilirlik kapısı: jsx-a11y "recommended" kuralları hata seviyesinde.
// CI'da `npm run lint:a11y` olarak çalışır; hata varsa PR kırmızıya düşer.
import tsParser from "@typescript-eslint/parser";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";

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
  // Kodda react-hooks kuralları için disable yorumları var; eklenti kayıtlı
  // olmazsa ESLint "kural bulunamadı" hatası verir. Kurallar burada açılmaz.
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { parser: tsParser },
    plugins: { "react-hooks": reactHooks },
  },
];
