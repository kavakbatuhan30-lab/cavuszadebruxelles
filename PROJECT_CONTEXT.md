# Çavuşzade Baklava Menüsü — Proje Durumu

**Son güncelleme:** 2026-08-30
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
├── admin/index.html                  tezgâh paneli — TEK sayfa, üç sekme:
│                                     Sipariş · Stok · Rapor
├── worker/                           Cloudflare Worker (stok + sipariş)
│   ├── src/{stock,sales,auth,index}.js
│   ├── test/                         120 test
│   ├── scripts/sifre-kur.mjs         panel şifresini kurar
│   └── wrangler.jsonc
├── docs/
│   ├── halka-animasyonu-notlari.md   ⚠️ animasyona dokunacaksan ÖNCE BUNU OKU
│   ├── 2026-08-30-siparis-defteri-design.md  ⚠️ satış/kasa konusuna
│   │                                 girmeden ÖNCE BUNU OKU (GKS sınırı)
│   ├── 2026-08-28-stok-yonetimi-design.md   stok tasarımı + gerekçeler
│   ├── 2026-08-28-stok-yonetimi-plan.md     uygulama planı
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

---

## Stok yönetimi (2026-08-28'de yayına alındı)

Dükkân sahibi `cavuszadebruxelles.com/admin/` adresinden bir ürünü kapatınca,
menüyü yeni açan müşteri onu "Tükendi" görüyor.

**Mimari:** Cloudflare Worker + KV. Menü sayfa açılışında stok bilgisini
çekiyor; sekme öne gelince tazeliyor.

