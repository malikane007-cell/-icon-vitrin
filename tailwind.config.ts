import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vitrinbg: "#0b0e17",
        vitrinpanel: "#11151f",
        altin: "#fbbf24", // canlı/parlak "business sarı" (Tailwind amber-400)
      },
    },
  },
  plugins: [],
};

export default config;
