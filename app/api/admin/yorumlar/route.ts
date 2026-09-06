import { NextRequest, NextResponse } from "next/server";
import { oturumGecerliMi } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  if (!oturumGecerliMi()) {
    return NextResponse.json({ hata: "Yetkisiz." }, { status: 401 });
  }
  try {
    const { data, error } = await supabaseAdmin()
      .from("yorumlar")
      .select("*")
      .order("sira", { ascending: true });
    if (error) return NextResponse.json({ hata: error.message }, { status: 500 });
    return NextResponse.json({ yorumlar: data });
  } catch (e: any) {
    return NextResponse.json({ hata: e?.message ?? "Sunucu yapılandırma hatası." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!oturumGecerliMi()) {
    return NextResponse.json({ hata: "Yetkisiz." }, { status: 401 });
  }
  const { isim, yorum, sira } = await request.json();
  if (!isim || !yorum) {
    return NextResponse.json({ hata: "İsim ve yorum zorunlu." }, { status: 400 });
  }
  try {
    const { data, error } = await supabaseAdmin()
      .from("yorumlar")
      .insert({ isim, yorum, sira: sira ?? 0 })
      .select()
      .single();
    if (error) return NextResponse.json({ hata: error.message }, { status: 500 });
    return NextResponse.json({ yorum: data });
  } catch (e: any) {
    return NextResponse.json({ hata: e?.message ?? "Sunucu yapılandırma hatası." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!oturumGecerliMi()) {
    return NextResponse.json({ hata: "Yetkisiz." }, { status: 401 });
  }
  const { id, isim, yorum, sira } = await request.json();
  if (!id) return NextResponse.json({ hata: "id zorunlu." }, { status: 400 });

  const guncelleme: Record<string, unknown> = {};
  if (isim !== undefined) guncelleme.isim = isim;
  if (yorum !== undefined) guncelleme.yorum = yorum;
  if (sira !== undefined) guncelleme.sira = sira;

  try {
    const { data, error } = await supabaseAdmin()
      .from("yorumlar")
      .update(guncelleme)
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ hata: error.message }, { status: 500 });
    return NextResponse.json({ yorum: data });
  } catch (e: any) {
    return NextResponse.json({ hata: e?.message ?? "Sunucu yapılandırma hatası." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!oturumGecerliMi()) {
    return NextResponse.json({ hata: "Yetkisiz." }, { status: 401 });
  }
  const { id } = await request.json();
  if (!id) return NextResponse.json({ hata: "id zorunlu." }, { status: 400 });

  try {
    const { error } = await supabaseAdmin().from("yorumlar").delete().eq("id", id);
    if (error) return NextResponse.json({ hata: error.message }, { status: 500 });
    return NextResponse.json({ basarili: true });
  } catch (e: any) {
    return NextResponse.json({ hata: e?.message ?? "Sunucu yapılandırma hatası." }, { status: 500 });
  }
}
