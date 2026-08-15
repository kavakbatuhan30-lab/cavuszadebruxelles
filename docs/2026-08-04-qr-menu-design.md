# Çavuşzade Baklava — Masa QR Menüsü (Tasarım)

Tarih: 2026-08-04
Durum: Uygulandı. **2026-08-09'da önemli kararlar değişti — aşağıdaki
"2026-08-09 revizyonu" bölümünü okumadan bu dokümana güvenme.**

---

## 2026-08-09 revizyonu

Bu tarihte kullanıcı dört karar değiştirdi. Aşağıdaki orijinal bölümler artık
kısmen geçersiz; hangilerinin geçersiz olduğu burada yazıyor.

### 1. Dil hafızası kaldırıldı

Eskiden seçilen dil `localStorage`'a yazılıyor, aynı cihaz ikinci kez
okuttuğunda perde atlanıyordu. **Artık perde her açılışta gösteriliyor,
dil hiç hatırlanmıyor.** Gerekçe: masadaki telefonu birden fazla müşteri
okutuyor; önceki müşterinin dili yenisini karşılamamalı. `?splash` parametresi
ve `cz_lang` anahtarı tamamen kaldırıldı. → "Dil sistemi" bölümü geçersiz.

### 2. Sekmeler kaldırıldı — tek sayfa

Eskiden "Baklava | İçecek" sekmeleri vardı. **Artık tek sayfa:** baklavalar
üstte, içecekler onların altında, her biri kendi bölüm başlığıyla
(elmas süslü, Cormorant Garamond, versal). → "Düzen — B: Sekmeli ızgara"
bölümündeki sekme kararı geçersiz; kart ızgarası aynı kaldı.

### 3. Adet/dilim fiyatı kaldırıldı — sadece kilogram

**`− 1 +` adet seçici tamamen kaldırıldı.** Kartlarda yalnızca kilogram
fiyatı görünüyor. `PRODUCTS` içindeki `pcs` ve `piece` alanları silindi.
→ "Adet fiyatları ve adet seçici" bölümünün tamamı geçersiz.

### 4. İçecek listesi ikiye indi — fiyatlar artık uydurma değil

Sekiz uydurma içecek kalemi silindi. Kullanıcının verdiği iki kalem kaldı:

| Ürün | Fiyat |
|---|---|
| Su | 1,00 € |
| Meyveli Soda | 2,00 € |

Kullanıcı bunları "şimdilik" diye verdi — kesinleşmiş sayılmaz, ama artık
uydurma da değil. → "İçecekler — GEÇİCİ FİYAT" bölümü geçersiz.

### 5. Görsel dil yenilendi (kullanıcı isteği: "daha lüks olsun")

Açılış perdesi baştan tasarlandı:

- **Zemin koyu kahveden açık kağıda döndü:** `#F3EDE0` (kullanıcı verdi).
  Aynı ton `--paper` olarak sayfanın tamamına uygulandı.
- **Marka bloğu yukarı alındı:** logo + ÇAVUŞZADE + "Gaziantep · Brüksel"
  artık ekranın en üstünde, ana sitedeki koyu kahve panelin aynısı olan bir
  arma bandının içinde (`--brown` + ana sitedeki altın elmas motifi).
- **Dil düğmeleri en alta indirildi** — dönen halkanın önüne geçmesinler diye.
- **Dönen halka madalyona alındı:** açık zeminde `mix-blend-mode:screen`
  çalışmıyor (her şeyi beyaza yıkıyor). Video artık kağıda oyulmuş, çift altın
  halkalı koyu bir dairenin içinde dönüyor. Denenip **vazgeçilen** yol:
  videoyu `invert+sepia` filtre zinciriyle açık zemine uydurmak — görsel olarak
  çalışıyordu ama tam ekran videoda beş aşamalı filtre sayfayı kilitledi.
- **Cinzel fontu tamamen çıkarıldı**, yerine ana sitedeki gibi Cormorant
  Garamond. Bir font indirmesi eksildi.

→ "Görsel dil" bölümündeki palet geçerli, font listesi geçersiz.

### Değişmeyenler

Ürün adları dört dilde de Türkçe. Sepet/sipariş/ödeme hâlâ yok. Baklava
kilogram fiyatları hâlâ **26 Mart tarihli dosyadan geliyor ve teyit edilmedi.**
`noindex` etiketi hâlâ yerinde.

---

## Amaç

Masaya konacak QR kodun açacağı, telefonda hızlı açılan, dört dilli (TR/FR/NL/EN)
tek sayfalık menü. Müşteri bakar, garsona söyler — sipariş/ödeme akışı yok.

