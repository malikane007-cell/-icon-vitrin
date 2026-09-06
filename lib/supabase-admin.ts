import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let istemci: SupabaseClient | null = null;

// SADECE SUNUCU TARAFINDA kullanılır (app/api/admin/* route'ları içinde,
// HER ZAMAN oturum kontrolünden SONRA çağrılır).
//
// ÖNEMLİ: İstemci burada LAZY (fonksiyon çağrılınca) oluşturuluyor.
// Modül yüklenir yüklenmez oluşturulsaydı ve SUPABASE_SERVICE_ROLE_KEY eksik
// olsaydı, bu dosyayı import eden route'lar şifre kontrolüne HİÇ gelmeden
// çökerdi (gerçekten yaşandı: env değişkeni eksikken /admin şifre sormadan
// açılıyormuş gibi görünüyordu, çünkü asıl sebep 401 değil 500 hatasıydı ve
// istemci tarafı bunu yanlışlıkla "giriş yapılmış" sayıyordu).
export function supabaseAdmin(): SupabaseClient {
  if (!istemci) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY (veya NEXT_PUBLIC_SUPABASE_URL) tanımlı değil. .env.local dosyanıza ekleyip sunucuyu yeniden başlatın."
      );
    }
    istemci = createClient(url, serviceKey, { auth: { persistSession: false } });
  }
  return istemci;
}
