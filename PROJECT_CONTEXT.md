# Çavuşzade Baklava Menüsü — Proje Durumu

**Son güncelleme:** 2026-08-15
**Amacı:** Başka bir bilgisayarda çalışmaya devam edecek olan için durum özeti.
Buradaki her madde dosyalardan okunarak doğrulandı, hafızadan yazılmadı.

## Proje nedir

Çavuşzade Baklava (Brüksel) için masa QR menüsü. Tek sayfa: `menu/index.html`
içinde CSS ve JS gömülü; görseller ve animasyon `menu/img/` altında ayrı
dosyalar (base64 değil — WebP ve MP4 olarak servis ediliyor).

**Hedef adres:** cavuszadebruxelles.com/menu
**Durum: YAYINDA DEĞİL** — GitHub Pages derlemesi başarısız (aşağıda).

## Dosya yapısı

```
cavuszade/
├── menu/
│   ├── index.html                    menünün tamamı (~52 KB)
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

## Açık işler

### 🔴 GitHub Pages derlemesi başarısız — her şeyi bloke ediyor

2026-08-06'dan beri derleme tamamlanmıyor; API'de hata ayrıntısı görünmüyor,
durum "building"de kalıyor. Menü bu yüzden yayında değil.

**En olası sebep Jekyll.** Denenecek ilk şey — `.nojekyll` **henüz
oluşturulmadı**, sadece öneri aşamasında:

```bash
touch .nojekyll && git add .nojekyll && git commit -m "Disable Jekyll build" && git push
```

Sonra GitHub → Settings → Pages → build log'una bakılmalı. Bu çözmezse
Actions sekmesindeki başarısız çalışmanın log'u okunmalı.

### 🟡 Baklava fiyatları teyit edilmemiş

Kaynak `cavuszadebruxelles.html`, **26 Mart 2026** tarihli — dört aydan eski.
Kodun içinde de uyarı var: "QR basılmadan önce bu fiyatlar teyit edilmeli."
İşletmeden güncel liste alınmalı.

İçecek fiyatları (Su €1, Soda €2) güncel görünüyor, ayrıca teyit edilebilir.

### 🟡 Yayın öncesi: `noindex` kaldırılmalı

`menu/index.html` başında `<meta name="robots" content="noindex, nofollow">`
var — fiyatlar kesinleşene kadar arama motorlarına kapalı olsun diye. Menü
yayına alınırken bu satır silinmeli.

### ⚪ QR kod

Sayfa yayına girdikten sonra cavuszadebruxelles.com/menu için QR üretilip
masalara konacak.

---

## Sırayla ne yapılmalı

1. `.nojekyll` ile Pages derlemesini kurtar → menü yayına girsin
2. İşletmeden güncel fiyatları al, `PRODUCTS` dizisini güncelle
3. `noindex` meta etiketini kaldır
4. QR kodu üret

## Yeni bir oturuma başlarken

```bash
git log --oneline -15
git status
```

Sonra `docs/halka-animasyonu-notlari.md` dosyasını oku — animasyonla ilgili
her karar ve ölçüm orada. Aynı çıkmaz sokaklara tekrar girmemek için
"denendi, olmadı" bölümleri özellikle önemli.
