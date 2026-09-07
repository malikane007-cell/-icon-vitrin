"use client";

import { useEffect, useRef, useState } from "react";
import type { Ayarlar, Reklam, Yorum } from "@/lib/types";

export default function YonetimSayfasi() {
  const [oturumAcik, setOturumAcik] = useState<boolean | null>(null); // null = kontrol ediliyor
  const [sifre, setSifre] = useState("");
  const [girisHata, setGirisHata] = useState("");

  const [ayarlar, setAyarlar] = useState<Ayarlar | null>(null);
  const [yorumlar, setYorumlar] = useState<Yorum[]>([]);
  const [reklamlar, setReklamlar] = useState<Reklam[]>([]);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [mesaj, setMesaj] = useState("");
  const dosyaInputRef = useRef<HTMLInputElement>(null);
  const reklamDosyaInputRef = useRef<HTMLInputElement>(null);

  const [yeniIsim, setYeniIsim] = useState("");
  const [yeniYorum, setYeniYorum] = useState("");
  const [yeniSira, setYeniSira] = useState(0);

  // YENİ: Reklam ekleme formu alanları.
  const [reklamTur, setReklamTur] = useState<"gorsel" | "video">("gorsel");
  const [reklamSure, setReklamSure] = useState(10);
  const [reklamYukleniyor, setReklamYukleniyor] = useState(false);

  async function veriYukle() {
    const [ayarRes, yorumRes, reklamRes] = await Promise.all([
      fetch("/api/admin/ayarlar"),
      fetch("/api/admin/yorumlar"),
      fetch("/api/admin/reklamlar"),
    ]);

    // ÖNEMLİ: Sadece "başarılı" (200) yanıtta girişi kabul ediyoruz. Eskiden
    // sadece 401'i kontrol ediyorduk; SUPABASE_SERVICE_ROLE_KEY eksik olduğunda
    // sunucu 500 döndürüyordu ve bu yanlışlıkla "giriş yapılmış" sayılıp panel
    // şifresiz açılmış gibi görünüyordu. Artık 401 dışındaki hatalarda da
    // login ekranında sebebi gösteriyoruz.
    if (!ayarRes.ok) {
      setOturumAcik(false);
      if (ayarRes.status !== 401) {
        const veri = await ayarRes.json().catch(() => null);
        setGirisHata(veri?.hata ?? `Sunucu hatası (kod ${ayarRes.status}).`);
      }
      return;
    }

    setOturumAcik(true);
    const ayarVeri = await ayarRes.json();
    const yorumVeri = await yorumRes.json();
    const reklamVeri = await reklamRes.json().catch(() => ({ reklamlar: [] }));
    setAyarlar(ayarVeri.ayarlar);
    setYorumlar(yorumVeri.yorumlar ?? []);
    setReklamlar(reklamVeri.reklamlar ?? []);
  }

  useEffect(() => {
    veriYukle();
  }, []);

  async function girisYap(e: React.FormEvent) {
    e.preventDefault();
    setGirisHata("");
    const res = await fetch("/api/admin/giris", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sifre }),
    });
    if (!res.ok) {
      const veri = await res.json();
      setGirisHata(veri.hata ?? "Giriş başarısız.");
      return;
    }
    setSifre("");
    veriYukle();
  }

  async function cikisYap() {
    await fetch("/api/admin/cikis", { method: "POST" });
    setOturumAcik(false);
  }

  async function ayarlariKaydet() {
    if (!ayarlar) return;
    setKaydediliyor(true);
    setMesaj("");
    const res = await fetch("/api/admin/ayarlar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ayarlar),
    });
    setKaydediliyor(false);
    if (res.ok) {
      setMesaj("Kaydedildi.");
    } else {
      const veri = await res.json();
      setMesaj("Hata: " + (veri.hata ?? "bilinmiyor"));
    }
  }

  async function logoYukle() {
    const dosya = dosyaInputRef.current?.files?.[0];
    if (!dosya) return;
    setMesaj("Logo yükleniyor...");
    const formData = new FormData();
    formData.append("logo", dosya);
    const res = await fetch("/api/admin/logo", { method: "POST", body: formData });
    const veri = await res.json();
    if (res.ok) {
      setAyarlar((onceki) => (onceki ? { ...onceki, logo_url: veri.logoUrl } : onceki));
      setMesaj("Logo güncellendi.");
    } else {
      setMesaj("Hata: " + (veri.hata ?? "bilinmiyor"));
    }
  }

  async function yorumEkle() {
    if (!yeniIsim || !yeniYorum) return;
    const res = await fetch("/api/admin/yorumlar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isim: yeniIsim, yorum: yeniYorum, sira: yeniSira }),
    });
    if (res.ok) {
      setYeniIsim("");
      setYeniYorum("");
      setYeniSira(0);
      veriYukle();
    }
  }

  async function yorumGuncelle(y: Yorum) {
    await fetch("/api/admin/yorumlar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(y),
    });
    setMesaj("Yorum güncellendi.");
  }

  async function yorumSil(id: string) {
    await fetch("/api/admin/yorumlar", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    veriYukle();
  }

  // YENİ: Reklam yükleme / silme — yorumlarla aynı mantık, tek fark dosya
  // yüklemesi gerektiği için FormData kullanılması (logoYukle ile aynı desen).
  async function reklamYukle() {
    const dosya = reklamDosyaInputRef.current?.files?.[0];
    if (!dosya) {
      setMesaj("Önce bir görsel veya video dosyası seçin.");
      return;
    }
    setReklamYukleniyor(true);
    setMesaj("Reklam yükleniyor...");
    const formData = new FormData();
    formData.append("reklam", dosya);
    formData.append("tur", reklamTur);
    if (reklamTur === "gorsel") {
      formData.append("sure_saniye", String(reklamSure));
    }
    const res = await fetch("/api/admin/reklam-yukle", { method: "POST", body: formData });
    const veri = await res.json();
    setReklamYukleniyor(false);
    if (res.ok) {
      setMesaj("Reklam eklendi.");
      if (reklamDosyaInputRef.current) reklamDosyaInputRef.current.value = "";
      veriYukle();
    } else {
      setMesaj("Hata: " + (veri.hata ?? "bilinmiyor"));
    }
  }

  async function reklamSil(id: string) {
    await fetch("/api/admin/reklamlar", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    veriYukle();
  }

  if (oturumAcik === null) {
    return <div className="min-h-screen bg-vitrinbg text-white flex items-center justify-center">Yükleniyor...</div>;
  }

  if (!oturumAcik) {
    return (
      <div className="min-h-screen bg-vitrinbg text-white flex items-center justify-center">
        <form onSubmit={girisYap} className="bg-vitrinpanel p-8 rounded-2xl w-80 flex flex-col gap-3">
          <div className="text-xl font-bold text-altin mb-2">Vitrin Yönetim Girişi</div>
          <input
            type="password"
            placeholder="Şifre"
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            className="bg-black/30 rounded-lg px-3 py-2 outline-none"
            autoFocus
          />
          {girisHata && <div className="text-red-400 text-sm">{girisHata}</div>}
          <button type="submit" className="bg-altin text-black font-bold rounded-lg py-2 mt-2">
            Giriş Yap
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-vitrinbg text-white p-6 pb-16 flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-bold text-altin">Vitrin Yönetim Paneli</div>
        <button onClick={cikisYap} className="text-sm text-white/60 underline">
          Çıkış yap
        </button>
      </div>

      {mesaj && <div className="bg-black/30 rounded-lg px-3 py-2 text-sm">{mesaj}</div>}

      {/* LOGO */}
      <section className="bg-vitrinpanel rounded-2xl p-5">
        <div className="font-bold text-lg mb-3">Logo</div>
        <div className="flex items-center gap-4">
          {ayarlar?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ayarlar.logo_url} alt="Logo" className="h-16 bg-black/30 rounded-lg px-3 py-2" />
          ) : (
            <div className="text-white/50 text-sm">Henüz logo yok, şirket adı yazı olarak gösteriliyor.</div>
          )}
          <input ref={dosyaInputRef} type="file" accept="image/*" className="text-sm" />
          <button onClick={logoYukle} className="bg-altin text-black font-bold rounded-lg px-4 py-2 text-sm">
            Yükle
          </button>
        </div>
      </section>

      {/* AYARLAR */}
      {ayarlar && (
        <section className="bg-vitrinpanel rounded-2xl p-5 flex flex-col gap-3">
          <div className="font-bold text-lg mb-1">Şirket Bilgileri</div>
          <Alan etiket="Şirket Adı (logo yoksa gösterilir)" deger={ayarlar.sirket_adi} onChange={(v) => setAyarlar({ ...ayarlar, sirket_adi: v })} />
          <Alan etiket="Telefon" deger={ayarlar.telefon ?? ""} onChange={(v) => setAyarlar({ ...ayarlar, telefon: v })} />
          <Alan etiket="Website" deger={ayarlar.website ?? ""} onChange={(v) => setAyarlar({ ...ayarlar, website: v })} />
          <Alan etiket="Instagram" deger={ayarlar.instagram ?? ""} onChange={(v) => setAyarlar({ ...ayarlar, instagram: v })} />
          <Alan etiket="Alt bant (ticker) metni" deger={ayarlar.ticker_metni ?? ""} onChange={(v) => setAyarlar({ ...ayarlar, ticker_metni: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Alan
              etiket="Google Puanı (API kurulana kadar yedek)"
              deger={String(ayarlar.google_puan ?? "")}
              onChange={(v) => setAyarlar({ ...ayarlar, google_puan: v ? Number(v) : null })}
            />
            <Alan
              etiket="Google Yorum Sayısı (yedek)"
              deger={String(ayarlar.google_yorum_sayisi ?? "")}
              onChange={(v) => setAyarlar({ ...ayarlar, google_yorum_sayisi: v ? Number(v) : null })}
            />
          </div>
          <button
            onClick={ayarlariKaydet}
            disabled={kaydediliyor}
            className="bg-altin text-black font-bold rounded-lg py-2 mt-2 disabled:opacity-50"
          >
            {kaydediliyor ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </section>
      )}

      {/* YORUMLAR */}
      <section className="bg-vitrinpanel rounded-2xl p-5 flex flex-col gap-3">
        <div className="font-bold text-lg mb-1">
          Yorumlar (Google API kurulana kadar ekranda bunlar gösterilir)
        </div>
        {yorumlar.map((y) => (
          <div key={y.id} className="bg-black/30 rounded-lg p-3 flex flex-col gap-2">
            <input
              value={y.isim}
              onChange={(e) =>
                setYorumlar((onceki) => onceki.map((x) => (x.id === y.id ? { ...x, isim: e.target.value } : x)))
              }
              className="bg-black/40 rounded px-2 py-1 text-sm"
              placeholder="İsim"
            />
            <textarea
              value={y.yorum}
              onChange={(e) =>
                setYorumlar((onceki) => onceki.map((x) => (x.id === y.id ? { ...x, yorum: e.target.value } : x)))
              }
              className="bg-black/40 rounded px-2 py-1 text-sm"
              placeholder="Yorum metni"
              rows={2}
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={y.sira}
                onChange={(e) =>
                  setYorumlar((onceki) =>
                    onceki.map((x) => (x.id === y.id ? { ...x, sira: Number(e.target.value) } : x))
                  )
                }
                className="bg-black/40 rounded px-2 py-1 text-sm w-20"
                placeholder="Sıra"
              />
              <button onClick={() => yorumGuncelle(y)} className="bg-altin text-black text-xs font-bold rounded px-3 py-1">
                Kaydet
              </button>
              <button onClick={() => yorumSil(y.id)} className="text-red-400 text-xs underline ml-auto">
                Sil
              </button>
            </div>
          </div>
        ))}

        <div className="bg-black/20 rounded-lg p-3 flex flex-col gap-2">
          <div className="text-sm text-white/60">Yeni yorum ekle</div>
          <input
            value={yeniIsim}
            onChange={(e) => setYeniIsim(e.target.value)}
            placeholder="İsim"
            className="bg-black/40 rounded px-2 py-1 text-sm"
          />
          <textarea
            value={yeniYorum}
            onChange={(e) => setYeniYorum(e.target.value)}
            placeholder="Yorum metni"
            rows={2}
            className="bg-black/40 rounded px-2 py-1 text-sm"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={yeniSira}
              onChange={(e) => setYeniSira(Number(e.target.value))}
              placeholder="Sıra"
              className="bg-black/40 rounded px-2 py-1 text-sm w-20"
            />
            <button onClick={yorumEkle} className="bg-altin text-black text-xs font-bold rounded px-3 py-1">
              Ekle
            </button>
          </div>
        </div>
      </section>

      {/* YENİ: REKLAMLAR — her 10 ilanda bir TV'de gösterilecek reklam
          görselleri/videoları. Sınırsız sayıda eklenip silinebilir. */}
      <section className="bg-vitrinpanel rounded-2xl p-5 flex flex-col gap-3">
        <div className="font-bold text-lg mb-1">
          Reklamlar (her 10 ilanda bir sırayla gösterilir)
        </div>

        {reklamlar.length === 0 && (
          <div className="text-white/50 text-sm">Henüz reklam eklenmedi.</div>
        )}

        {reklamlar.map((r) => (
          <div key={r.id} className="bg-black/30 rounded-lg p-3 flex items-center gap-3">
            {r.tur === "gorsel" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.medya_url} alt="Reklam" className="w-24 h-16 object-cover rounded shrink-0" />
            ) : (
              <div className="w-24 h-16 rounded bg-black/50 flex items-center justify-center text-xs text-white/60 shrink-0">
                ▶ Video
              </div>
            )}
            <div className="flex-1 text-sm text-white/70">
              <div>{r.tur === "gorsel" ? "Görsel" : "Video"}</div>
              {r.tur === "gorsel" && <div>Süre: {r.sure_saniye ?? 10} sn</div>}
            </div>
            <button onClick={() => reklamSil(r.id)} className="text-red-400 text-xs underline">
              Sil
            </button>
          </div>
        ))}

        <div className="bg-black/20 rounded-lg p-3 flex flex-col gap-2">
          <div className="text-sm text-white/60">Yeni reklam ekle</div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-sm">
              <input
                type="radio"
                checked={reklamTur === "gorsel"}
                onChange={() => setReklamTur("gorsel")}
              />
              Görsel
            </label>
            <label className="flex items-center gap-1 text-sm">
              <input
                type="radio"
                checked={reklamTur === "video"}
                onChange={() => setReklamTur("video")}
              />
              Video
            </label>
          </div>
          {reklamTur === "gorsel" && (
            <label className="flex items-center gap-2 text-sm">
              Gösterim süresi (saniye)
              <input
                type="number"
                value={reklamSure}
                onChange={(e) => setReklamSure(Number(e.target.value))}
                className="bg-black/40 rounded px-2 py-1 text-sm w-20"
              />
            </label>
          )}
          <input
            ref={reklamDosyaInputRef}
            type="file"
            accept={reklamTur === "gorsel" ? "image/*" : "video/*"}
            className="text-sm"
          />
          <button
            onClick={reklamYukle}
            disabled={reklamYukleniyor}
            className="bg-altin text-black text-xs font-bold rounded px-3 py-2 disabled:opacity-50"
          >
            {reklamYukleniyor ? "Yükleniyor..." : "Reklamı Ekle"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Alan({
  etiket,
  deger,
  onChange,
}: {
  etiket: string;
  deger: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-white/60">{etiket}</span>
      <input
        value={deger}
        onChange={(e) => onChange(e.target.value)}
        className="bg-black/30 rounded-lg px-3 py-2 outline-none"
      />
    </label>
  );
}