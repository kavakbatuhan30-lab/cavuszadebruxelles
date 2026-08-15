# Dönen baklava halkası — teknik notlar

Güncelleme: 2026-08-10
Durum: **Koyu madalyon sürümü çalışıyor** (`menu/img/ring.mp4`, 387 KB).
`menu/index.html` içinde, açılış perdesinin ortasında.

> **Şeffaf zemin denendi ve geri alındı.** Teknik olarak çalıştı ama üç bedeli
> vardı: iPhone'da animasyon yok, dosya %64 daha büyük, halka 8 yerine
> ~4 tabağa düştü. Ayrıntısı aşağıda. Dosyaları
> `Desktop\cavuszade-ring-yedek\seffaf-surumu\` içinde — geri dönülmek
> istenirse hazır.

## Denenen ve geri alınan: gerçek alfa kanalı (şeffaf zemin)

Siyah, ffmpeg'de `colorkey` ile kesilip video **VP9/WebM alfa kanalıyla**
saklanıyor. Tarayıcı şeffaflığı kendisi birleştiriyor — sayfa zemininin
rengiyle hiç alakası yok.

```bash
ffmpeg -y -t 16 -i animo-showcase-stream-720p.mp4 \
  -vf "crop=656:656:136:64,format=rgba,\
       colorkey=black:similarity=0.36:blend=0.10,\
       eq=saturation=1.16:contrast=1.09,\
       scale=440:440:flags=lanczos,fps=24,format=yuva420p" \
  -an -c:v libvpx-vp9 -pix_fmt yuva420p -crf 48 -b:v 0 \
  -row-mt 1 -deadline good -cpu-used 3 ring-alpha.webm
```

Çıktı: `ring-alpha.webm` 635 KB · `ring-alpha-poster.webp` 28 KB

### Ölçümle bulunan kararlar

**`lumakey` işe yaramadı.** Alfa düzlemi oluşturmuyor — ölçüldü: %0 tam
şeffaf. `format=rgba` + `colorkey` doğru sonucu veriyor (%85 şeffaf).

**`similarity=0.36`** — düşük eşik (0.09) uzaktaki sönük tabakları da
bırakıyor. Siyah zeminde "uzakta" duran o tabaklar krem zeminde **kirli gri
leke** gibi görünüyor; ekran görüntüsüyle doğrulandı. 0.36 onları tamamen
kesiyor. Döngü boyunca ön yay sürekli yenilendiği için boşluk oluşmuyor.

**`drop-shadow` şart.** Siyah zemin gidince tabaklara hacim veren kontrast da
gidiyor, düz ve soluk duruyorlar. Gölge alfa siluetini takip edip onları
kağıdın üstüne oturtuyor.

### Bilinen sınırlar

| Konu | Durum |
|---|---|
| **Safari / iPhone** | VP9 alfa güvenilir değil. Opak oynatırsa krem zeminde **siyah kare** çıkar. Bu yüzden Safari/iOS'ta video hiç yüklenmiyor, şeffaf poster kalıyor — yani **iPhone'da animasyon yok, sabit görüntü var.** |
| **Boyut** | 635 KB. Madalyonlu MP4 387 KB'tı. Alfa kanalı pahalı. |
| **Animasyonlu WebP** | Safari'de çalışırdı ama denendi: **5,4 MB**. Kullanılamaz. |
| **HEVC + alfa** | Safari'nin doğal şeffaf video formatı, ama Windows'ta üretilemiyor (libx265 alfa desteklemiyor, VideoToolbox yok). |
| **Sönük tabaklar** | Kesildi. Halka artık 8 değil ~4 tabak gösteriyor. |

---

## Kullanımdaki sürüm: koyu madalyon

Kaynak: `animo-showcase-stream-720p.mp4` (960×720, 60 fps, 64 sn, 80 MB).
Repo kökünde duruyor, `.gitignore`'da — repoya girmemeli.

## Şu anki çözüm

Video **koyu bir madalyonun içinde**, `mix-blend-mode: screen` ile birleşiyor.

`screen(taban, 0) = taban` olduğundan videonun siyahı ve sıkıştırma gürültüsü
madalyonun içinde kayboluyor. **Sayfa zemininin rengi hiç önemli değil** —
değiştirilse bile videoya dokunmak gerekmez.

`isolation: isolate` şart. Karışım madalyonun dışına taşarsa açık kağıt
zeminde her şeyi beyaza yıkar; izolasyon karışımı dairenin içine hapsediyor.

### ffmpeg komutu

```bash
ffmpeg -y -t 16 -i animo-showcase-stream-720p.mp4 \
  -vf "crop=656:656:136:64,\
       colorlevels=rimin=0.06:gimin=0.06:bimin=0.06,\
       scale=560:560:flags=lanczos,fps=30" \
  -an -c:v libx264 -profile:v main -level 3.1 -pix_fmt yuv420p \
  -crf 30 -preset slow -movflags +faststart ring.mp4

