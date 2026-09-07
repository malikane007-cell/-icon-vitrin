import { NextRequest, NextResponse } from "next/server";
import { oturumGecerliMi } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  if (!oturumGecerliMi()) {
    return NextResponse.json({ hata: "Yetkisiz." }, { status: 401 });
  }
  try {
    const { data, error } = await supabaseAdmin()
      .from("reklamlar")
      .select("*")
      .order("sira", { ascending: true });
    if (error) return NextResponse.json({ hata: error.message }, { status: 500 });
    return NextResponse.json({ reklamlar: data });
  } catch (e: any) {
    return NextResponse.json({ hata: e?.message ?? "Sunucu yapılandırma hatası." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!oturumGecerliMi()) {
    return NextResponse.json({ hata: "Yetkisiz." }, { status: 401 });
  }
  const { id, sira, sure_saniye } = await request.json();
  if (!id) return NextResponse.json({ hata: "id zorunlu." }, { status: 400 });

  const guncelleme: Record<string, unknown> = {};
  if (sira !== undefined) guncelleme.sira = sira;
  if (sure_saniye !== undefined) guncelleme.sure_saniye = sure_saniye;

  try {
    const { data, error } = await supabaseAdmin()
      .from("reklamlar")
      .update(guncelleme)
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ hata: error.message }, { status: 500 });
    return NextResponse.json({ reklam: data });
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
    const { error } = await supabaseAdmin().from("reklamlar").delete().eq("id", id);
    if (error) return NextResponse.json({ hata: error.message }, { status: 500 });
    return NextResponse.json({ basarili: true });
  } catch (e: any) {
    return NextResponse.json({ hata: e?.message ?? "Sunucu yapılandırma hatası." }, { status: 500 });
  }
}