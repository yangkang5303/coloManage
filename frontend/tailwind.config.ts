import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172026",
        line: "#d8dee4",
        panel: "#f7f9fb",
        action: "#1f6feb"
      }
    }
  },
  plugins: []
} satisfies Config;