| | |
|---|---|
| Worker | `cavuszade-stok.cavuszade-stok.workers.dev` |
| KV alanı | `b2ab4262fb6943f194bae02c91b830e9`, anahtar `shop:cavuszade:stock` |
| Gizli değerler | `SIFRE_TUZU`, `SIFRE_OZETI`, `JETON_ANAHTARI` (Cloudflare'da) |
| Testler | stok tarafı 51; depo geneli 120, `cd worker && npm test` |

### Bilmen gereken üç tasarım kararı

**Menü fail-open çalışır.** Stok servisine ulaşılamazsa her ürün "var"
görünür ve menü normal açılır. Yanlış "tükendi" göstermek, yanlış "var"
göstermekten pahalı: müşteri sipariş vermez, patron da fark etmez.

**Günlük sıfırlama zamanlayıcısız.** Kayıttaki Brüksel takvim günü bugünden
eskiyse liste boş kabul edilir. Cloudflare cron'u UTC çalıştığı için sabit
saatli kurulum yaz saatinde bir saat kayardı. 2026-08-29 gecesi canlıda
kendiliğinden çalıştığı doğrulandı.

**Yazma yolunda önce sıfırlama, sonra değişiklik.** Ters sırada dünün
tükenmiş ürünleri bugüne taşınır ve bu ekranda hemen görünmez. Test var.

### Ürün listesi ÜÇ yerde

`menu/index.html` (`PRODUCTS`), `admin/index.html` (`URUNLER`) ve
`worker/src/sales.js` (`DILIM_PER_KG` + `ADET_URUNLERI`) kimlikleri
**birebir eşleşmeli**. Ürün eklenirse üçü de güncellenmeli. Bilinçli ödün;
fiyat düzenleme panele alınınca azalır.

### Şifre

`worker/scripts/sifre-kur.mjs` çalıştırılıp `wrangler secret bulk` ile
yüklenir. Şifre hiçbir yere kaydedilmez — unutulursa yenisi konur.

---

## Sipariş defteri (2026-08-30'da yazıldı, HENÜZ DAĞITILMADI)

Hepsi tek adreste: **cavuszadebruxelles.com/admin/** — tek şifre, üç sekme
(**Sipariş · Stok · Rapor**). Tezgâhtar siparişi Sipariş sekmesinden
işaretliyor; ay sonunda patron Rapor sekmesinde hangi üründen ne kadar
çıktığını grafikle görüyor. Rapor verisi ancak o sekmeye ilk basıldığında
çekiliyor — tezgâhtarın gün boyu kullandığı ekran her açılışta aylık tarama
tetiklemesin diye.

**Bu bir kasa değildir.** Fiş kesmez, tutar hesaplamaz, fiyat bilmez, resmî
satış kaydının yerine geçmez. Yalnızca "tezgâhtan ne kadar ürün çıktı"
sayısını tutar — kâğıt defterin dijital hali. Sınırın gerekçesi
`docs/2026-08-30-siparis-defteri-design.md` içinde; muhasebeciye teyit
ettirilmeli.

| | |
|---|---|
| Uç noktalar | `POST /api/sales` (yazma), `GET /api/sales` (rapor) — **ikisi de jetonlu** |
| KV anahtarı | `sale:YYYY-MM-DD:<zaman>-<rastgele>`, aynı KV alanında |
| Yeni gizli değer | **yok** — mevcut `JETON_ANAHTARI` kullanılıyor |
| Testler | toplam 120, `cd worker && npm test` |

### Bilmen gereken üç tasarım kararı

**Temel birim dilim, ama kilo da girilebilir.** Müşteri "5 dilim şundan"
diyor, tezgâhtar öyle yazıyor. "Bir kilo fıstıklı" diyen için `kg` kutusu
var — 25 kez tuşa basmasın. İkisi aynı üründe birlikte de girilebilir.

**Girişler HAM haliyle saklanır, çevrilmiş değil.** "1 kg" olarak girilen
şey "1 kg" olarak yazılır; dilime çevirme rapor anında yapılır. Böylece
`DILIM_PER_KG` katsayısı sonradan düzeltilirse **geçmiş aylar da
kendiliğinden düzelir.**

**Her sipariş kendi anahtarına yazılır.** Oku-değiştir-yaz döngüsü yok, iki
tezgâhtar aynı anda kaydetse bile sipariş kaybolmaz. Satırlar ayrıca
anahtarın metadata'sına konur; aylık rapor böylece sipariş başına ayrı bir
`get()` çağırmaz — Workers'ın alt istek sınırı yüzünden bu zorunluydu.

### Dağıtım için kalan

```bash
cd worker && npm test && npx wrangler deploy
```

Yeni gizli değer veya yeni KV alanı gerekmiyor.

---

## Açık işler

### ⚪ Masaya koyma

QR basılıp masalara yerleştirilecek. Basımdan sonra birkaç farklı telefonla
(iOS + Android) gerçek masa ışığında taranıp test edilmesi iyi olur.

### ⚪ İki ürünün "1 kiloya kaç dilim" karşılığı eksik

`worker/src/sales.js` içindeki `DILIM_PER_KG` tablosunda **Fıstık Sarma** ve
**Havuç Dilim** `null`. O ürünlere kilo girişi çalışıyor ve kaybolmuyor ama
dilim toplamına katılmıyor, raporda ayrıca "çevrilemedi" diye görünüyor.
İki sayı girilince geçmiş aylar da kendiliğinden düzelir — kayıtlar ham
haliyle saklandığı için elle onarım gerekmiyor.

### ⚪ Eş zamanlı yazmada kayıp güncelleme riski — yalnızca STOKTA

KV'de atomik güncelleme yok. Tek kişi kullanırken sorun değil; **ikinci bir
personel aynı anda stok değiştirmeye başlarsa** Durable Objects'e geçmek
gerekir. **Sipariş defterinde bu risk yok** — her sipariş kendi anahtarına
yazılıyor, oku-değiştir-yaz döngüsü kurulmuyor.

## Kapatılan işler

### ❌ Satış/KDV modülü — İPTAL (2026-08-30)

Bir ara "sertifikalı kasadan veri çekip üstüne satış/KDV analitiği koymak"
sonraki büyük adım olarak duruyordu. **Bu madde kapatıldı, tekrar açılmasın.**

Belçika'da GKS / *witte kassa* kapsamındaki işletmede müşteriye verilen fiş
sertifikalı kasadan çıkmak zorunda. O zincire giren yazılım yazmak işletmeye
ceza yazdırabilir. Yerine **sipariş defteri** yapıldı: miktar sayar, para
görmez, fiş kesmez (aşağıya bakın). Gerekçenin tamamı
`docs/2026-08-30-siparis-defteri-design.md` içinde.

## Yeni bir oturuma başlarken

```bash
git log --oneline -15
cd worker && npm test
```

Animasyona dokunacaksan `docs/halka-animasyonu-notlari.md`, stoğa
dokunacaksan `docs/2026-08-28-stok-yonetimi-design.md`, sipariş/satış/rapor
tarafına dokunacaksan `docs/2026-08-30-siparis-defteri-design.md` oku.
Hepsinde "denendi, olmadı" ya da "bilinçli olarak yapılmadı" bölümleri var —
aynı çıkmaz sokaklara tekrar girmemek için.
