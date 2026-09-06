import { NextRequest, NextResponse } from "next/server";
import { oturumGecerliMi } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const BUCKET_ADI = "vitrin-assets";

async function bucketHazirla() {
  const { data: mevcutBucketlar } = await supabaseAdmin().storage.listBuckets();
  const varMi = mevcutBucketlar?.some((b) => b.name === BUCKET_ADI);
  if (!varMi) {
    await supabaseAdmin().storage.createBucket(BUCKET_ADI, { public: true });
  }
}

export async function POST(request: NextRequest) {
  if (!oturumGecerliMi()) {
    return NextResponse.json({ hata: "Yetkisiz." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const dosya = formData.get("logo") as File | null;
    if (!dosya) {
      return NextResponse.json({ hata: "Dosya bulunamadı." }, { status: 400 });
    }

    await bucketHazirla();

    const uzanti = dosya.name.split(".").pop() || "png";
    const dosyaAdi = `logo/logo-${Date.now()}.${uzanti}`;
    const arrayBuffer = await dosya.arrayBuffer();

    const { error: yuklemeHatasi } = await supabaseAdmin()
      .storage.from(BUCKET_ADI)
      .upload(dosyaAdi, Buffer.from(arrayBuffer), {
        contentType: dosya.type || "image/png",
        upsert: true,
      });

    if (yuklemeHatasi) {
      return NextResponse.json({ hata: yuklemeHatasi.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin().storage.from(BUCKET_ADI).getPublicUrl(dosyaAdi);
    const logoUrl = publicUrlData.publicUrl;

    const { error: guncelHata } = await supabaseAdmin().from("ayarlar").update({ logo_url: logoUrl }).eq("id", 1);

    if (guncelHata) {
      return NextResponse.json({ hata: guncelHata.message }, { status: 500 });
    }

    return NextResponse.json({ logoUrl });
  } catch (e: any) {
    return NextResponse.json({ hata: e?.message ?? "Sunucu yapılandırma hatası." }, { status: 500 });
  }
}
