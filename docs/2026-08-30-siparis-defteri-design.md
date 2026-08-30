# Sipariş defteri — tasarım ve gerekçeler

**Tarih:** 2026-08-30
**Durum:** yazıldı, test edildi; henüz dağıtılmadı (`wrangler deploy` gerekiyor)

Bu belge iki şeyi kaydeder: **kasa/satış modülünün neden iptal edildiğini**
ve yerine konan sipariş defterinin neden bu biçimde yazıldığını.

---

## 1. Kasa modülü iptal edildi

Önceki planda "sonraki büyük adım" olarak **sertifikalı kasadan veri çekip
üstüne satış/KDV analitiği koymak** duruyordu. Bu madde **kapatıldı.**

Belçika'da GKS (*geregistreerd kassasysteem* / *witte kassa*) kapsamındaki
bir işletmede müşteriye verilen fişin **sertifikalı kasadan, fiscal data
module ile** çıkması zorunludur. Bu zincire giren bir yazılım yazmak —
sertifikasız fiş kesmek, tutarı resmî satış kaydı gibi tutmak — işletmeye
ceza yazdırabilir.

**Yasak olan "satışı saymak" değil, sertifikasız kasa olmaktır.** Ayrım şu:

| | Sertifikalı kasanın işi | Bu modülün işi |
|---|---|---|
| Müşteriye fiş verir | evet, zorunlu | **hayır, hiç** |
| Tutar/KDV hesaplar | evet | **hayır** |
| Resmî satış kaydıdır | evet | **hayır** |
| Ne kadar ürün çıktığını sayar | evet | evet |

Bu modül yalnızca son satırı yapar: **kâğıt defterin dijital hali.** Fiş
kesmez, tutar hesaplamaz, fiyat bilmez, resmî kaydın yerine geçmez. Kodda
bu sınır `worker/src/sales.js` başındaki yorumda da yazılıdır.

> **Muhasebeciye teyit ettirilmeli.** Buradaki ayrım hukuk görüşü değil,
> tasarımın hangi tarafta durduğunun beyanıdır. Modül bilinçli olarak
> güvenli tarafa — para hiç görmeyecek şekilde — kuruldu.

**Para raporda hiç görünmüyor.** Miktar sayılıyor, tutar sayılmıyor. Bu
hem yukarıdaki sınırı net tutuyor hem de asıl işe yarıyor: "bu ay 1.465
dilim fıstıklı çıktı" üretim ve malzeme siparişi planlamak için doğrudan
kullanılabilir bir sayı.

---

## 2. Temel birim: dilim

Müşteri tezgâhta **"şundan 5 dilim, ondan 2 dilim"** diyor. Tezgâhtar da
öyle yazmalı; kiloya çevirmeye çalışmak hem yavaş hem hataya açık.

Ama bazı müşteri **"bir kilo fıstıklı"** diyor. Bir kiloda 25 dilim varken
tezgâhtarın 25 kez `+` tuşuna basması saçma olurdu.

