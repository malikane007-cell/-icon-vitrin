import { iconilanSupabase } from "@/lib/iconilan-supabase";

export type OfisIlani = {
  id: string;
  durum: string;
  durumEtiketi: string;
  baslik: string;
  konum: string;
  metrekare: number | null;
  odaSayisi: string | null;
  kat: string | null;
  fiyat: number | null;
  paraBirimi: string;
  ozellikler: string[];
  isitma: string | null;
  iskanDurumu: string | null;
  fotograflar: string[];
  videoUrl: string | null;
  ilanLinki: string;
};

const LISTING_TYPE_LABELS: Record<string, string> = {
  satilik: "Satılık",
  kiralik: "Kiralık",
  gunluk_kiralik: "Günlük Kiralık",
  devren_satilik: "Devren Satılık",
};

// TV vitrininde gösterilecek ofis — iconilan.com'daki listings.office_name
// alanıyla eşleştiriliyor. Farklı büyük/küçük harf ya da ek kelime
// varyasyonlarını da yakalamak için "içeriyor" (ilike + %) araması kullanıyoruz.
const OFIS_ADI_FILTRESI = "%Ak Emlak%";

function capitalizeWords(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .split(" ")
    .map((w) => (w ? w.charAt(0).toLocaleUpperCase("tr-TR") + w.slice(1) : w))
    .join(" ");
}

function konumMetni(neighborhood: string | null, district: string, city: string) {
  return [neighborhood, district, city]
    .filter(Boolean)
    .map((s) => capitalizeWords(s as string))
    .join(", ");
}

export async function getVitrinIlanlari(limit = 20): Promise<OfisIlani[]> {
  const { data, error } = await iconilanSupabase
    .from("listings")
    .select(
      "id, title, price, currency, listing_type, city, district, neighborhood, room_count, gross_m2, floor_location, heating_type, occupancy_status, features, images, video_url, office_name, is_boosted, created_at"
    )
    .eq("is_published", true)
    .or("published_until.is.null,published_until.gt." + new Date().toISOString())
    .ilike("office_name", OFIS_ADI_FILTRESI)
    .order("is_boosted", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("iconilan.com ilanları çekilirken hata oluştu:", error.message);
    return [];
  }

  // NOT: Sadece "is_boosted + en yeni" sırasına göre ilk N ilanı almak,
  // bir tür (örn. kiralık) diğerinden (satılık) daha yeni/öne çıkan
  // olduğunda vitrinde SADECE o türün dönmesine yol açıyordu. Bunun
  // yerine önce türlere göre grupluyoruz, sonra türler arasında sırayla
  // (round-robin) seçim yaparak her türden ilanın vitrine yansımasını
  // garanti ediyoruz — her grup kendi içinde yine boost/en yeni sırasında.
  const turGruplari = new Map<string, any[]>();
  for (const row of data ?? []) {
    const grup = turGruplari.get(row.listing_type) ?? [];
    grup.push(row);
    turGruplari.set(row.listing_type, grup);
  }
  const gruplar = Array.from(turGruplari.values());
  const siraliVeri: any[] = [];
  let i = 0;
  while (siraliVeri.length < limit) {
    let bugunEklendi = false;
    for (const grup of gruplar) {
      if (i < grup.length) {
        siraliVeri.push(grup[i]);
        bugunEklendi = true;
        if (siraliVeri.length >= limit) break;
      }
    }
    if (!bugunEklendi) break; // tüm gruplar tükendi
    i++;
  }

  return siraliVeri.map((row: any) => ({
    id: row.id,
    durum: row.listing_type,
    durumEtiketi: LISTING_TYPE_LABELS[row.listing_type] ?? row.listing_type,
    baslik: row.title,
    konum: konumMetni(row.neighborhood, row.district, row.city),
    metrekare: row.gross_m2,
    odaSayisi: row.room_count,
    kat: row.floor_location,
    fiyat: row.price,
    paraBirimi: row.currency === "TRY" ? "TL" : row.currency,
    ozellikler: row.features ?? [],
    isitma: row.heating_type,
    iskanDurumu: row.occupancy_status,
    fotograflar: row.images ?? [],
    videoUrl: row.video_url ?? null,
    ilanLinki: `https://iconilan.com/ilan/${row.id}`,
  }));
}
