import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // "Kor & Mürekkep" — değerler globals.css token'larıyla aynı (tek kaynak orası)
      colors: {
        ember: {
          DEFAULT: "#FF5A1F",
          hover: "#FF7A3D",
          soft: "#FF8A4C",
          deep: "#B83A0B",
        },
        ink: {
          DEFAULT: "#0F0D0B",
          900: "#0F0D0B",
          850: "#161310",
          800: "#1D1915",
          700: "#27221D",
          600: "#342D27",
        },
        paper: {
          DEFAULT: "#F6F0E8",
          card: "#FFFDF9",
          line: "#E3D7C8",
        },
        bone: "#F5EEE6",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
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
