import { NextResponse } from "next/server";

// Google Places API üzerinden gerçek işletme puanı + yorumlarını otomatik
// çeker. GOOGLE_PLACES_API_KEY ve GOOGLE_PLACE_ID ortam değişkenleri
// tanımlanana kadar { aktif: false } döner ve ekran otomatik olarak
// Supabase'teki "ayarlar"/"yorumlar" tablolarındaki elle girilmiş verilere
// geri düşer (bkz. components/Vitrin.tsx).
export async function GET() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (!apiKey || !placeId) {
    return NextResponse.json({ aktif: false });
  }

  try {
    const url =
      "https://maps.googleapis.com/maps/api/place/details/json" +
      `?place_id=${encodeURIComponent(placeId)}` +
      "&fields=rating,user_ratings_total,reviews" +
      "&language=tr" +
      `&key=${apiKey}`;

    // 6 saatte bir tazeleniyor: Google Places API'de yorum/puan içeren
    // "Place Details Enterprise" çağrısının ücretsiz kotası ayda sadece 1000
    // istek (2025'te Google'ın genel 200$'lık aylık kredisi kaldırıldı, artık
    // her API için ayrı ve daha düşük bir ücretsiz kota var). Günde 4 çağrı
    // (~120/ay) bu kotanın çok altında kalıyor.
    const res = await fetch(url, { next: { revalidate: 21600 } });
    const veri = await res.json();

    if (veri.status !== "OK") {
      console.error("Google Places API hatası:", veri.status, veri.error_message);
      return NextResponse.json({ aktif: false });
    }

    const sonuc = veri.result ?? {};
    return NextResponse.json({
      aktif: true,
      puan: sonuc.rating ?? null,
      yorumSayisi: sonuc.user_ratings_total ?? null,
      yorumlar: (sonuc.reviews ?? []).slice(0, 4).map((y: any) => ({
        isim: y.author_name,
        yorum: y.text,
        puan: y.rating,
      })),
    });
  } catch (e) {
    console.error("Google yorumları alınırken hata oluştu:", e);
    return NextResponse.json({ aktif: false });
  }
}
