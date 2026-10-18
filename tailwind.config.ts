import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paprika — ana marka rengi (iştah açıcı kırmızı-turuncu)
        primary: {
          50:  "#FFF4EF",
          100: "#FFE5D9",
          200: "#FFC8B0",
          300: "#FCA27F",
          400: "#F47A50",
          500: "#E85A30",
          600: "#D9441F",
          700: "#B23415",
          800: "#8C2A14",
          900: "#6E2414",
        },
        // Domates — aksan
        accent: {
          50:  "#FEF2F1",
          100: "#FDE3E1",
          200: "#FBC9C5",
          300: "#F6A19A",
          400: "#EC6D62",
          500: "#DC4136",
          600: "#C42E23",
          700: "#B3261E",
          800: "#8F2019",
          900: "#741D18",
        },
        // Safran / hardal — sıcaklık ve uyarılar
        saffron: {
          50:  "#FFFAEB",
          100: "#FEF0C7",
          200: "#FDE08A",
          300: "#FBCB4D",
          400: "#F8B629",
          500: "#F4A623",
          600: "#D9820B",
          700: "#B4600C",
          800: "#924A10",
          900: "#783D11",
        },
        // Fesleğen — tazelik ve başarı durumları
        basil: {
          50:  "#F0F9F1",
          100: "#DCF1DF",
          200: "#BBE2C1",
          300: "#8ECC98",
          400: "#5CAF6B",
          500: "#3B9A55",
          600: "#2E8B47",
          700: "#24713A",
          800: "#1F5A31",
          900: "#1A4A2A",
        },
        cream: "#FFF8F1",
        // Espresso — koyu panel tonları
        coffee: {
          50:  "#FFF8F1",
          100: "#F8ECE1",
          200: "#F0DFD0",
          300: "#C3A893",
          400: "#A68A78",
          500: "#85705F",
          600: "#6E4F3F",
          700: "#3D2E26",
          800: "#281E19",
          900: "#17110E",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
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
