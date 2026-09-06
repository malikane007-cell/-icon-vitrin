-- ICON Vitrin Ekranı - Supabase şeması
-- Bu dosyayı yeni Supabase projenizde: SQL Editor > New query içine yapıştırıp çalıştırın.
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

create policy "herkes_okuyabilir_ilanlar" on ilanlar for select using (true);
create policy "herkes_okuyabilir_ayarlar" on ayarlar for select using (true);
create policy "herkes_okuyabilir_yorumlar" on yorumlar for select using (true);
