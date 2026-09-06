import { NextRequest, NextResponse } from "next/server";
import { oturumGecerliMi } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  if (!oturumGecerliMi()) {
    return NextResponse.json({ hata: "Yetkisiz." }, { status: 401 });
  }
  try {
    const { data, error } = await supabaseAdmin().from("ayarlar").select("*").eq("id", 1).maybeSingle();
    if (error) return NextResponse.json({ hata: error.message }, { status: 500 });
    return NextResponse.json({ ayarlar: data });
  } catch (e: any) {
    return NextResponse.json({ hata: e?.message ?? "Sunucu yapılandırma hatası." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!oturumGecerliMi()) {
    return NextResponse.json({ hata: "Yetkisiz." }, { status: 401 });
  }

  const gonderilen = await request.json();
  const izinliAlanlar = [
    "sirket_adi",
    "telefon",
    "website",
    "instagram",
    "ticker_metni",
    "google_puan",
    "google_yorum_sayisi",
  ];
  const guncelleme: Record<string, unknown> = {};
  for (const alan of izinliAlanlar) {
    if (alan in gonderilen) guncelleme[alan] = gonderilen[alan];
  }

  try {
    const { data, error } = await supabaseAdmin()
      .from("ayarlar")
      .update(guncelleme)
      .eq("id", 1)
      .select()
      .maybeSingle();

    if (error) return NextResponse.json({ hata: error.message }, { status: 500 });
    return NextResponse.json({ ayarlar: data });
  } catch (e: any) {
    return NextResponse.json({ hata: e?.message ?? "Sunucu yapılandırma hatası." }, { status: 500 });
  }
}
