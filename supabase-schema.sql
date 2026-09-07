-- ICON Vitrin Ekranı - Supabase şeması
-- Bu dosyayı Supabase projenizde: SQL Editor > New query içine yapıştırıp çalıştırın.
-- NOT: Bu dosyayı daha önce çalıştırdıysanız "ilanlar", "ayarlar", "yorumlar"
-- tabloları zaten var demektir — "create table if not exists" kullanıldığı
-- için tekrar çalıştırmak güvenlidir, mevcut veriyi silmez/bozmaz. Sadece
-- YENİ eklenen "reklamlar" tablosu ve storage bucket'ı bu çalıştırmada
-- oluşacaktır.
--
-- GÜNCELLEME: İlanlar artık BURADAKİ "ilanlar" tablosundan değil, otomatik olarak
-- iconilan.com'un kendi Supabase projesinden (gerçek fotoğraf/video dahil) çekiliyor
-- (bkz. lib/iconilan-listings.ts). Aşağıdaki "ilanlar" tablosu artık uygulama
-- tarafından KULLANILMIYOR — isterseniz Supabase panelinden silebilirsiniz,
-- dokunmazsanız da bir zararı olmaz.

create table if not exists ilanlar (
  id uuid primary key default gen_random_uuid(),
  durum text not null default 'satilik' check (durum in ('satilik', 'kiralik')),
  baslik text not null,
  konum text,
  metrekare int,
  oda_sayisi text,
  kat text,
  fiyat numeric,
  para_birimi text default 'TL',
  otopark boolean default false,
  yerden_isitma boolean default false,
  cephe text,
  iskan boolean default false,
  ozellikler jsonb default '[]'::jsonb, -- örnek: [{"etiket":"Geniş Kullanım Alanı"}, {"etiket":"Modern Mutfak"}]
  fotograf_url text,
  video_url text,
  ilan_linki text, -- QR kodunun yönlendireceği link (boşsa ayarlar.website kullanılır)
  vitrinde boolean not null default true, -- TV ekranında gösterilsin mi
  vitrin_sira int not null default 0, -- gösterim sırası (küçük önce)
  created_at timestamptz not null default now()
);

create table if not exists ayarlar (
  id int primary key default 1,
  sirket_adi text default 'ICON',
  logo_url text,
  google_puan numeric default 4.9,
  google_yorum_sayisi int default 100,
  telefon text,
  website text,
  instagram text,
  ticker_metni text,
  constraint tek_satir check (id = 1)
);

create table if not exists yorumlar (
  id uuid primary key default gen_random_uuid(),
  isim text not null,
  yorum text not null,
  sira int not null default 0
);

-- YENİ: Reklamlar — admin panelinden görsel/video olarak eklenip
-- silinebilen, TV ekranında her 10 ilanda bir otomatik gösterilen kayıtlar
-- (bkz. components/Vitrin.tsx, ILAN_ARASI_REKLAM_SIKLIGI).
create table if not exists reklamlar (
  id uuid primary key default gen_random_uuid(),
  tur text not null default 'gorsel' check (tur in ('gorsel', 'video')),
  medya_url text not null,
  sure_saniye int default 10, -- sadece görsel reklamlarda kullanılır, video kendi süresini kullanır
  sira int not null default 0,
  created_at timestamptz not null default now()
);

-- Örnek/başlangıç verisi (isteğe bağlı, dilerseniz silip kendi verinizi girin)
insert into ayarlar (id, sirket_adi, telefon, website, instagram, ticker_metni)
values (1, 'ICON', '551 598 35 82', 'akemlakburdur.com', '/akemlakburdur',
        'Burdur Merkez''de yeni projeler yükseliyor! Yatırım fırsatlarını kaçırmayın.')
on conflict (id) do nothing;

-- Vitrin ekranı sadece SELECT (okuma) yapıyor, herkese açık okumaya izin veriyoruz.
-- Ekleme/güncelleme Supabase panelindeki Table Editor üzerinden yapılacaksa RLS'yi kapatabilir
-- ya da aşağıdaki gibi sadece "authenticated" role'e yazma izni verip anon'a sadece okuma bırakabilirsiniz.

alter table ilanlar enable row level security;
alter table ayarlar enable row level security;
alter table yorumlar enable row level security;
alter table reklamlar enable row level security;

create policy "herkes_okuyabilir_ilanlar" on ilanlar for select using (true);
create policy "herkes_okuyabilir_ayarlar" on ayarlar for select using (true);
create policy "herkes_okuyabilir_yorumlar" on yorumlar for select using (true);
create policy "herkes_okuyabilir_reklamlar" on reklamlar for select using (true);

-- YENİ: Reklam görselleri/videoları için dosya deposu (Storage bucket).
-- "public: true" ile herkes okuyabilir (TV ekranı bu dosyaları görüntüler);
-- yazma işlemi zaten sadece admin panelinin sunucu tarafı (SUPABASE_SERVICE_ROLE_KEY
-- ile, RLS'yi tamamen atlayarak) yaptığı için ayrı bir insert politikasına
-- ihtiyaç yok, ama ileride anon/authenticated bir istemciden de yükleme
-- yapılmak istenirse diye ekliyoruz.
insert into storage.buckets (id, name, public)
values ('reklamlar', 'reklamlar', true)
on conflict (id) do nothing;

create policy "herkes_reklam_dosyalarini_okuyabilir" on storage.objects
  for select using (bucket_id = 'reklamlar');

create policy "yetkili_reklam_dosyasi_yukleyebilir" on storage.objects
  for insert with check (bucket_id = 'reklamlar');