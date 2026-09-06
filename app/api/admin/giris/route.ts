import { NextRequest, NextResponse } from "next/server";
import { girisGecerliMi, yonetimAnahtari, YONETIM_COOKIE_ADI } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { hata: "Sunucuda ADMIN_PASSWORD tanımlı değil." },
      { status: 500 }
    );
  }

  const { sifre } = await request.json();

  if (!girisGecerliMi(sifre ?? "")) {
    return NextResponse.json({ hata: "Şifre yanlış." }, { status: 401 });
  }

  const res = NextResponse.json({ basarili: true });
  res.cookies.set(YONETIM_COOKIE_ADI, yonetimAnahtari() as string, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 gün
  });
  return res;
}
