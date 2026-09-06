import { createHash } from "crypto";
import { cookies } from "next/headers";

export const YONETIM_COOKIE_ADI = "vitrin_admin";

// Şifrenin kendisini cookie'de tutmak yerine, ADMIN_PASSWORD'ün sabit bir
// özetini (hash) tutuyoruz — cookie çalınsa bile şifre doğrudan görünmez.
export function yonetimAnahtari(): string | null {
  const sifre = process.env.ADMIN_PASSWORD;
  if (!sifre) return null;
  return createHash("sha256").update(sifre).digest("hex");
}

export function girisGecerliMi(sifre: string): boolean {
  const gercekSifre = process.env.ADMIN_PASSWORD;
  return !!gercekSifre && sifre === gercekSifre;
}

export function oturumGecerliMi(): boolean {
  const anahtar = yonetimAnahtari();
  if (!anahtar) return false;
  const cookieDegeri = cookies().get(YONETIM_COOKIE_ADI)?.value;
  return cookieDegeri === anahtar;
}
