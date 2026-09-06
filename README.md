# ICON Vitrin Ekranı

TV'de tam ekran çalışan emlak vitrin ekranı. İlanlar (fotoğraf/video dahil) **otomatik
olarak iconilan.com'daki "Ak Emlak Gayrimenkul" ofis ilanlarından** çekilir, aralarında
kendiliğinden döner — elle ilan girmeniz gerekmez.

## 1) Supabase kurulumu (sadece ayarlar/yorumlar için)
Bu proje artık iki Supabase'e bağlanıyor:
- **iconilan.com'un Supabase'i** → gerçek ilanlar (otomatik, `.env.local.example`'da zaten dolu)
- **Sizin kendi yeni Supabase projeniz** → sadece şirket bilgileri (telefon/website/instagram/ticker
  metni) ve Google yorumu otomasyonu kurulana kadarki manuel yorum yedeği için

Eğer daha önce oluşturmadıysanız:
1. https://supabase.com üzerinde yeni bir proje oluşturun.
2. **SQL Editor**'e bu klasördeki `supabase-schema.sql` dosyasının tamamını yapıştırıp **Run** deyin.
3. **Table Editor**'den `ayarlar` tablosundaki tek satırı kendi telefon/website/instagram
   bilgilerinizle güncelleyin. Google yorumu otomasyonunu henüz kurmadıysanız `yorumlar`
   tablosuna 1-2 yorum elle ekleyin (aşağıya bakın).
4. **Project Settings > API** sayfasından `Project URL` ve `anon public` key'i kopyalayın.

(`ilanlar` tablosu artık kullanılmıyor, oluşturduysanız dokunmasanız da olur.)

## 2) Yerelde çalıştırma (VS Code)
```
npm install
copy .env.local.example .env.local    (Windows)
```
`.env.local` dosyasını açıp yukarıdaki adım 1'deki Supabase URL/anon key'inizi
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` alanlarına yapıştırın
(iconilan.com'un bilgileri zaten dolu, onlara dokunmayın), sonra:
```
npm run dev
```
Tarayıcıda http://localhost:3000 adresini açın.

## 3) Vercel'e deploy
```
git add .
git commit -m "ilk kurulum"
git push
```
Vercel'de bu repo'yu bağlarken **Environment Variables** kısmına `.env.local` içindeki TÜM
değişkenleri (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
NEXT_PUBLIC_ICONILAN_SUPABASE_URL, NEXT_PUBLIC_ICONILAN_SUPABASE_ANON_KEY, ve varsa
GOOGLE_PLACES_API_KEY / GOOGLE_PLACE_ID) girmeyi unutmayın. Deploy sonrası Vercel'in
verdiği adres, TV'de açacağınız adrestir.

## 4) TV'de gösterme
TV'nin tarayıcısında (Android TV/Chromecast with Google TV/Fire TV/akıllı TV tarayıcısı) veya
TV'ye bağlı ufak bir mini PC / Fire TV Stick üzerinde Chrome'da Vercel adresini tam ekran açın.
Sayfa 18 saniyede bir sıradaki ilana geçer, videosu olmayan ilanlarda fotoğraflar 5 saniyede
bir değişir, 5 dakikada bir iconilan.com'dan yeni ilan var mı diye tazelenir.

## 5) Google yorumlarını otomatik çekme (opsiyonel)
Kurulana kadar ekran otomatik olarak `yorumlar` tablosundaki (aşağıdaki yönetim panelinden
girdiğiniz) yorumlara döner — bu adımı hemen yapmanıza gerek yok.

1. **Place ID'nizi bulun**: https://developers.google.com/maps/documentation/places/web-service/place-id
   adresindeki arama kutusuna işletme adınızı (örn. "Ak Emlak Gayrimenkul Burdur") yazıp
   haritada işletmenizi işaretleyin, sayfa size Place ID'yi gösterir.
2. **Google Cloud Console**'da bir proje açın (veya iconilan.com için kullanılan
   `iconilan-analytics` projesini kullanın) ve **Places API**'yi etkinleştirip bir API key
   oluşturun.
   - Önemli: Google, Mart 2025'te tüm hesaplara verdiği genel 200$'lık aylık krediyi
     kaldırdı. Artık her API'nin kendi (daha düşük) ücretsiz kotası var; yorum/puan
     bilgisini içeren çağrı (Place Details – Enterprise) için bu kota ayda 1000 istek.
     Bu proje yorumları 6 saatte bir tazeleyip önbelleğe aldığı için ayda ~120 çağrı
     yapar, yani ücretsiz kotanın çok altında kalırsınız — ama Google, bu kotanın
     içinde kalsanız bile Cloud hesabınızda **faturalandırma (bir ödeme yöntemi)
     etkinleştirmenizi zorunlu tutuyor**.
3. `.env.local` (ve Vercel'deki Environment Variables) içine `GOOGLE_PLACES_API_KEY` ve
   `GOOGLE_PLACE_ID` değerlerini ekleyin. Kod tarafında başka hiçbir değişiklik gerekmez —
   ekran bu iki değeri görür görmez otomatik olarak gerçek puan/yorumlarınızı çekmeye başlar.

## 6) Yönetim paneli (/admin) — logo ve yorumları buradan değiştirin
Artık Supabase panelini açmadan, tarayıcıda `/admin` adresinden (yerelde
http://localhost:3000/admin, canlıda `sizin-vercel-adresiniz.vercel.app/admin`):
- **Logo yükleyebilirsiniz** — TV ekranının sol üst köşesindeki "ICON" yazısının yerine
  otomatik olarak yüklediğiniz logo görseli geçer.
- **Şirket bilgilerini** (telefon, website, instagram, alt bant metni) düzenleyebilirsiniz.
- **Yorumları** (Google API kurulana kadar ekranda gösterilen yedek yorumlar) ekleyip
  silebilir, sırasını değiştirebilirsiniz.

Bu panel bir şifreyle korunuyor. Çalıştırmadan önce `.env.local` (ve Vercel Environment
Variables) içine şu İKİ değişkeni eklemeniz GEREKİR:
```
ADMIN_PASSWORD=kendi-belirleyeceginiz-bir-sifre
SUPABASE_SERVICE_ROLE_KEY=<Supabase Project Settings > API > service_role (secret) key>
```
`SUPABASE_SERVICE_ROLE_KEY` çok yetkili bir anahtardır — asla `NEXT_PUBLIC_` ön ekiyle
kullanmayın, kimseyle paylaşmayın, GitHub'a atmayın (`.gitignore` zaten `.env.local`'i
hariç tutuyor). Bu iki değişken olmadan `/admin` sayfası "Yetkisiz" hatası verir.

## Dosya yapısı
- `app/page.tsx` → ana sayfa (TV ekranı), `components/Vitrin.tsx`'i render eder
- `app/admin/page.tsx` → yönetim paneli (logo, şirket bilgileri, yorumlar)
- `app/api/admin/*` → yönetim paneli için sunucu tarafı uçlar (şifre kontrolü + veri yazma)
- `app/api/google-yorumlar/route.ts` → Google Places API entegrasyonu (opsiyonel)
- `components/Vitrin.tsx` → tüm TV ekranı mantığı (veri çekme, dönüş, tasarım)
- `lib/iconilan-listings.ts` → iconilan.com'dan otomatik ilan çekme (ofis adı filtresi burada)
- `lib/iconilan-supabase.ts` → iconilan.com'un Supabase bağlantısı (salt okunur)
- `lib/supabase.ts` → kendi Supabase projenizin salt-okunur (anon) bağlantısı
- `lib/supabase-admin.ts` → kendi Supabase projenizin YAZMA yetkili (service_role) bağlantısı — sadece `app/api/admin/*` içinde kullanılır
- `lib/admin-auth.ts` → yönetim paneli şifre/oturum kontrolü
- `lib/types.ts` → TypeScript tipleri
- `supabase-schema.sql` → kendi Supabase projeniz için veritabanı şeması (`ayarlar` tablosunda `logo_url` sütunu zaten var)
