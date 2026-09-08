"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import { getVitrinIlanlari, type OfisIlani } from "@/lib/iconilan-listings";
import type { Ayarlar, GoogleYorumYaniti, Reklam, Yorum } from "@/lib/types";

const ROTASYON_SURESI_MS = 18000; // her ilanda kalma süresi
const FOTO_ROTASYON_MS = 5000; // videosu olmayan ilanlarda fotoğraf değişim süresi
const ILAN_YENIDEN_CEKME_MS = 5 * 60 * 1000; // iconilan.com'dan veri tazeleme sıklığı
const YORUM_YENIDEN_CEKME_MS = 30 * 60 * 1000; // Google yorumu tazeleme sıklığı
const REKLAM_YENIDEN_CEKME_MS = 5 * 60 * 1000; // ayarlar/yorumlar/reklamlar tazeleme sıklığı

// YENİ: Reklam arası akışı ayarları.
// Video ilanların (YouTube) ve video reklamların sabit gösterim süresi.
// Fotoğraf ilanlarında süre fotoğraf sayısına göre dinamik hesaplanıyor
// (bkz. aşağıdaki useEffect), ama video için gerçek video uzunluğunu
// (YouTube API anahtarı olmadan) bilemediğimizden, çoğu kısa emlak
// tanıtım videosunu kapsayacak kadar cömert sabit bir süre kullanıyoruz.
const VIDEO_GOSTERIM_SURESI_MS = 45000;
const ILAN_ARASI_REKLAM_SIKLIGI = 10; // her N ilan gösteriminden sonra bir reklam arası açılır
const GECIS_VIDEOSU_AZAMI_SURE_MS = 15000; // geçiş videosu bir şekilde bitmezse/oynamazsa yine de devam et

// Kullanıcının onayladığı sabit (akmayan) altın/yaldız kenarlık ve fiyat
// kutusu renkleri — bkz. app/globals.css .altin-kenarlik tanımıyla AYNI
// gradyan (kenarlık burada JS tarafında da lazım oluyor: rozet çerçevesi
// için inline style olarak).
const ALTIN_KENARLIK_GRADIENT =
  "linear-gradient(135deg, #7a5a1e, #f5d67a 35%, #fff6d6 50%, #f5d67a 65%, #7a5a1e)";
const FIYAT_GRADIENT = "linear-gradient(135deg, #b8860b, #ffd700 50%, #b8860b)";

function fiyatFormatla(ilan: OfisIlani) {
  if (ilan.fiyat == null) return "Fiyat için arayın";
  const sayi = new Intl.NumberFormat("tr-TR").format(ilan.fiyat);
  const sonek = ilan.durum === "kiralik" ? "/ay" : "";
  return `${sayi} ${ilan.paraBirimi}${sonek}`;
}

const ISITMA_ETIKETLERI: Record<string, string> = {
  dogalgaz: "Doğalgaz",
  yerden_isitma: "Yerden Isıtma",
  kombi: "Kombi",
  merkezi: "Merkezi Isıtma",
  klima: "Klima",
};

const ISKAN_ETIKETLERI: Record<string, string> = {
  bos: "Boş",
  kiracili: "Kiracılı",
  mulk_sahibi: "Mülk Sahibi Oturuyor",
};

// YENİ: iconilan.com'daki ilan videoları YouTube üzerinden barındırılıyor
// (video dosyası olarak değil, bir YouTube linki olarak geliyor) — bu yüzden
// <video> etiketi yerine YouTube embed (iframe) kullanıyoruz. Desteklenen
// link biçimleri: youtube.com/watch?v=..., youtu.be/..., youtube.com/embed/...,
// youtube.com/shorts/... Tanınmayan bir link gelirse (örn. gerçekten bir
// .mp4 dosya linki) null döner ve kod normal <video> etiketine geri düşer.
function youtubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
    if (host === "youtu.be") {
      return u.pathname.slice(1).split("/")[0] || null;
    }
    if (host === "youtube.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/embed/")[1]?.split("/")[0] || null;
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/shorts/")[1]?.split("/")[0] || null;
    }
    return null;
  } catch {
    return null;
  }
}

