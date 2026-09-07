// Ofis ilanları artık iconilan.com'dan otomatik geliyor — bkz. lib/iconilan-listings.ts (OfisIlani tipi).

export type Ayarlar = {
  id: number;
  sirket_adi: string;
  logo_url: string | null;
  google_puan: number | null;
  google_yorum_sayisi: number | null;
  telefon: string | null;
  website: string | null;
  instagram: string | null;
  ticker_metni: string | null;
};

export type Yorum = {
  id: string;
  isim: string;
  yorum: string;
  sira: number;
};

export type GoogleYorumYaniti = {
  aktif: boolean;
  puan?: number | null;
  yorumSayisi?: number | null;
  yorumlar?: { isim: string; yorum: string; puan: number }[];
};

// YENİ: Reklam alanı — admin panelinden görsel veya video olarak
// eklenip/silinebilen, ekranda her ILAN_ARASI_REKLAM_SIKLIGI (bkz.
// components/Vitrin.tsx) ilanda bir otomatik gösterilen reklam kayıtları.
export type Reklam = {
  id: string;
  tur: "gorsel" | "video";
  medya_url: string;
  sure_saniye: number | null; // sadece "gorsel" türünde kullanılır — video kendi doğal süresini (onEnded) kullanır
  sira: number;
};