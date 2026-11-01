import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // "Mahalle bistrosu" — değerler globals.css token'larıyla aynı (tek kaynak orası)
      colors: {
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
