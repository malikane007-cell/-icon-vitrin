import { NextResponse } from "next/server";
import { YONETIM_COOKIE_ADI } from "@/lib/admin-auth";

export async function POST() {
  const res = NextResponse.json({ basarili: true });
  res.cookies.set(YONETIM_COOKIE_ADI, "", { path: "/", maxAge: 0 });
  return res;
}
