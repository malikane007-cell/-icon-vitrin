import { createClient } from "@supabase/supabase-js";

// iconilan.com'un GERÇEK Supabase projesine salt-okunur (anon) bağlantı.
// Bu anon anahtar zaten iconilan.com'un kendi tarayıcı kodunda herkese açık
// olarak kullanılıyor (sadece is_published=true ilanları okuyabiliyor),
// bu yüzden burada kullanılması güvenlidir.
const url = process.env.NEXT_PUBLIC_ICONILAN_SUPABASE_URL as string;
const anonKey = process.env.NEXT_PUBLIC_ICONILAN_SUPABASE_ANON_KEY as string;

export const iconilanSupabase = createClient(url, anonKey);
