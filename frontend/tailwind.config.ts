import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      colors: {
        ink: {
          DEFAULT: "#0A0A0A",
          soft: "#1A1A1A",
          muted: "#404040",
        },
        cream: {
          DEFAULT: "#F7F4EE",
          warm: "#EDE9E0",
          border: "#D8D3C8",
        },
        ember: {
          DEFAULT: "#E8450A",
          light: "#FF6B35",
          dark: "#C03A08",
        },
        sage: {
          DEFAULT: "#4A7C59",
          light: "#6B9E7A",
        },
        gold: {
          DEFAULT: "#C5A028",
          light: "#E8C04A",
        },
      },
      animation: {
        "slide-up": "slideUp 0.5s ease forwards",
        "fade-in": "fadeIn 0.4s ease forwards",
        "scale-in": "scaleIn 0.3s ease forwards",
      },
      keyframes: {
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
