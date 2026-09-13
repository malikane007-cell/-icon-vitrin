import { NextRequest, NextResponse } from "next/server";
import { oturumGecerliMi } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// ÖNEMLİ — DEĞİŞTİ: Reklam dosyası (özellikle video) artık BU route'a
// yüklenmiyor. Eskiden dosyanın tamamı burada (Vercel Serverless Function
// içinde) işleniyordu, ama Vercel'in sunucusuz fonksiyonlarda sabit ve
// KOD/CONFIG İLE ARTIRILAMAYAN ~4.5MB'lık bir istek gövdesi sınırı var —
// birkaç MB'ı geçen her video "413 Payload Too Large" ile REDDEDİLİYORDU
// (ve bu hata JSON değil düz metin geldiği için istemci tarafında da
// "Unexpected token... is not valid JSON" şeklinde ikinci bir hataya yol
// açıyordu). Çözüm: dosya artık TARAYICIDAN DOĞRUDAN Supabase Storage'a
// yükleniyor (bkz. app/admin/page.tsx — reklamYukle fonksiyonu,
// supabase.storage.from("reklamlar").upload(...) çağrısı; bucket'ın anon
// yükleme politikası zaten supabase-schema.sql'de tanımlı). Bu route artık
// SADECE dosya yüklendikten SONRA, oluşan (küçük) medya URL'ini "reklamlar"
// tablosuna kaydediyor — gövdesi birkaç yüz bayt olan bir JSON isteği,
// dolayısıyla 413 riski tamamen ortadan kalkıyor.
export async function POST(request: NextRequest) {
  if (!oturumGecerliMi()) {
    return NextResponse.json({ hata: "Yetkisiz." }, { status: 401 });
  }
  try {
    const { tur: turHam, medya_url, sure_saniye } = await request.json();
    const tur = turHam === "video" ? "video" : "gorsel";

    if (!medya_url || typeof medya_url !== "string") {
      return NextResponse.json({ hata: "medya_url zorunlu." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin()
      .from("reklamlar")
      .insert({
        tur,
        medya_url,
        sure_saniye: tur === "gorsel" ? (sure_saniye ? Number(sure_saniye) : 10) : null,
        sira: 0,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ hata: error.message }, { status: 500 });

    return NextResponse.json({ reklam: data });
  } catch (e: any) {
    return NextResponse.json({ hata: e?.message ?? "Sunucu yapılandırma hatası." }, { status: 500 });
  }
}
