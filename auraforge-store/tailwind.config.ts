import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: "#05060A",
          900: "#0A0C12",
          850: "#0E1119",
          800: "#131722",
          700: "#1B2030",
          600: "#262C40",
          500: "#363E57",
        },
        neon: {
          cyan: "#22F3FF",
          violet: "#A855F7",
          lime: "#B6FF3B",
          magenta: "#FF2BD6",
        },
        ink: {
          100: "#F2F5FA",
          300: "#B9C1D3",
          400: "#8B93A8",
          500: "#646C82",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        neon: "0 0 0 1px rgba(34,243,255,0.35), 0 0 24px -4px rgba(34,243,255,0.45)",
        "neon-violet": "0 0 0 1px rgba(168,85,247,0.4), 0 0 28px -6px rgba(168,85,247,0.55)",
        panel: "0 24px 60px -24px rgba(0,0,0,0.8)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(34,243,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(34,243,255,0.06) 1px, transparent 1px)",
      },
      keyframes: {
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "slide-in-right": "slide-in-right 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)",
        "slide-in-left": "slide-in-left 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)",
        "fade-in": "fade-in 0.2s ease-out",
        scan: "scan 6s linear infinite",
        "pulse-glow": "pulseGlow 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