## Kaynak ve bağlam

- **Repo:** `C:\Users\kavak\Desktop\cavuszade` →
  `github.com/kavakbatuhan30-lab/cavuszadebruxelles`
- **GitHub Pages:** `main` branch, kök dizin (`/`), CNAME `cavuszadebruxelles.com`,
  HTTPS aktif. Ayarlar doğru, değişiklik gerekmiyor.
- **Fiyat kaynağı:** `C:\Users\kavak\Desktop\cavuszadebruxelles.html` (26 Mart tarihli,
  tek dilli tanıtım sayfası). Sadece fiyatlar ve renk paleti alındı; sayfanın kendisi
  kullanılmadı.
- **Not:** `menu.html` diye bir dosya hiç var olmadı — ne repoda, ne git geçmişinde,
  ne diskte. Sıfırdan yapılıyor.

## Yayın hedefi

`menu/index.html` olarak repoya eklenir → `cavuszadebruxelles.com/menu`

Uzantısız `/menu` adresinin GitHub Pages'te çalışacağı garanti değildir; `menu/`
klasörü + içinde `index.html` her statik sunucuda çalışır. QR kodu bir kez basılıp
bir daha değiştirilmeyeceği için garantili yol seçildi.

Mevcut `index.html` ve `imgcavuszade/` **değiştirilmez**. Menü tamamen additif.

## Görsel dil

Palet (`cavuszadebruxelles.html` içinden alındı):

| Değişken | Renk |
|---|---|
| gold | `#C9A84C` |
| gold-light | `#E8D08A` |
| gold-dark | `#8B6520` |
| brown | `#3B1E08` |
| brown-mid | `#6B3A1F` |
| cream | `#FAF5EC` |
| cream-dark | `#F0E8D5` |
| charcoal | `#1A0E05` |

Fontlar: **Cinzel** (marka/başlık), **Cormorant Garamond** (ürün adı),
**Lato** (gövde).

## Düzen — "B: Sekmeli ızgara"

Üç seçenek maketlendi (kompakt liste / sekmeli ızgara / büyük görsel akış);
kullanıcı B'yi seçti.

