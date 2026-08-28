# Stok yönetimi — tasarım

Tarih: 2026-08-28
Durum: onaylandı, uygulanmadı

## Amaç

Dükkân sahibi bir ürün bittiğinde menüde anında "tükendi" gösterebilsin.
Şu an menü GitHub Pages'te statik tek bir HTML dosyası; arka uç yok.

## Verilen kararlar

Bu kararlar tasarım görüşmesinde alındı; gerekçeleriyle birlikte
kayda geçiriliyor ki ileride tekrar tartışılmasın.

| Karar | Seçim | Gerekçe |
|---|---|---|
| Kapsam | Önce yalnızca Çavuşzade | Henüz bağımsız ödeyen müşteri yok. Veri düzeni çok dükkânlıya hazır kurulur ama arayüz tek dükkân. |
| Tazelik | Sayfa açılışında güncel | Müşteri menüyü 1–3 dakika açık tutuyor. Kritik olan, işaretlemeden **sonra** açan müşterinin doğru listeyi görmesi. Açık duran sayfayı canlı güncellemek pahalı ve faydası sınırlı. |
| Stok modeli | var / tükendi (iki durum) | Üç durumlu modellerde orta durum pratikte kullanılmayı bırakır ve güvenilmez hale gelir. |
| Sıfırlama | Her gün otomatik | Unutulan bir "tükendi" günlerce satış kaybettirir ve patron fark etmez. Baklava her gün taze yapılıyor, sabah hepsi var doğru varsayım. |
| Panel kapsamı | Yalnızca stok | Fiyat/ürün düzenleme sonraki adım. Şu an sorunsuz çalışan canlı menünün içeriği ağa bağımlı hale getirilmiyor. |
| Giriş | Tek ortak şifre, kalıcı oturum | Tezgâhta kimse her seferinde şifre yazmaz. Tek dükkân için kişi başı hesap fazla yük. |
| Altyapı | Cloudflare Worker + KV | Saklanan şey on adet doğru/yanlış; veritabanı orantısız. Ücretsiz katman bu ölçeğin çok üstünde. |

### Elenen seçenekler

**Supabase.** Hazır kimlik doğrulama ve gerçek zamanlı güncelleme getiriyordu
— gerçek avantaj. Ama on boolean için Postgres orantısız, sabah sıfırlaması
için `pg_cron` kurmak gerekiyor ve ücretsiz projeler hareketsizlikte uykuya
geçiyor. Satış verisi panele girdiğinde bu seçenek yeniden değerlendirilmeli.

**GitHub'a yazıp Pages'i yeniden derletmek.** Yeni servis gerektirmiyordu ama
iki sebeple elendi: 1–2 dakika gecikme, ve repoya yazma yetkisi olan bir
anahtarın tarayıcıda durma zorunluluğu. O anahtar sızarsa saldırgan sitenin
tamamını değiştirebilir — bir stok düğmesi için alınacak risk değil.

## Mimari

```
Müşteri telefonu                Patronun telefonu
   menu/index.html                 admin/index.html
        │                                │
        │ GET /api/stock                 │ POST /api/login
        │ (herkese açık)                 │ POST /api/stock
        │                                │ (jeton gerekir)
        └────────────┬───────────────────┘
                     ▼
            Cloudflare Worker
                     │
                     ▼
              KV: shop:cavuszade:stock
```

Menü ve panel GitHub Pages'te statik kalır. Worker ayrı bir servistir.

## Veri modeli

KV anahtarı: `shop:cavuszade:stock`

```json
{
  "date": "2026-08-28",
  "out": ["sarma", "ceviz"],
  "updatedAt": "2026-08-28T17:22:04Z"
}
```

- `date` — Brüksel saatiyle kaydın ait olduğu takvim günü (`YYYY-MM-DD`)
- `out` — tükenen ürünlerin kimlikleri; boş dizi "hepsi var" demek
- `updatedAt` — son değişiklik, panelde göstermek için

Anahtardaki `shop:cavuszade:` öneki ileriye dönük: ikinci dükkân yeni bir
anahtar olur, kod değişmez.

## Günlük sıfırlama — zamanlayıcısız

Cloudflare'in zamanlayıcısı UTC çalışır. Brüksel yazın UTC+2, kışın UTC+1;
sabit saatli bir zamanlayıcı **yılda iki kez bir saat kayar.**

Onun yerine sıfırlama okuma anında yapılır:

> Kayıttaki `date`, Brüksel'deki bugünün tarihinden eskiyse `out` boş
> kabul edilir.