ffmpeg -y -i ring.mp4 -frames:v 1 -c:v libwebp -quality 78 ring-poster.webp
```

Çıktı: `ring.mp4` 387 KB · `ring-poster.webp` 10,6 KB
(önceki sürüm 1,19 MB'tı).

## Ölçümler — tahmin değil

| Ölçüm | Değer | Nasıl bulundu |
|---|---|---|
| Döngü periyodu | **16,00 sn** | t=16'daki kare t=0 ile aynı: RMS fark 0,29. Ardışık iki kare arası fark 21,62. |
| İçerik sınırları | 608×512 | Tüm karelerin en parlak hali, eşik %10 |
| İçerik merkezi | (464, 392) | Kare merkezi (480,360) **değil** — kaymış |
| Kırpma karesi | 656×656 @ (136,64) | Bu merkezde kaynağa sığan en büyük kare (alt sınır 720−392=328) |
| Halka yarıçapı | 304 px (kaynakta) | |
| Kırpılma payı | **16,2 px** (%5,8) | Döngü boyunca 8 karede ölçüldü; en uzak parlak piksel 263,8 / 280 |

## Dolgu kullanma — denendi, olmadı

İlk denemede içerik kırpılıp etrafına siyah dolgu eklenmişti
(`pad=768:768:80:128:black`). Ekranda **madalyonun ortasında açık bir
dikdörtgen** çıktı.

Sebep ölçüldü:

| Bölge | RGB |
|---|---|
| Dolgu | (0,0 · 0,0 · 0,0) |
| İçeriğin kendi zemini | (0,8 · 0,0 · 4,8) |

`screen` altında 0 tabanı hiç değiştirmiyor, 4,8 hafifçe kaldırıyor → sınır
görünür oluyor. **Kaynağı ne kadar ezersen ez bu fark kalır**, çünkü
kodlamadan sonra, parlak tabakların çevresindeki DCT titreşiminden oluşuyor.

Çözüm dolguyu tamamen kaldırmak oldu: kare doğrudan kaynaktan kırpılıyor,
bütün daire aynı zemin. İki bölge olmayınca sınır da olmuyor.

## Daha önceki yaklaşım — neden bırakıldı

Video `lumakey` ile siyahı şeffaflaştırılıp doğrudan krem kağıda
bindiriliyordu (`lumakey=0:0.32:0.04`, zemin `0xF2EAD9`'a gömülü).

İki sorunu vardı:

1. Zemin rengi 1–2 birim kaysa videonun dikdörtgeni ortaya çıkıyordu; her
   zemin değişiminde video yeniden kodlanmalıydı.
2. Eşik ayarı hassastı — geniş rampa tabakların gövdesini kısmen şeffaf
   yapıp baklavaların içini saydam gösteriyordu.

Madalyon yaklaşımı bu sorun sınıfının tamamını ortadan kaldırıyor.

Eski yaklaşımın ölçtüğü parlaklık değerleri hâlâ geçerli ve işe yaradı —
siyah ezme eşiğini (0,06) buradan seçtim:

| Bölge | Parlaklık |
|---|---|
| fon | 0,002 |
| uzaktaki tabaklar | ortanca 0,18, en fazla 0,30 |
| öndeki tabaklar | ortanca 0,68 |

0,06 fon ile en sönük tabak arasında güvenli bir yerde.

## Ağ ve erişilebilirlik davranışı

- `preload="none"`, `src` JS'ten veriliyor
- `prefers-reduced-motion`, `saveData` veya 2G → video **hiç indirilmez**
- O durumda `poster` (10,6 KB) ekranda kalır — boş kutu görünmez
- Poster videonun 0. karesi, oynatma da 0'dan başlar: geçiş görünmez
- Perde kapanınca video duraklatılır, açılınca devam eder
- `max-height: 480px` (yatay telefon) → madalyon gizlenir, dil düğmeleri öncelikli

## Doğrulandı

Tarayıcıda ölçüldü: madalyon 337 px daire, `isolation:isolate`,
`mix-blend-mode:screen`, video `readyState 4`, süre tam 16,00 sn, `loop`
açık, zaman ilerliyor. Poster ve video HTTP 200. Azaltılmış harekette
`ringAllowed()` false, normalde true. Perde kapanınca `paused` true,
açılınca false. 375×812'de taşma yok, dil düğmeleri ekranda. Konsol hatası yok.
