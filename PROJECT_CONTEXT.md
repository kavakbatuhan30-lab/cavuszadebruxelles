# Çavuşzade Baklava Menüsü — Proje Durumu

**Son güncelleme:** 2026-08-22
**Amacı:** Başka bir bilgisayarda çalışmaya devam edecek olan için durum özeti.
Buradaki her madde dosyalardan okunarak doğrulandı, hafızadan yazılmadı.

## Proje nedir

Çavuşzade Baklava (Brüksel) için masa QR menüsü. Tek sayfa: `menu/index.html`
içinde CSS ve JS gömülü; görseller ve animasyon `menu/img/` altında ayrı
dosyalar (base64 değil — WebP ve MP4 olarak servis ediliyor).

**Adres:** cavuszadebruxelles.com/menu
**Durum: YAYINDA** (2026-08-22 doğrulandı — HTTP 200, tüm görseller ve
animasyon canlıda çalışıyor).

## Dosya yapısı

```
cavuszade/
├── menu/
│   ├── index.html                    menünün tamamı (~52 KB)
│   ├── qr/
│   │   ├── cavuszade-menu.svg        vektör — BASKI İÇİN BUNU KULLAN
│   │   └── cavuszade-menu.png        2000×2000 raster
│   └── img/
│       ├── ring.mp4                  387 KB, dönen baklava animasyonu
│       ├── ring-poster.webp          10,6 KB, animasyonun ilk karesi
│       └── *.webp                    8 ürün fotoğrafı + logo
├── docs/
│   ├── halka-animasyonu-notlari.md   ⚠️ ÖNCE BUNU OKU — ölçümler, denenip
│   │                                 bırakılan sürümler ve nedenleri
│   └── 2026-08-04-qr-menu-design.md  ilk tasarım kararları
├── index.html                        ana site (menü değil)
├── imgcavuszade/                     ana sitenin görselleri
└── .gitignore
```

**Repoda olmayan:** `animo-showcase-stream-720p.mp4` (80 MB kaynak video,
`.gitignore`'da). Yalnızca animasyonu yeniden kodlamak gerekirse lazım —
türetilmiş `ring.mp4` repoda olduğu için menü üzerinde çalışmaya engel değil.

## Menüde ne var

| | |
|---|---|
| **Baklava** | 8 çeşit, **sadece kilogram fiyatı** (€30–48). Adet/dilim fiyatı bilinçli olarak yok. |
| **İçecek** | **2 kalem**, adet fiyatı: Su €1,00 · Meyveli Soda €2,00. Fotoğrafsız satır olarak görünüyorlar. |
| **Diller** | TR / FR / NL / EN. Ürün adları dört dilde de Türkçe kalır, sadece açıklamalar çevrilir. |
| **Dil seçimi** | Açılış perdesinde bayraklarla. `localStorage`'da saklanıyor. |
| **Animasyon** | Açılış perdesinin ortasında dönen baklava madalyonu. |

Fiyatlar ve ürünler tek yerde: `menu/index.html` içindeki `PRODUCTS` dizisi
(~873. satır). Dosyanın başındaki yorum "düzenlemek için burayı değiştir,
başka yeri değil" diyor.

> **Not:** Parça/adet seçici bir ara vardı, sonradan kaldırıldı. Baklavalarda
> yalnızca kg fiyatı gösteriliyor. Geri isteniyorsa sıfırdan yazılması gerekir.

## Animasyon durumu

**Kullanımda: koyu madalyon sürümü.** Video siyah zeminde dönen tabak halkası;
koyu bir dairenin içinde `mix-blend-mode: screen` ile birleşiyor. Böylece sayfa
zemininin rengi denklemden çıkıyor — kağıt rengi değişse bile videoya
dokunmak gerekmiyor.

- `menu/img/ring.mp4` — 560×560, 30 fps, 16,00 sn, 387 KB
- Döngü periyodu tahmin değil ölçüm: t=16'daki kare t=0 ile aynı (RMS 0,29)

**Denenip geri alınan: şeffaf zemin (gerçek alfa kanalı).** VP9/WebM + colorkey
ile teknik olarak çalıştı, ama üç bedeli vardı:

- iPhone'da animasyon yok — Safari VP9 alfayı güvenilir desteklemiyor
- Dosya %64 daha büyük (635 KB)
- Sönük arka tabaklar krem zeminde kirli gri leke gibi durduğu için kesilmek
  zorunda kaldı; halka 8 yerine ~4 tabağa düştü

Şeffaf sürümün dosyaları `Desktop\cavuszade-ring-yedek\seffaf-surumu\`
klasöründe duruyor (repoda değil). Gerekçelerin tamamı ve ffmpeg komutları
`docs/halka-animasyonu-notlari.md` içinde.

---

## Tamamlanan yayın adımları (2026-08-22)

### ✅ GitHub Pages derlemesi — sorun kendiliğinden çözüldü

2026-08-06'daki derleme hatası artık yok; `.nojekyll` **hiç gerekmedi**,
oluşturulmadı. Sayfa 2026-08-22'de 200 dönüyor, `Last-Modified` son commit
ile uyuşuyor. Bu madde kapandı — tekrar araştırmaya gerek yok.

### ✅ Fiyatlar teyit edildi

İşletme sahibi 2026-08-22'de listenin tamamını onayladı. `PRODUCTS`
dizisindeki değerler (baklava €30–48/kg, Su €1, Soda €2) **güncel ve
doğrudur**. Kodun içindeki "basılmadan önce teyit edilmeli" uyarısı bu
onayla karşılanmıştır.

### ✅ `noindex` kaldırıldı

`menu/index.html` artık arama motorlarına açık. Yerine `meta description`
eklendi ve `/menu/` `sitemap.xml`'e girdi. Google'ın sayfayı indekslemesi
birkaç gün sürebilir.

### ✅ QR kod üretildi

`menu/qr/` altında. Hedef: `https://cavuszadebruxelles.com/menu/` (sondaki
eğik çizgi dahil — 301 yönlendirmesini atlar).

- **Hata düzeltme seviyesi H** (~%30 kurtarılabilir) — masada leke/parmak izi
  olasılığına karşı bilinçli seçim
- Sürüm 5, 37×37 modül
- Doğrulandı: PNG geri çözüldü, URL birebir eşleşti; ortasından %15×15'lik
  parça silindiğinde **hâlâ okunuyor**
- Baskıda `.svg` kullanılmalı. Sessiz alan (quiet zone) kırpılmamalı,
  yoksa okunmaz. Önerilen basılı boyut: en az 3×3 cm.

---

## Açık işler

### ⚪ Masaya koyma

QR basılıp masalara yerleştirilecek. Basımdan sonra birkaç farklı telefonla
(iOS + Android) gerçek masa ışığında taranıp test edilmesi iyi olur.

## Yeni bir oturuma başlarken

```bash
git log --oneline -15
git status
```

Sonra `docs/halka-animasyonu-notlari.md` dosyasını oku — animasyonla ilgili
her karar ve ölçüm orada. Aynı çıkmaz sokaklara tekrar girmemek için
"denendi, olmadı" bölümleri özellikle önemli.