Bugünün Brüksel tarihi `Intl.DateTimeFormat` ile `timeZone: 'Europe/Brussels'`
kullanılarak bulunur; yaz saati kendiliğinden doğru olur.

Avantajları: zamanlayıcı yok, bozulacak parça yok, gece hiç trafik olmasa
bile doğru çalışır.

Sıfırlama gece yarısı olur, açılış saatinde değil. Dükkân 12:00–21:00 açık
olduğundan pratikte fark yoktur ve bu kurgu daha az parça içerir.

## API sözleşmesi

Taban adres: Worker'ın adresi (dağıtımda belirlenecek).

### `GET /api/stock`

Herkese açık. Menü bunu çağırır.

```
200 { "date": "2026-08-28", "out": ["sarma"], "updatedAt": "..." }
```

`Cache-Control: no-store` — ara katmanlar bayat stok göstermesin.

Kayıt yoksa veya tarihi eskiyse `out` boş dizi döner.

### `POST /api/login`

```
istek : { "password": "..." }
200   : { "token": "<imzalı jeton>", "expiresAt": "..." }
401   : { "error": "invalid_password" }
429   : { "error": "too_many_attempts" }
```

### `POST /api/stock`

```
başlık: Authorization: Bearer <jeton>
istek : { "id": "sarma", "inStock": false }
200   : güncel kayıt (GET ile aynı biçim)
400   : { "error": "invalid_id" }
401   : { "error": "invalid_token" }
```

Ürün kimliği `^[a-z0-9-]{1,32}$` kalıbına uymalı ve `out` listesi en fazla
100 öğe olabilir. **Ürün listesi Worker'da tutulmaz** — menü, tanımadığı
kimlikleri zaten yok sayar. Böylece ürün listesi iki yerde tekrarlanmaz ve
ürün eklendiğinde Worker'a dokunmak gerekmez.

**Yazma sırası — bu önemli.** Yazma isteği geldiğinde Worker sırayla:

1. Kayıtlı veriyi okur
2. **Önce tarih sıfırlamasını uygular** — kayıt dünden kalmışsa `out` boş
   kabul edilir
3. Sonra istenen değişikliği uygular
4. `date` alanına bugünün Brüksel tarihini yazarak kaydeder

İkinci adım atlanırsa dünkü tükenmiş ürünler bugüne taşınır: patron sabah
tek bir ürünü kapattığında, dün akşamdan kalan liste de geri gelir. Sıfırlama
okuma yolunda uygulandığı için bu hata ekranda hemen görünmez, sinsi olur.

## Güvenlik

**Şifre.** Worker'da düz metin tutulmaz. PBKDF2-SHA256 özeti ve tuzu ayrı
birer Worker gizli değeri (secret) olarak saklanır. Karşılaştırma sabit
zamanlı yapılır.

**Oturum jetonu.** İçinde son kullanma tarihi olan, HMAC-SHA256 ile
imzalanmış bir dize. Sunucuda oturum saklanmaz. Süre 90 gün.

**Kaynak kısıtı — yalnızca yazmada.** `POST` isteklerinde `Origin` başlığı
izinli listede olmalı. Liste `IZINLI_KAYNAK` değişkeninde virgülle ayrılır;
üretimde tek adres (`https://cavuszadebruxelles.com`), yerel geliştirmede
`localhost` adresleri de eklenir.

`GET /api/stock` **kısıtlanmaz.** Herkese açık, salt okunur, kimlik bilgisi
taşımayan veri; kaynak kısıtı ona hiçbir şey katmaz — isteyen zaten `curl`
ile alır — ama meşru kullanımı (örneğin yerel geliştirme) kırar. Tüm
yanıtlarda `Access-Control-Allow-Origin: *` döner.

Çerez kullanılmadığı, yetki `Authorization` başlığıyla taşındığı için `*`
ile `Authorization` birlikte sorunsuz çalışır.

> Dürüst sınır: CORS yalnızca tarayıcıyı bağlar, tarayıcı dışı istemciyi
> engellemez. Asıl koruma jetondur. Kaynak kısıtı ikinci savunma hattıdır.

