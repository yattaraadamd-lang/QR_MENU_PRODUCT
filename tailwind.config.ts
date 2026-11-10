import type { Config } from "tailwindcss";

type ColorFn = (opts: { opacityValue?: string }) => string;

/**
 * globals.css'teki bir token'a bağlı renk. Düz kullanımda (`text-success-fg`) token'ın
 * kendisi, saydamlıkla (`bg-danger/10`) color-mix üretir; tema değişince sınıflar da değişir.
 * Opaklık çekirdek eklentileri kapalı: yoksa Tailwind düz renkte de opaklık değişkeni geçirir.
 * Tailwind 3 renk fonksiyonunu çalışma zamanında destekler ama tip tanımı yalnız string
 * kabul eder; dönüşüm bu tek yerde.
 */
const token = (name: string): string => {
  const color: ColorFn = ({ opacityValue }) =>
    opacityValue === undefined
      ? `var(--${name})`
      : `color-mix(in srgb, var(--${name}) calc(${opacityValue} * 100%), transparent)`;
  return color as unknown as string;
};

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // globals.css @layer components'teki sınıf ancak kaynakta tam adıyla geçerse derlenir. Button
  // ve Badge varyantı çalışma anında kurar (`btn-${variant}`, `badge-${tone}`): aile burada
  // tutulur. Eşleme tablosu yerine safelist, çünkü Badge'e tone.ts'i taşıyıp her rotanın JS'ini büyütürdü.
  safelist: [{ pattern: /^(btn|badge)-/ }],
  corePlugins: {
    textOpacity: false,
    backgroundOpacity: false,
    borderOpacity: false,
    divideOpacity: false,
    placeholderOpacity: false,
    ringOpacity: false,
  },
  theme: {
    extend: {
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },
      colors: {
        // Anlamsal renkler: yalnız her temada tanımlı token adları (bileşen kodu temadan bağımsız)
        primary: {
          DEFAULT: token("primary"),
          on: token("on-primary"),
          dark: token("primary-dark"),
          light: token("primary-light"),
        },
        accent: { DEFAULT: token("accent"), light: token("accent-light") },
        success: { DEFAULT: token("success"), fg: token("success-text") },
        warning: { DEFAULT: token("warning"), fg: token("warning-text") },
        danger: { DEFAULT: token("danger"), fg: token("danger-text") },
        info: { DEFAULT: token("info"), fg: token("info-text") },
        purple: { DEFAULT: token("purple"), fg: token("purple-text") },
        surface: {
          DEFAULT: token("bg-card"),
          page: token("bg-primary"),
          muted: token("bg-secondary"),
          hover: token("bg-hover"),
          input: token("bg-input"),
        },
        fg: {
          DEFAULT: token("text-primary"),
          secondary: token("text-secondary"),
          muted: token("text-muted"),
        },
        line: { DEFAULT: token("border-color"), subtle: token("border-subtle") },
        focus: token("focus-ring"),
        // "Mahalle bistrosu" — değerler globals.css token'larıyla aynı (tek kaynak orası)
        tomato: {
          DEFAULT: "#D13C27",
          hover: "#B8341F",
          text: "#B8341F",
          soft: "#FDE4DE",
        },
        basil: {
          DEFAULT: "#2F6B4F",
          hover: "#26583F",
          soft: "#E1F0E7",
        },
        butter: {
          DEFAULT: "#F6C350",
          soft: "#FDF0CC",
        },
        cream: "#FFF9F2",
        ink: "#2A2420",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      animation: {
        "float": "float 3s ease-in-out infinite",
        "gradient-shift": "gradient-shift 6s ease infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "gradient-shift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