// Tasarım sabit 1920x1080 üzerine yapılıyor, gerçek pencere/ekran boyutu ne
// olursa olsun bu sabit "tuval" oranı bozulmadan ölçeklenip ortalanıyor.
// Böylece küçük bir tarayıcı penceresinde test ederken de, gerçek TV'nin
// farklı bir çözünürlüğünde de kartlar birbirini ezmeden aynı görünür.
const TASARIM_GENISLIK = 1920;
const TASARIM_YUKSEKLIK = 1080;

function OlcekliCerceve({ children }: { children: React.ReactNode }) {
  const [olcek, setOlcek] = useState(1);
  const [tamEkran, setTamEkran] = useState(false);
  const [fareHareketli, setFareHareketli] = useState(true);

  useEffect(() => {
    function boyutAyarla() {
      const olcekX = window.innerWidth / TASARIM_GENISLIK;
      const olcekY = window.innerHeight / TASARIM_YUKSEKLIK;
      setOlcek(Math.min(olcekX, olcekY));
    }
    boyutAyarla();
    window.addEventListener("resize", boyutAyarla);
    return () => window.removeEventListener("resize", boyutAyarla);
  }, []);

  useEffect(() => {
    function degisimDinle() {
      setTamEkran(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", degisimDinle);
    return () => document.removeEventListener("fullscreenchange", degisimDinle);
  }, []);

  // Fare oynatılmadığı sürece "Tam Ekran" butonu ekranda durmasın (TV
  // görünümünü bozmasın) — fare hareket edince görünsün, 2.5 saniye hareket
  // olmazsa otomatik kaybolsun. Dokunmatik ekranlarda dokunuşla da göster.
  useEffect(() => {
    let zamanlayici: ReturnType<typeof setTimeout>;
    function fareGorununceGoster() {
      setFareHareketli(true);
      clearTimeout(zamanlayici);
      zamanlayici = setTimeout(() => setFareHareketli(false), 2500);
    }
    window.addEventListener("mousemove", fareGorununceGoster);
    window.addEventListener("touchstart", fareGorununceGoster);
    zamanlayici = setTimeout(() => setFareHareketli(false), 2500);
    return () => {
      window.removeEventListener("mousemove", fareGorununceGoster);
      window.removeEventListener("touchstart", fareGorununceGoster);
      clearTimeout(zamanlayici);
    };
  }, []);

  function tamEkranDegistir() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden relative">
      <div
        style={{
          width: TASARIM_GENISLIK,
          height: TASARIM_YUKSEKLIK,
          transform: `scale(${olcek})`,
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
      <button
        onClick={tamEkranDegistir}
        className={`fixed bottom-3 right-3 z-50 bg-black/60 hover:bg-black/85 text-white text-sm px-4 py-2 rounded-lg border border-white/20 transition-opacity duration-500 ${
          fareHareketli ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        title={tamEkran ? "Tam ekrandan çık" : "Tam ekrana al"}
      >
        {tamEkran ? "⤡ Küçült" : "⤢ Tam Ekran"}
      </button>
    </div>
  );
}

export default function Vitrin() {
  const [ilanlar, setIlanlar] = useState<OfisIlani[]>([]);
  const [ayarlar, setAyarlar] = useState<Ayarlar | null>(null);
  const [yorumlar, setYorumlar] = useState<Yorum[]>([]);
  const [reklamlar, setReklamlar] = useState<Reklam[]>([]);
  const [googleYorum, setGoogleYorum] = useState<GoogleYorumYaniti | null>(null);
  const [index, setIndex] = useState(0);
  const [fotoIndex, setFotoIndex] = useState(0);
  const [videoHata, setVideoHata] = useState(false);
  const [fotoHata, setFotoHata] = useState(false);
  const [yorumIndex, setYorumIndex] = useState(0);
  const [saat, setSaat] = useState("");

  // YENİ: Reklam arası akışı.
  // "ilan"  = normal ilan gösterimi (varsayılan)
  // "gecis" = reklamlardan hemen önce oynatılan sabit tanıtım videosu
  // "reklam" = admin panelinden eklenen reklamlardan biri (görsel ya da video)
  const [mod, setMod] = useState<"ilan" | "gecis" | "reklam">("ilan");
  const [reklamIndex, setReklamIndex] = useState(0);
  // Kaç ilan gösterildiğini SAYAN, render'ları tetiklemeyen bir sayaç —
  // state değil ref, çünkü sadece zamanlayıcı içinde okunup yazılıyor.
  const gosterilenIlanSayaciRef = useRef(0);

  // İlanlar — otomatik olarak iconilan.com'dan
  useEffect(() => {
    async function ilanlariCek() {
      const veri = await getVitrinIlanlari(20);
      setIlanlar(veri);
    }
    ilanlariCek();
    const t = setInterval(ilanlariCek, ILAN_YENIDEN_CEKME_MS);
    return () => clearInterval(t);
  }, []);

  // Şirket bilgileri + manuel yorum yedeği + reklamlar — kendi Supabase projemizden
  useEffect(() => {
    async function ayarlariCek() {
      const [ayarRes, yorumRes, reklamRes] = await Promise.all([
        supabase.from("ayarlar").select("*").eq("id", 1).maybeSingle(),
        supabase.from("yorumlar").select("*").order("sira", { ascending: true }),
        supabase.from("reklamlar").select("*").order("sira", { ascending: true }),
      ]);
      if (ayarRes.data) setAyarlar(ayarRes.data as Ayarlar);
      if (yorumRes.data) setYorumlar(yorumRes.data as Yorum[]);
      if (reklamRes.data) setReklamlar(reklamRes.data as Reklam[]);
    }
    ayarlariCek();
    const t = setInterval(ayarlariCek, REKLAM_YENIDEN_CEKME_MS);
    return () => clearInterval(t);
  }, []);

  // Google yorumları — otomatik (API key tanımlıysa); değilse yukarıdaki manuel veriye düşer
  useEffect(() => {
    async function googleYorumlariCek() {
      try {
        const res = await fetch("/api/google-yorumlar");
        const veri = (await res.json()) as GoogleYorumYaniti;
        setGoogleYorum(veri);
      } catch {
        setGoogleYorum({ aktif: false });
      }
    }
    googleYorumlariCek();
    const t = setInterval(googleYorumlariCek, YORUM_YENIDEN_CEKME_MS);
    return () => clearInterval(t);
  }, []);

  // İlanlar arası otomatik dönüş — SADECE "ilan" modundayken çalışır.
  // GÜNCELLEME: Süre artık SABİT değil, ilana göre DİNAMİK hesaplanıyor —
  // fotoğrafı çok olan bir ilanda (örn. 6 foto × 5sn = 30sn) hepsi bitmeden
  // bir sonraki ilana geçilmiyordu, bu yüzden setInterval yerine her ilanın
  // kendi süresine göre yeniden kurulan bir setTimeout kullanıyoruz.
  // Video reklamı YENİ: Her ILAN_ARASI_REKLAM_SIKLIGI ilanda bir reklam arası
  // açılması gerekiyorsa, ilan indeksini İLERLETMEDEN "gecis" moduna
  // geçiyoruz — böylece reklam/geçiş bitip "ilan" moduna dönüldüğünde bir
  // sonraki tur aynı ilandan bir sonrakine geçiyor, yani ilanlar KALDIĞI
  // YERDEN devam ediyor (baştan başlamıyor).
  useEffect(() => {
    if (ilanlar.length < 2 || mod !== "ilan") return;
    const suGuncel = ilanlar[index];
    if (!suGuncel) return;
    const sure = suGuncel.videoUrl
      ? VIDEO_GOSTERIM_SURESI_MS
      : Math.max(ROTASYON_SURESI_MS, Math.max(suGuncel.fotograflar.length, 1) * FOTO_ROTASYON_MS);
    const zamanlayici = setTimeout(() => {
      gosterilenIlanSayaciRef.current += 1;
      if (
        reklamlar.length > 0 &&
        gosterilenIlanSayaciRef.current % ILAN_ARASI_REKLAM_SIKLIGI === 0
      ) {
        setMod("gecis");
        return;
      }
      setIndex((onceki) => (onceki + 1) % ilanlar.length);
    }, sure);
    return () => clearTimeout(zamanlayici);
  }, [ilanlar, index, mod, reklamlar.length]);

  // YENİ: Geçiş videosu — kendi süresinde biterse <video onEnded> ile
  // "reklam" moduna geçiyoruz; video herhangi bir sebeple bitmezse/oynamazsa
  // akış kilitli kalmasın diye bir güvenlik zaman aşımı da koyuyoruz.
  useEffect(() => {
    if (mod !== "gecis") return;
    const t = setTimeout(() => setMod("reklam"), GECIS_VIDEOSU_AZAMI_SURE_MS);
    return () => clearTimeout(t);
  }, [mod]);

  // YENİ: Reklam gösterimi — görsel reklamlarda kendi süresi kadar
  // (varsayılan 10sn, admin panelinden ayarlanabilir) bekleyip bir sonraki
  // reklama/ilanlara dönüyoruz; video reklamlarda kendi doğal bitiş süresini
  // (<video onEnded>) bekliyoruz. Her reklam arasında SIRADAKİ reklam
  // gösteriliyor (reklamIndex ilerliyor), böylece birden çok reklam eklendiğinde
  // zamanla hepsi sırayla dönmüş oluyor.
  useEffect(() => {
    if (mod !== "reklam") return;
    if (reklamlar.length === 0) {
      setMod("ilan");
      return;
    }
    const guncelReklam = reklamlar[reklamIndex % reklamlar.length];
    if (guncelReklam.tur === "video") return; // video kendi onEnded'i ile ilerleyecek
    const sure = (guncelReklam.sure_saniye ?? 10) * 1000;
    const t = setTimeout(() => {
      setReklamIndex((i) => i + 1);
      setMod("ilan");
    }, sure);
    return () => clearTimeout(t);
  }, [mod, reklamIndex, reklamlar]);

  useEffect(() => {
    if (index >= ilanlar.length) setIndex(0);
  }, [ilanlar.length, index]);

  const guncel = ilanlar[index];
  const youtubeId = guncel?.videoUrl ? youtubeVideoId(guncel.videoUrl) : null;

  // Videosu olmayan ilanlarda fotoğraflar arasında otomatik dönüş
  useEffect(() => {
    setFotoIndex(0);
    setVideoHata(false);
    setFotoHata(false);
    if (!guncel || guncel.videoUrl || guncel.fotograflar.length < 2) return;
    const donus = setInterval(() => {
      setFotoIndex((onceki) => (onceki + 1) % guncel.fotograflar.length);
      setFotoHata(false);
    }, FOTO_ROTASYON_MS);
    return () => clearInterval(donus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guncel?.id]);

  useEffect(() => {
    function guncelle() {
      setSaat(
        new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
      );
    }
    guncelle();
    const t = setInterval(guncelle, 1000);
    return () => clearInterval(t);
  }, []);

  const digerIlanlar = useMemo(() => {
    if (ilanlar.length < 2) return [];
    const sonuc: OfisIlani[] = [];
    for (let i = 1; sonuc.length < 2 && i < ilanlar.length; i++) {
      sonuc.push(ilanlar[(index + i) % ilanlar.length]);
    }
    return sonuc;
  }, [ilanlar, index]);

  const sirketAdi = ayarlar?.sirket_adi ?? "ICON";
  const qrDeger = guncel?.ilanLinki || ayarlar?.website || "https://iconilan.com";

  // Kayan "son dakika" yazısı: uzunluğa göre okuma hızı sabit kalsın diye
  // animasyon süresi metin uzunluğuna göre hesaplanıyor (uzun metin daha
  // yavaş değil, aynı hızda ama daha uzun sürede kayar).
  const tickerMetniHam =
    ayarlar?.ticker_metni && ayarlar.ticker_metni.trim() !== ""
      ? ayarlar.ticker_metni
      : "Size en uygun gayrimenkulü bulmanız için buradayız.";
  const tickerMetni = tickerMetniHam.toLocaleUpperCase("tr-TR");
  const tickerSuresi = Math.max(12, tickerMetni.length * 0.18);

  // Google puanı/yorumları: API'den otomatik geliyorsa onu, gelmiyorsa elle girilen yedeği kullan
  const gPuan = googleYorum?.aktif ? googleYorum.puan : ayarlar?.google_puan;
  const gYorumSayisi = googleYorum?.aktif ? googleYorum.yorumSayisi : ayarlar?.google_yorum_sayisi;
  const gYorumlar = googleYorum?.aktif && googleYorum.yorumlar?.length ? googleYorum.yorumlar : yorumlar.map((y) => ({ isim: y.isim, yorum: y.yorum, puan: 5 }));

  // Yorumlar tek tek, sürekli değişerek gösteriliyor (aynı anda hepsi değil)
  useEffect(() => {
    if (gYorumlar.length < 2) return;
    const donus = setInterval(() => {
      setYorumIndex((onceki) => (onceki + 1) % gYorumlar.length);
    }, 7000);
    return () => clearInterval(donus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gYorumlar.length]);

  useEffect(() => {
    if (yorumIndex >= gYorumlar.length) setYorumIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gYorumlar.length, yorumIndex]);

  const gosterilecekYorum = gYorumlar[yorumIndex];
  const guncelReklam = reklamlar.length > 0 ? reklamlar[reklamIndex % reklamlar.length] : null;

  if (!guncel) {
    return (
      <OlcekliCerceve>
        <div className="w-full h-full flex items-center justify-center bg-vitrinbg text-center px-8">
          <div>
            <div className="text-4xl font-bold text-altin mb-3">{sirketAdi}</div>
            <p className="text-xl text-white/70">
              iconilan.com&apos;da &quot;Ak Emlak Gayrimenkul&quot; ofisine ait yayında ilan
              bulunamadı. Ofis adı eşleşmesini lib/iconilan-listings.ts içindeki
              OFIS_ADI_FILTRESI ile kontrol edin.
            </p>
          </div>
        </div>
      </OlcekliCerceve>
    );
  }

  const gosterilecekFoto = guncel.fotograflar[fotoIndex] ?? guncel.fotograflar[0];
  const ekOzellikler = [
    guncel.isitma && (ISITMA_ETIKETLERI[guncel.isitma] ?? guncel.isitma),
    guncel.iskanDurumu && (ISKAN_ETIKETLERI[guncel.iskanDurumu] ?? guncel.iskanDurumu),
  ].filter(Boolean) as string[];
  const tumOzellikler = [...guncel.ozellikler, ...ekOzellikler].slice(0, 6);

  return (
    <OlcekliCerceve>
    <div className="w-full h-full overflow-hidden flex flex-col bg-vitrinbg p-4 gap-3 text-white">
      {/* ÜST BÖLÜM — normal ilan görünümü ile reklam/geçiş görünümü AYNI
          alanı paylaşıyor, ikisi arasında yumuşak bir opacity geçişi var.
          Alt bölüm (diğer ilanlar + bize ulaşın) ve ticker BUNDAN HİÇ
          ETKİLENMEZ, her zaman sabit kalır (aşağıda ayrı, bu div'in dışında). */}
      <div className="flex-1 min-h-0 relative">
        {/* NORMAL İLAN GÖRÜNÜMÜ */}
        <div
          className={`absolute inset-0 grid grid-cols-[320px_1fr_420px] gap-3 min-h-0 transition-opacity duration-700 ${
            mod === "ilan" ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* SOL PANEL */}
          <div key={`sol-${guncel.id}`} className="altin-kenarlik p-5 flex flex-col overflow-hidden animate-fadein">
            <div className="flex items-center gap-3 mb-1">
              {ayarlar?.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ayarlar.logo_url} alt={sirketAdi} className="h-12 w-12 object-contain shrink-0 block" />
              )}
              <div className="text-3xl font-extrabold text-altin tracking-wide leading-tight break-words">
                {sirketAdi}
              </div>
            </div>
            <div className="h-px bg-white/10 my-3" />
            <div className="text-xl font-bold uppercase mb-4 leading-snug">
              {guncel.durumEtiketi} {guncel.baslik}
            </div>

            <div className="flex flex-col gap-3 text-white/90 text-base">
              <Ozellik etiket={guncel.konum} />
              {guncel.metrekare && <Ozellik etiket={`${guncel.metrekare} m²`} />}
              {guncel.odaSayisi && <Ozellik etiket={guncel.odaSayisi} />}
              {guncel.kat && <Ozellik etiket={guncel.kat} />}
            </div>

            {tumOzellikler.length > 0 && (
              <div className="mt-4 min-h-0 overflow-hidden">
                <div className="text-sm font-bold text-altin mb-2">Öne Çıkan Özellikler</div>
                <div className="flex flex-col gap-1.5 text-sm">
                  {tumOzellikler.map((etiket, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-altin/20 flex items-center justify-center text-altin text-xs shrink-0">
                        ●
                      </span>
                      <span className="truncate">{etiket}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fiyat kutusu — rozet buradan kaldırıldı, artık QR kod
                kutusunun üstünde daha büyük ve okunaklı gösteriliyor. */}
            <div className="mt-auto pt-4">
              <div
                className="w-full font-extrabold text-3xl rounded-xl px-4 py-3 text-center glow-altin-box"
                style={{ background: FIYAT_GRADIENT, color: "#1a1200" }}
              >
                {fiyatFormatla(guncel)}
              </div>
            </div>
          </div>

          {/* ORTA - FOTOĞRAF / VİDEO (otomatik — video artık YouTube embed ile) */}
          <div key={`orta-${guncel.id}`} className="rounded-2xl overflow-hidden relative bg-black animate-fadein">
            {youtubeId && !videoHata ? (
              // YouTube embed'i, konteynerin tam boyutunu "cover" gibi
              // doldurabilmek için gerçek boyutundan büyük render edilip
              // (178%) ortalanıp taşan kısmı overflow-hidden ile kırpılıyor —
              // normal <video object-cover> davranışının YouTube iframe
              // karşılığı.
              <div className="absolute inset-0 overflow-hidden">
                <iframe
                  key={youtubeId}
                  className="absolute top-1/2 left-1/2 w-[178%] h-[178%] -translate-x-1/2 -translate-y-1/2"
                  style={{ pointerEvents: "none", border: 0 }}
                  src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&playsinline=1&fs=0`}
                  title={guncel.baslik}
                  allow="autoplay; encrypted-media; picture-in-picture"
                />
              </div>
            ) : guncel.videoUrl && !videoHata ? (
              // Yedek: video linki YouTube değilse (gerçek bir .mp4 dosyasıysa) eski yöntem
              <video
                key={guncel.videoUrl}
                className="w-full h-full object-cover block"
                src={guncel.videoUrl}
                autoPlay
                muted
                loop
                playsInline
                onError={() => {
                  console.warn("[Vitrin] Video yüklenemedi, fotoğrafa geçiliyor:", guncel.videoUrl);
                  setVideoHata(true);
                }}
              />
            ) : gosterilecekFoto && !fotoHata ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={gosterilecekFoto}
                src={gosterilecekFoto}
                alt={guncel.baslik}
                className="w-full h-full object-cover block animate-fadein"
                onError={() => {
                  console.warn("[Vitrin] Fotoğraf yüklenemedi:", gosterilecekFoto);
                  setFotoHata(true);
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/40">
                Görsel yok
              </div>
            )}
            {!guncel.videoUrl && guncel.fotograflar.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/40 px-2.5 py-1.5 rounded-full">
                {guncel.fotograflar.map((_, i) => (
                  <span
                    key={i}
                    className={`w-2 h-2 rounded-full ${
                      i === fotoIndex ? "bg-altin" : "bg-white/40"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* SAĞ PANEL */}
          <div className="flex flex-col gap-3 min-h-0">
            <div className="altin-kenarlik p-4 flex-1 min-h-0 overflow-hidden flex flex-col">
              <div className="text-right text-sm font-bold text-white/60 uppercase tracking-wide mb-2">
                Müşterilerimiz Ne Diyor?
              </div>
              <div className="grid grid-cols-[0.55fr_1.9fr] gap-4 items-stretch flex-1 min-h-0">
                <div className="shrink-0">
                  <div className="text-3xl font-bold leading-none mb-2">
                    <span style={{ color: "#4285F4" }}>G</span>
                    <span style={{ color: "#EA4335" }}>o</span>
                    <span style={{ color: "#FBBC05" }}>o</span>
                    <span style={{ color: "#4285F4" }}>g</span>
                    <span style={{ color: "#34A853" }}>l</span>
                    <span style={{ color: "#EA4335" }}>e</span>
                  </div>
                  {gPuan != null && (
                    <div className="text-altin font-extrabold text-3xl leading-tight">
                      {Number(gPuan).toFixed(1)}
                      <div className="text-xl tracking-wider">★★★★★</div>
                    </div>
                  )}
                  {gYorumSayisi != null && (
                    <div className="text-white/60 text-sm mt-1">({gYorumSayisi}+ Yorum)</div>
                  )}
                </div>
                {/* Google yorumları SADECE burada, puan bloğunun hemen
                    yanında/altında gösteriliyor — ekranın başka hiçbir
                    yerinde tekrar edilmiyor. */}
                {gosterilecekYorum && (
                  <div key={yorumIndex} className="bg-black/30 rounded-lg p-4 text-lg animate-fadein flex flex-col justify-start h-full overflow-hidden">
                    <div className="text-altin text-3xl leading-none mb-1">&ldquo;</div>
                    <div className="text-white/80 italic line-clamp-5 leading-relaxed">{gosterilecekYorum.yorum}</div>
                    <div className="text-altin mt-2 font-semibold text-lg">— {gosterilecekYorum.isim}</div>
                    <div className="text-altin text-lg tracking-wider">★★★★★</div>
                  </div>
                )}
              </div>
            </div>

            <div className="altin-kenarlik p-4 flex flex-col gap-3 shrink-0">
              {/* Deneyim rozeti — büyük ve okunaklı, QR kutusuna DOKUNMADAN
                  onun üstüne eklendi. */}
              <div className="flex justify-center">
                <div className="rounded-full p-1 shrink-0" style={{ background: ALTIN_KENARLIK_GRADIENT }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/deneyim-rozeti.png"
                    alt="10 Yıllık Deneyim"
                    className="w-40 h-40 rounded-full object-cover block bg-vitrinbg"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="font-bold mb-1 text-lg">Bu İlanın Detayları</div>
                  <div className="text-white/60 text-sm">
                    iconilan.com&apos;daki ilan sayfası için QR kodu okutun.
                  </div>
                </div>
                <div className="bg-white p-2 rounded-lg">
                  <QRCodeSVG value={qrDeger} size={72} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* YENİ: REKLAM / GEÇİŞ ALANI — normal ilan görünümüyle TAM AYNI yeri
            kaplıyor, sadece opacity ile görünür/gizlenir. Üst bölümdeki
            değişen TEK kısım burasıdır; alt bölüme ve ticker'a hiç dokunmaz. */}
        <div
          className={`absolute inset-0 rounded-2xl overflow-hidden bg-black transition-opacity duration-700 ${
            mod !== "ilan" ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {mod === "gecis" && (
            <video
              key="gecis-videosu"
              className="w-full h-full object-cover block"
              src="/reklam-gecis-video.mp4"
              autoPlay
              muted
              playsInline
              onEnded={() => setMod("reklam")}
            />
          )}
          {mod === "reklam" && guncelReklam && (
            guncelReklam.tur === "video" ? (
              <video
                key={guncelReklam.id}
                className="w-full h-full object-cover block"
                src={guncelReklam.medya_url}
                autoPlay
                muted
                playsInline
                onEnded={() => {
                  setReklamIndex((i) => i + 1);
                  setMod("ilan");
                }}
              />
            ) : (
              // Reklam GÖRSELLERİ object-contain ile gösteriliyor — object-cover
              // kullanılsaydı, reklam görselinin oranı ekran oranından farklıysa
              // üst/alt kısımları (ör. logo, "1 ay ücretsiz" etiketi) kırpılıp
              // ekrandan taşıyormuş gibi görünüyordu. object-contain görselin
              // TAMAMINI (gerekirse yanlarda/üstte-altta boşluk bırakarak) gösterir.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={guncelReklam.id}
                src={guncelReklam.medya_url}
                alt="Reklam"
                className="w-full h-full object-contain block"
              />
            )
          )}
        </div>
      </div>

      {/* ALT BÖLÜM — SADECE "ilan" modunda görünür. Reklam/geçiş modunda
          tamamen gizleniyor ki reklam alanı (yukarıdaki flex-1 kutu) bu
          boşalan alanı da kullanarak neredeyse tam ekran gösterilebilsin. */}
      {mod === "ilan" && (
        <div className="h-[150px] grid grid-cols-[1.4fr_1fr] gap-3">
          <div className="altin-kenarlik p-4 flex flex-col">
            <div className="font-bold mb-2 text-altin text-lg">Diğer Öne Çıkan İlanlar</div>
            <div className="flex-1 grid grid-cols-2 gap-3">
              {digerIlanlar.map((d) => (
                <div key={d.id} className="flex gap-2 bg-black/30 rounded-lg overflow-hidden">
                  {d.fotograflar[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.fotograflar[0]} alt={d.baslik} className="w-20 h-full object-cover block shrink-0" />
                  )}
                  <div className="py-1 pr-2 text-sm flex flex-col justify-center">
                    <div className="font-bold uppercase">
                      {d.durumEtiketi} {d.baslik}
                    </div>
                    <div className="text-white/60">
                      {d.odaSayisi ?? ""}
                      {d.metrekare ? `, ${d.metrekare} m²` : ""}
                    </div>
                    <div className="text-white/60">{d.konum}</div>
                    <div className="text-altin font-bold">{fiyatFormatla(d)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="altin-kenarlik p-3 h-full overflow-hidden flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-altin font-bold mb-0.5 text-lg">Bize Ulaşın</div>
                {ayarlar?.telefon && <div className="text-base leading-tight">📞 {ayarlar.telefon}</div>}
                {ayarlar?.website && <div className="text-base leading-tight">🌐 {ayarlar.website}</div>}
                {ayarlar?.instagram && <div className="text-base leading-tight">📷 {ayarlar.instagram}</div>}
              </div>
            </div>
            <div className="text-center italic text-white/70 text-xs leading-tight mt-0.5">
              Güveniniz en değerli referansımızdır. Teşekkür ederiz. ♡
            </div>
          </div>
        </div>
      )}

      {/* TICKER — alan iki katına çıkarıldı (h-12 -> h-24), yazılar büyütüldü */}
      <div className="h-24 bg-red-600 rounded-xl flex items-center px-4 gap-4">
        <span className="bg-white text-red-600 font-bold text-xl px-3 py-2 rounded">SON DAKİKA</span>
        <div className="flex-1 overflow-hidden">
          <div
            className="inline-flex whitespace-nowrap animate-marquee"
            style={{ animationDuration: `${tickerSuresi}s` }}
          >
            <span className="text-3xl text-white font-bold pr-24">{tickerMetni}</span>
            <span className="text-3xl text-white font-bold pr-24" aria-hidden="true">
              {tickerMetni}
            </span>
          </div>
        </div>
        <span className="text-xl text-white/90 font-mono">{saat}</span>
      </div>
    </div>
    </OlcekliCerceve>
  );
}

function Ozellik({ etiket }: { etiket: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-altin">•</span>
      <span>{etiket}</span>
    </div>
  );
}