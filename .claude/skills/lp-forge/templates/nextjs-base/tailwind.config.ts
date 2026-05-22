import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "var(--brand-primary)",
          accent: "var(--brand-accent)",
          ink: "var(--brand-ink)",
          surface: "var(--brand-surface)"
        }
      },
      fontFamily: {
        display: "var(--font-display)",
        body: "var(--font-body)"
      }
    }
  },
  plugins: []
};

export default config;