**Kaba kuvvet.** `/api/login` IP başına 15 dakikada 10 deneme ile sınırlanır
(sayaç KV'de, kısa ömürlü).

**Bilinen sınır.** Giriş doğrulaması elle yazılıyor, hazır bir kimlik
sisteminden gelmiyor. Bir stok düğmesi için kabul edilebilir. **Satış verisi
bu panele girdiği gün bu bölüm yeniden ele alınmalıdır** — o noktada hazır
bir kimlik sağlayıcı doğru tercih olur.

## Bilinen sınır: eş zamanlı yazmada kayıp güncelleme

Yazma işlemi oku-değiştir-yaz biçiminde ve **KV'de atomik karşılaştır-değiştir
yok.** İki yazma gerçekten aynı anda gelirse ikincisi birincisinin üzerine
yazabilir ve bir değişiklik sessizce kaybolabilir.

Ölçüldü: dört eş zamanlı yazma denendi, kayıp olmadı. Ama bu bir garanti
değil — yalnızca o koşulda gözlenen davranış.

Pratikte tek kişi, saniyeler arayla düğmeye basıyor; çakışma olasılığı düşük.
Sıkı garanti gerekirse Durable Objects'e geçmek gerekir, ki bu tehdit düzeyi
için orantısız. **İkinci bir dükkân veya aynı anda çalışan ikinci bir personel
eklendiğinde bu madde yeniden değerlendirilmeli.**

## Menü tarafı (`menu/index.html`)

Sayfa açılışında stok çekilir. `AbortController` ile **2 saniye zaman aşımı**.

**Ulaşılamazsa her ürün "var" gösterilir.** Gerekçe: yanlış "tükendi"
göstermek, yanlış "var" göstermekten pahalıdır — müşteri sipariş vermez ve
patron bunu fark etmez. Servis çökse bile menü çalışır, yalnızca stok
özelliği sessizce devre dışı kalır.

Sayfa arka plandan öne geldiğinde (`visibilitychange`) stok tekrar çekilir.

Tükenen ürün: fotoğrafı soluk, üzerinde rozet. Kart tıklanabilir kalır —
müşteri ürünü yine de görebilmeli. İçecek satırları da aynı rozeti alır.

Rozet metni `I18N` içine eklenir:

| dil | metin |
|---|---|
| tr | Tükendi |
| fr | Épuisé |
| nl | Uitverkocht |
| en | Sold out |

## Yönetim paneli (`admin/`)

Adres: `cavuszadebruxelles.com/admin/`

Şifre ekranı → jeton `localStorage`'a yazılır → ürün listesi ve her satırda
bir açma/kapama düğmesi.

Düğmeye basınca arayüz hemen tepki verir; istek başarısız olursa eski hâline
döner ve hata gösterilir. Son güncelleme zamanı ekranda görünür.

`noindex, nofollow` meta etiketi ve `robots.txt` içinde `Disallow: /admin/`.

## Repo düzeni

```
worker/              YENİ — Worker kaynağı + wrangler.toml
admin/               YENİ — yönetim paneli (statik)
menu/index.html      DEĞİŞİYOR — stok çekme, rozet, I18N
robots.txt           DEĞİŞİYOR — /admin/ kapatılıyor
```

## Test planı

**Worker (birim testleri):**
- Tarih sıfırlaması: dünkü tarihli kayıt boş `out` döndürmeli
- Brüksel tarihi: yaz ve kış saatinde doğru gün
- Jeton: imzalanan jeton doğrulanmalı; kurcalanan ve süresi geçen reddedilmeli
- Kimlik doğrulama: kalıba uymayan kimlik 400 dönmeli

**Menü (tarayıcıda):**
- Tükenen ürün rozetle ve soluk görünüyor
- **Servis kapalıyken menü normal açılıyor, her şey "var"** (fail-open)
- Sekme öne gelince liste tazeleniyor
- Dört dilde rozet doğru

**Panel:**
- Yanlış şifre reddediliyor, doğru şifre jeton veriyor
- Düğme değişikliği menüye yansıyor
- Jeton silinince tekrar şifre soruluyor

## Kapsam dışı

Bu tasarım şunları **içermez**: fiyat/ad düzenleme, ürün ekleme-silme,
fotoğraf yükleme, çok dükkânlı arayüz, satış kaydı, KDV hesabı, analitik,
3D görüntüleme.

Satış ve KDV kısmının Belçika'da **GKS / witte kassa** mevzuatına girdiği,
sertifikasız bir sistemin yasal risk taşıdığı ayrıca not edilmiştir; o modül
muhasebeci görüşü alınmadan tasarlanmamalıdır.

## Kullanıcının yapacakları

1. **Cloudflare hesabı açmak** (ücretsiz) — hesap oluşturma işi kullanıcıya aittir
2. `wrangler login` ile yetkilendirme
3. Şifreyi belirlemek — `wrangler secret put` ile konur, sohbete yazılmaz

Beklenen ücret: sıfır. Ücretsiz katman günde 100.000 istek; beklenen kullanım
günde birkaç yüz.
