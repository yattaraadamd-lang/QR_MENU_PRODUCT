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
];