**Karar: ikisi de girilebilir.** `+` bir dilim ekler, `kg` kutusu kiloyla
yazdırır. Aynı ürüne ikisi birlikte de girilebilir ("bir kilo, üstüne 5
dilim daha"), bunlar ayrı satır olarak kaydedilip raporda toplanır.

### Dönüşüm tablosu ve eksik iki satır

`worker/src/sales.js` içindeki `DILIM_PER_KG`, kilo girişini dilime çevirir.
Sayılar `docs/2026-08-04-qr-menu-design.md`'deki "adet/kg" tablosundan geldi:

| Ürün | dilim/kg |
|---|---|
| Fıstıklı Baklava | 25 |
| Cevizli Baklava | 30 |
| Şöbiyet | 20 |
| Fıstıklı Bohça | 35 |
| Soğuk Baklava | 25 |
| Fıstıklı Kadayıf | 8 |
| **Fıstık Sarma** | **? — teyit bekliyor** |
| **Havuç Dilim** | **? — teyit bekliyor** |

Eksik iki üründe kilo girişi **engellenmiyor** — tezgâhtar beklemesin diye.
Girilen kilo ham haliyle saklanıyor ve raporda "dilime çevrilemedi" olarak
ayrıca gösteriliyor, yani sayı kaybolmuyor.

### Neden ham giriş saklanıyor, çevrilmiş değil

Kayıtta `{ id, birim, miktar }` duruyor — yani "1 kg" olarak girilen şey
"1 kg" olarak yazılıyor, "25 dilim" olarak değil. Çevirme **rapor anında**
yapılıyor.

Bunun bedeli her raporda birkaç çarpma; getirisi şu: **katsayı sonradan
düzeltilirse geçmiş aylar da kendiliğinden düzelir.** Eksik iki katsayı
girildiğinde ya da yanlış bir katsayı düzeltildiğinde eski veriyi elle
onarmak gerekmiyor. Katsayı zaten bir tahmin olduğu için bu geriye dönük
düzelme istenen davranış.

---

## 3. Her sipariş kendi anahtarına yazılıyor

KV anahtarı: `sale:YYYY-MM-DD:<zaman>-<rastgele>`

Stok tarafında bilinen bir açık iş var: KV'de atomik güncelleme yok, iki
kişi aynı anda yazarsa biri kaybolabilir. Sipariş defteri stoktan çok daha
yazma yoğun — o riski taşımaması gerekiyordu.

**Çözüm: oku-değiştir-yaz döngüsünü hiç kurmamak.** Her sipariş ayrı bir
anahtara gidiyor, hiçbir yazma başka bir kaydı okumuyor. İki tezgâhtar aynı
anda kaydetse bile ikisi de duruyor. Testi var (`es zamanli iki siparis
birbirini ezmez`).

Rapor, ay önekini (`sale:2026-08`) tarayarak topluyor; ayrıca dizin tutmak
gerekmiyor.

### Satırlar metadata'da duruyor — bu bir hız süsü değil

Sipariş satırları KV anahtarının **metadata**'sına da yazılıyor, çünkü
`list()` metadata'yı anahtarlarla birlikte döndürüyor. Böylece aylık rapor
sipariş başına ayrıca `get()` çağırmıyor.

Bu zorunluydu: Workers'ta **istek başına alt istek sayısı sınırlı**. Sipariş
başına bir `get()`, ayda birkaç yüz siparişten sonra raporu tamamen çalışmaz
hale getirirdi. Metadata sınırı 1024 bayt; en büyük sipariş bile bunun
altında kalıyor ve bunun testi var — `MAX_SATIR` büyütülürse ya da ürün
kimlikleri uzarsa test sessizce değil orada patlar.

`list()` bir çağrıda en fazla 1000 anahtar döndürür; imleç döngüsü var ve
1400 kayıtla test edildi. **Bu döngü kırılırsa rapor sessizce eksik çıkar**
— hataların en tehlikeli biçimi olduğu için ayrı testi var.

---

## 4. Rapor okuma jetonlu

Stok `GET`'i herkese açık (menü onu kullanıyor). **Sipariş uç noktalarının
ikisi de jeton istiyor** — ne kadar sattığın menüde yazmaz, işletmenin iç
verisidir. Ayrıca tarayıcı tarafında kaynak denetiminden de geçiyorlar.

---

## 5. Grafik kararları

**Tek seri rengi (`#A97A1F`).** Bütün çubuklar aynı ölçüyü (dilim)
gösteriyor. Ürün başına ayrı renk vermek, çubuğun uzunluğunun zaten
söylediği şeyi ikinci kez renkle kodlamak olurdu. Renk açık zeminde
parlaklık, kroma ve kontrast denetimlerinden geçirildi; değiştirilecekse
yeniden ölçülmeli.

**Baklava ve içecek ayrı çubuk grupları, ayrı ölçekler.** İlk sürümde tek
listede sıralanıyorlardı ve "480 adet su" çubuğu "395 dilim soğuk
baklava"dan uzun çıkıyordu — hiçbir şey ifade etmeyen bir kıyas. Adet ile
dilim aynı uzunluk ölçeğini paylaşamaz.

**Eğilim için on çizgi yerine on küçük grafik.** Üst üste binen on çizgi
okunmuyor. Her panelin kendi ölçeği var, çünkü sorulan soru "bu ürün
yükseliyor mu düşüyor mu" — paneller arası büyüklük kıyasını üstteki çubuk
grafik zaten veriyor. Panel başına ölçek, az satan ürünün eğilimini de
görünür kılıyor.

**Kayıt tutulmaya başlamadan önceki aylar kırpılıyor.** Aksi halde defter
tutulmayan ay grafikte sıfır olarak çizilir ve "o ay hiç satmadık" diye
okunurdu. Veri yokluğu ile sıfır satış aynı şey değil.

**Her değer tabloda da yazıyor.** İpucu (tooltip) yalnızca ek bilgi;
dokunmatik cihazda açılmasa bile hiçbir sayı erişilemez kalmıyor.

---

## Denendi / bilinçli olarak yapılmadı

- **Tutar ve KDV hesabı** — 1. bölümdeki gerekçe. Sipariş defteri para
  görmüyor; fiyat bilgisi bu modüle hiç girmedi.
- **Fiş / ticket çıktısı** — aynı gerekçe. Hiçbir yazdırma yolu yok.
- **Sipariş silme/düzeltme** — yazılmadı. Yanlış giren tezgâhtar şu an
  düzeltemiyor. Kayıtlar ayrı anahtarlarda durduğu için sonradan eklemek
  kolay; ihtiyaç görülürse yapılır.
- **Günlük kırılım grafiği** — worker `gunler` alanını zaten döndürüyor ama
  ekranda çizilmiyor. Ay sonu sorusu "hangi üründen ne kadar", "hangi gün"
  değil. Veri hazır, istenirse eklenir.

## Sınırlar

- **KV anlık tutarlı değil.** Yeni kaydedilen sipariş raporda birkaç saniye
  gecikebilir. Giriş ekranı bu yüzden kaydettiklerini kendi içinde ayrıca
  listeliyor — tezgâhtar "kaydoldu mu?" diye tereddüt etmesin.
- **Ürün listesi artık üç yerde:** `menu/index.html` (`PRODUCTS`),
  `admin/index.html` (`URUNLER`), `worker/src/sales.js` (`DILIM_PER_KG` +
  `ADET_URUNLERI`). Ürün eklenirse üçü de güncellenmeli.
- **Ücret:** sipariş başına bir KV yazma. Ücretsiz katman günde 1000 yazma
  veriyor; günde birkaç yüz sipariş beklendiği için sığıyor. Aşılırsa
  Workers Paid ayda 5 $.
