import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eef2ff",
          100: "#e0e7ff",
          500: "#1e40af",
          600: "#1e3a8a",
        },
        accent: {
          100: "#e0f2fe",
          500: "#0ea5e9",
          600: "#0284c7",
        },
      },
    },
  },
  plugins: [],
};

export default config;
