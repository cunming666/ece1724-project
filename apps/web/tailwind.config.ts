import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#F0FDFA",
          100: "#CCFBF1",
          200: "#99F6E4",
          300: "#5EEAD4",
          400: "#2DD4BF",
          500: "#14B8A6",
          600: "#0D9488",
          700: "#0F766E",
          800: "#115E59",
          900: "#134E4A",
          DEFAULT: "#0F766E",
          dark: "#115E59",
          light: "#2DD4BF"
        },
        accent: {
          soft: "#FFE8D6",
          warm: "#FFB06A",
          deep: "#D97706"
        }
      },
      fontFamily: {
        heading: ["Space Grotesk", "Noto Sans SC", "Microsoft YaHei", "sans-serif"],
        body: ["Manrope", "Noto Sans SC", "Microsoft YaHei", "sans-serif"]
      },
      boxShadow: {
        soft: "0 10px 30px -15px rgba(15, 118, 110, 0.35)",
        panel: "0 10px 25px -20px rgba(15, 23, 42, 0.55)"
      },
      keyframes: {
        fadeSlideIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "0.9" }
        }
      },
      animation: {
        "fade-slide": "fadeSlideIn 420ms ease-out both",
        "pulse-glow": "pulseGlow 3.4s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
