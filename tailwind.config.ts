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
        // "Parlak altın" tonu — fiyat kutusu ve altın kenarlıklarla aynı
        // aileden, önceki düz amber-400 (#fbbf24) yerine daha sıcak/canlı
        // bir ton (kullanıcının onayladığı #b8860b→#ffd700 gradyanına yakın).
        altin: "#f2b807",
      },
    },
  },
  plugins: [],
};

export default config;