1. Marka barı (koyu kahve zemin, altın yazı)
2. Yapışkan sekme: **Baklava | İçecek**
3. Kategori başında birim uyarısı
4. İkili kart ızgarası: fotoğraf, ad, kısa tanım, fiyat
5. Karta dokunuş → büyük fotoğraf
6. Altta iletişim (adres/telefon/saatler — mevcut `index.html`'den alınacak)

**B'nin seçilme gerekçesi:** baklava kilogram, içecek adet fiyatlı. İki birimi ayrı
sekmede tutmak, müşterinin "36 €" fiyatını bir dilim baklava sanma riskini ortadan
kaldırıyor.

## Dil sistemi

- Açılışta tam ekran dil seçimi: 🇹🇷 🇫🇷 🇳🇱 🇬🇧 + logo
- Seçim `localStorage`'a yazılır; aynı cihaz tekrar okuttuğunda doğrudan menüye girer
- Üst barda kalıcı dil değiştirme düğmesi
- **Ürün adları dört dilde de Türkçe sabit** (kullanıcı kararı): "Şöbiyet",
  "Havuç Dilim" vb.
- Çevrilenler: kategori başlıkları, birim metinleri, arayüz metinleri ve
  **ürün altı tek satırlık tanım**

## Veri modeli

Dosyanın en üstünde tek bir `PRODUCTS` dizisi. HTML'e gömülü fiyat olmayacak;
kartlar bu listeden üretilir. Fiyat güncellemek = tek sayı değiştirmek.

```js
const PRODUCTS = [
  { id:'fistik', img:'img/fistik.webp', price:36, unit:'kg', cat:'baklava',
    name:'Fıstıklı Baklava',
    desc:{ tr:'...', fr:'...', nl:'...', en:'...' } },
];
```

### Baklavalar — kg fiyatı (eski siteden, TEYİT EDİLMEDİ)

| Ürün | Fiyat | Görsel |
|---|---|---|
| Fıstıklı Baklava | 36 €/kg | fistik |
| Fıstık Sarma | 48 €/kg | sarma |
| Havuç Dilim | 36 €/kg | havucdilim |
| Fıstıklı Bohça | 38 €/kg | bohca |
| Şöbiyet | 38 €/kg | sobiyet |
| Soğuk Baklava | 36 €/kg | sogukbaklava |
| Fıstıklı Kadayıf | 36 €/kg | kadayif |
| Cevizli Baklava | 30 €/kg | ceviz |

### Adet fiyatları ve adet seçici (2026-08-05 eklendi)

Kullanıcı 1 kg kutuya sığan adetleri verdi ve hesaplamayı istedi. Adet fiyatı
`kg fiyatı / adet` **tam bölmesidir, yuvarlanmamıştır** — kâr marjı eklemek
kullanıcının kararı.

| Ürün | kg | adet/kg | adet fiyatı |
|---|---|---|---|
| Fıstıklı Baklava | 36 € | 25 | 1,44 € |
| Cevizli Baklava | 30 € | 30 | 1,00 € |
| Şöbiyet | 38 € | 20 | 1,90 € |
| Fıstıklı Bohça *(gelin bohçası)* | 38 € | 35 | 1,09 € |
| Soğuk Baklava | 36 € | 25 | 1,44 € |
| Fıstıklı Kadayıf | 36 € | 8 | 4,50 € |

**Adet sayısı verilmeyen iki ürün:** Fıstık Sarma (48 €/kg) ve Havuç Dilim
(36 €/kg). Bunlarda adet seçici gösterilmez, sadece kilogram fiyatı çıkar.
Sayılar gelince `pcs` ve `piece` alanları eklenerek seçici otomatik belirir.

**Davranış:** `pcs` + `piece` alanı olan kartta `− 1 +` seçici çıkar; müşteri
adedi değiştirdikçe fiyat anında güncellenir. Seçilen adetler dil değişiminde
korunur. Alt sınır 1, üst sınır 50. Adet düğmeleri karta yayılmaz (yayılsaydı
büyük fotoğraf açılırdı). Görünen düğme 32 px, dokunma alanı 44 px.

Hâlâ sepet/sipariş yok — bu sadece müşterinin fiyat görmesini sağlayan bir
hesaplayıcı.

### İçecekler — GEÇİCİ FİYAT, TAMAMI UYDURMA

Kullanıcı "şimdilik sen bir şeyler yap, sonra düzenleriz" dedi. Bu değerlerin
gerçekle ilgisi yoktur ve yayına çıkmadan önce mutlaka değiştirilmelidir.

| Ürün | Geçici fiyat |
|---|---|
| Türk Çayı | 2,50 € |
| Türk Kahvesi | 4,00 € |
| Espresso | 2,50 € |
| Café Latte | 3,50 € |
| Su (50 cl) | 2,00 € |
| Ayran | 2,50 € |
| Meşrubat | 3,00 € |
| Taze Portakal Suyu | 4,50 € |

İçeceklerin fotoğrafı yok → içecek kartları fotoğrafsız, sade tipografik satır
olarak render edilir.

## Görsel optimizasyonu

Repodaki kaynak fotoğraflar **tanesi ~1,6-1,7 MB** (sekizi toplam 13,6 MB). Masada
mobil veriyle kabul edilemez. Ölçüldü: 340 piksele küçültülünce 1,7 MB → 11 KB
(%99,4 azalma), gözle görülür kalite kaybı yok.

- Hedef: ~600 piksel genişlik, WebP, tahmini 25-40 KB/adet
- Çıktı: `menu/img/` (yeni klasör)
- Kaynaklar `imgcavuszade/` içinde **değiştirilmeden** kalır
- Base64 gömme **kullanılmaz**: ayrı dosyalar tarayıcıda önbelleğe alınır, HTML
  ~30 KB kalır

## Kapsam dışı

Sepet, sipariş, ödeme, arama, animasyonlu geçişler, porsiyon/dilim fiyatı
(sonraki aşama), çoklu şube.

## Açık riskler

1. **Baklava fiyatları teyit edilmedi.** 26 Mart tarihli dosyadan geliyor.
   QR basılmadan önce doğrulanmalı.
2. **İçecek fiyatları tamamen uydurma.** Yayına çıkmadan değiştirilmeli.
3. **İçecek listesi varsayım.** Gerçekte hangi içecekler satılıyor bilinmiyor.

## Yayın kararı

Menü kurulur, kullanıcı yerelde inceler. **Fiyatlar netleşene kadar push
edilmez** — push edilirse `/menu` herkese açık olur ve arama motorları
indeksleyebilir; uydurma fiyatlarla bu risk alınmaz.

## Doküman yeri hakkında

Bu doküman varsayılan konum olan repo içine değil, repo **dışına** yazıldı.
Sebep: `cavuszade` reposundaki her dosya GitHub Pages üzerinden herkese açık
yayınlanıyor; iç notlar ve uydurma fiyatlar içeren bir spec'in internete
açılması istenmedi.
