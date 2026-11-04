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
];
