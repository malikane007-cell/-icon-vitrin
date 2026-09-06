"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import { getVitrinIlanlari, type OfisIlani } from "@/lib/iconilan-listings";
import type { Ayarlar, GoogleYorumYaniti, Yorum } from "@/lib/types";

const ROTASYON_SURESI_MS = 18000; // her ilanda kalma süresi
const FOTO_ROTASYON_MS = 5000; // videosu olmayan ilanlarda fotoğraf değişim süresi
const ILAN_YENIDEN_CEKME_MS = 5 * 60 * 1000; // iconilan.com'dan veri tazeleme sıklığı
const YORUM_YENIDEN_CEKME_MS = 30 * 60 * 1000; // Google yorumu tazeleme sıklığı

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
  const [googleYorum, setGoogleYorum] = useState<GoogleYorumYaniti | null>(null);
  const [index, setIndex] = useState(0);
  const [fotoIndex, setFotoIndex] = useState(0);
  const [videoHata, setVideoHata] = useState(false);
  const [fotoHata, setFotoHata] = useState(false);
  const [yorumIndex, setYorumIndex] = useState(0);
  const [saat, setSaat] = useState("");

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

  // Şirket bilgileri + manuel yorum yedeği — kendi Supabase projemizden
  useEffect(() => {
    async function ayarlariCek() {
      const [ayarRes, yorumRes] = await Promise.all([
        supabase.from("ayarlar").select("*").eq("id", 1).maybeSingle(),
        supabase.from("yorumlar").select("*").order("sira", { ascending: true }),
      ]);
      if (ayarRes.data) setAyarlar(ayarRes.data as Ayarlar);
      if (yorumRes.data) setYorumlar(yorumRes.data as Yorum[]);
    }
    ayarlariCek();
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

  // İlanlar arası otomatik dönüş
  useEffect(() => {
    if (ilanlar.length < 2) return;
    const donus = setInterval(() => {
      setIndex((onceki) => (onceki + 1) % ilanlar.length);
    }, ROTASYON_SURESI_MS);
    return () => clearInterval(donus);
  }, [ilanlar.length]);

  useEffect(() => {
    if (index >= ilanlar.length) setIndex(0);
  }, [ilanlar.length, index]);

  const guncel = ilanlar[index];

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
      {/* ÜST BÖLÜM */}
      <div className="flex-1 grid grid-cols-[320px_1fr_420px] gap-3 min-h-0">
        {/* SOL PANEL */}
        <div key={`sol-${guncel.id}`} className="bg-vitrinpanel rounded-2xl p-5 flex flex-col overflow-hidden animate-fadein">
          <div className="flex items-center gap-3 mb-1">
            {ayarlar?.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ayarlar.logo_url} alt={sirketAdi} className="h-12 w-12 object-contain shrink-0" />
            )}
            <div className="text-3xl font-extrabold text-altin tracking-wide glow-altin-text">
              {sirketAdi}
            </div>
          </div>
          <div className="h-px bg-white/10 my-3" />
          <div className="text-lg font-bold uppercase mb-4">
            {guncel.durumEtiketi} {guncel.baslik}
          </div>

          <div className="flex flex-col gap-3 text-white/90 text-[15px]">
            <Ozellik etiket={guncel.konum} />
            {guncel.metrekare && <Ozellik etiket={`${guncel.metrekare} m²`} />}
            {guncel.odaSayisi && <Ozellik etiket={guncel.odaSayisi} />}
            {guncel.kat && <Ozellik etiket={guncel.kat} />}
          </div>

          {tumOzellikler.length > 0 && (
            <div className="mt-4 min-h-0 overflow-hidden">
              <div className="text-sm font-bold text-altin mb-2">Öne Çıkan Özellikler</div>
              <div className="flex flex-col gap-1.5 text-[13px]">
                {tumOzellikler.map((etiket, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-altin/20 flex items-center justify-center text-altin text-[10px] shrink-0">
                      ●
                    </span>
                    <span className="truncate">{etiket}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-auto pt-4">
            <div className="bg-altin text-black font-extrabold text-2xl rounded-xl px-4 py-3 text-center glow-altin-box">
              {fiyatFormatla(guncel)}
            </div>
          </div>
        </div>

        {/* ORTA - FOTOĞRAF / VİDEO (otomatik) */}
        <div key={`orta-${guncel.id}`} className="rounded-2xl overflow-hidden relative bg-black animate-fadein">
          {guncel.videoUrl && !videoHata ? (
            <video
              key={guncel.videoUrl}
              className="w-full h-full object-cover"
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
              className="w-full h-full object-cover animate-fadein"
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
          <div className="bg-vitrinpanel rounded-2xl p-4 flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="text-right text-[11px] font-bold text-white/60 uppercase tracking-wide mb-2">
              Müşterilerimiz Ne Diyor?
            </div>
            <div className="grid grid-cols-[0.55fr_1.9fr] gap-4 items-stretch flex-1 min-h-0">
              <div className="shrink-0">
                <div className="text-2xl font-bold leading-none mb-2">
                  <span style={{ color: "#4285F4" }}>G</span>
                  <span style={{ color: "#EA4335" }}>o</span>
                  <span style={{ color: "#FBBC05" }}>o</span>
                  <span style={{ color: "#4285F4" }}>g</span>
                  <span style={{ color: "#34A853" }}>l</span>
                  <span style={{ color: "#EA4335" }}>e</span>
                </div>
                {gPuan != null && (
                  <div className="text-altin font-extrabold text-2xl leading-tight glow-altin-text">
                    {Number(gPuan).toFixed(1)}
                    <div className="text-lg tracking-wider">★★★★★</div>
                  </div>
                )}
                {gYorumSayisi != null && (
                  <div className="text-white/60 text-xs mt-1">({gYorumSayisi}+ Yorum)</div>
                )}
              </div>
              {gosterilecekYorum && (
                <div key={yorumIndex} className="bg-black/30 rounded-lg p-4 text-base animate-fadein flex flex-col justify-center h-full overflow-hidden">
                  <div className="text-altin text-2xl leading-none mb-1 glow-altin-text">&ldquo;</div>
                  <div className="text-white/80 italic line-clamp-5 leading-relaxed">{gosterilecekYorum.yorum}</div>
                  <div className="text-altin mt-2 font-semibold">— {gosterilecekYorum.isim}</div>
                  <div className="text-altin text-sm tracking-wider glow-altin-text">★★★★★</div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-vitrinpanel rounded-2xl p-4 flex items-center gap-4 shrink-0">
            <div className="flex-1">
              <div className="font-bold mb-1">Bu İlanın Detayları</div>
              <div className="text-white/60 text-xs">
                iconilan.com&apos;daki ilan sayfası için QR kodu okutun.
              </div>
            </div>
            <div className="bg-white p-2 rounded-lg">
              <QRCodeSVG value={qrDeger} size={72} />
            </div>
          </div>
        </div>
      </div>

      {/* ALT BÖLÜM */}
      <div className="h-[150px] grid grid-cols-[1.4fr_1fr] gap-3">
        <div className="bg-vitrinpanel rounded-2xl p-4 flex flex-col">
          <div className="font-bold mb-2 text-altin">Diğer Öne Çıkan İlanlar</div>
          <div className="flex-1 grid grid-cols-2 gap-3">
            {digerIlanlar.map((d) => (
              <div key={d.id} className="flex gap-2 bg-black/30 rounded-lg overflow-hidden">
                {d.fotograflar[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.fotograflar[0]} alt={d.baslik} className="w-20 h-full object-cover" />
                )}
                <div className="py-1 pr-2 text-xs flex flex-col justify-center">
                  <div className="font-bold uppercase">
                    {d.durumEtiketi} {d.baslik}
                  </div>
                  <div className="text-white/60">
                    {d.odaSayisi ?? ""}
                    {d.metrekare ? `, ${d.metrekare} m²` : ""}
                  </div>
                  <div className="text-white/60">{d.konum}</div>
                  <div className="text-altin font-bold glow-altin-text">{fiyatFormatla(d)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-vitrinpanel rounded-2xl p-3 h-full overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-altin font-bold mb-0.5">Bize Ulaşın</div>
              {ayarlar?.telefon && <div className="text-sm leading-tight">📞 {ayarlar.telefon}</div>}
              {ayarlar?.website && <div className="text-sm leading-tight">🌐 {ayarlar.website}</div>}
              {ayarlar?.instagram && <div className="text-sm leading-tight">📷 {ayarlar.instagram}</div>}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/deneyim-rozeti.png"
              alt="10 Yıllık Deneyim"
              className="w-28 h-28 rounded-full object-cover shrink-0 ring-2 ring-altin/70 shadow-[0_0_16px_rgba(251,191,36,0.4)]"
            />
          </div>
          <div className="text-center italic text-white/70 text-[10px] leading-tight mt-0.5">
            Güveniniz en değerli referansımızdır. Teşekkür ederiz. ♡
          </div>
        </div>
      </div>

      {/* TICKER */}
      <div className="h-12 bg-red-600 rounded-xl flex items-center px-3 gap-3">
        <span className="bg-white text-red-600 font-bold text-sm px-2 py-1 rounded">SON DAKİKA</span>
        <div className="flex-1 overflow-hidden">
          <div
            className="inline-flex whitespace-nowrap animate-marquee"
            style={{ animationDuration: `${tickerSuresi}s` }}
          >
            <span className="text-lg text-white font-bold pr-24">{tickerMetni}</span>
            <span className="text-lg text-white font-bold pr-24" aria-hidden="true">
              {tickerMetni}
            </span>
          </div>
        </div>
        <span className="text-sm text-white/90 font-mono">{saat}</span>
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
