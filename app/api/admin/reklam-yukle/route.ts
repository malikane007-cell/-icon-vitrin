import { NextRequest, NextResponse } from "next/server";
import { oturumGecerliMi } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Reklam dosyaları Supabase Storage'daki "reklamlar" bucket'ına yükleniyor
// (bkz. supabase-schema.sql — bucket + public okuma politikası orada
// oluşturuluyor). Dosya adı çakışmasın diye zaman damgası ekleniyor.
export async function POST(request: NextRequest) {
  if (!oturumGecerliMi()) {
    return NextResponse.json({ hata: "Yetkisiz." }, { status: 401 });
  }
  try {
    const formData = await request.formData();
    const dosya = formData.get("reklam") as File | null;
    const turHam = formData.get("tur") as string | null;
    const tur = turHam === "video" ? "video" : "gorsel";
    const sureStr = formData.get("sure_saniye") as string | null;

    if (!dosya) {
      return NextResponse.json({ hata: "Dosya bulunamadı." }, { status: 400 });
    }

    const uzanti = dosya.name.includes(".")
      ? dosya.name.split(".").pop()
      : tur === "video"
      ? "mp4"
      : "jpg";
    const dosyaAdi = `reklam-${Date.now()}.${uzanti}`;
    const arrayBuffer = await dosya.arrayBuffer();

    const { error: yuklemeHata } = await supabaseAdmin()
      .storage.from("reklamlar")
      .upload(dosyaAdi, arrayBuffer, {
        contentType: dosya.type || undefined,
        upsert: true,
      });
    if (yuklemeHata) {
      return NextResponse.json({ hata: yuklemeHata.message }, { status: 500 });
    }

    const { data: urlVeri } = supabaseAdmin().storage.from("reklamlar").getPublicUrl(dosyaAdi);

    const { data, error } = await supabaseAdmin()
      .from("reklamlar")
      .insert({
        tur,
        medya_url: urlVeri.publicUrl,
        sure_saniye: tur === "gorsel" ? (sureStr ? Number(sureStr) : 10) : null,
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