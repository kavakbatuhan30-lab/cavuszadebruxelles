# Çavuşzade Baklava Menüsü — Proje Durumu

**Yazılış tarihi:** 2026-08-15 (okul PC'deki Claude için)
**Amacı:** Okul PC'deki Claude'un projeyi hızla anlaması için durum özeti

## Proje Nedir

Çavuşzade Baklava (Brüksel) için mobil QR menüsü. Masaya geliştirilmiş, bir HTML dosyası, tüm görseller ve animasyon base64/inline gömülü.

**Canlı sayfa:** cavuszadebruxelles.com/menu (şu anki durum: **yayında DEĞİL** — Pages build başarısız)

## Dosya Yapısı

```
cavuszade/
├── menu/
│   ├── index.html                (51.6 KB, menünün kendisi)
│   ├── img/
│   │   ├── ring.mp4               (387 KB, dönüştürülmüş baklava animasyonu)
│   │   ├── ring-poster.webp       (10.6 KB, animasyon başlangıcı poster)
│   │   ├── *.webp                 (8 ürün fotoğrafı, base64 gömülmek üzere)
│   └── ...
├── docs/superpowers/specs/
│   └── halka-animasyonu-notlari.md  (⚠️ OKUMASAL — teknik ölçümler + denenen sürümler)
└── .gitignore
```

## Menü Özellikleri (TAMAMLANMIŞ)

✅ **Açılış ekranı:** Dil seçimi (TR/FR/NL/EN) + dönüştürülmüş baklava madalyonu  
✅ **Ana menü:** 8 baklava (kg fiyat, parça seçimi ile dinamik fiyat) + 8 içecek  
✅ **Tasarım:** Çavuşzade renklerine uygun (altın #C9A84C, krem #FAF5EC, kahve tonları)  
✅ **Dil kalıcılığı:** localStorage — sayfa yenilenince de seçili dil kalır  
✅ **Responsive:** Masaüstü + mobil (375×812 test edildi)  
✅ **Erişilebilirlik:** Azaltılmış hareket + veri tasarrufu desteği  

## Animasyon Durumu (SON DEĞİŞİKLİK: Madalyon → Şeffaf → Madalyon GERİ)

### Şu anki: Koyu Madalyon Sürümü (AKTIF)

Video siyah zeminde dönüştürülmüş tabak halkası, `mix-blend-mode: screen` ile koyu daire içine gömülü. Sayfa zemininin rengi değişse bile video intakt kalır.

- **Dosya:** `menu/img/ring.mp4` (387 KB)
- **Poster:** `menu/img/ring-poster.webp` (10.6 KB)
- **Döngü:** 16.00 sn (RMS ölçüm: 0.29)
- **FPS:** 30, çözünürlük: 560×560

### Denenen ve Geri Alınan: Şeffaf Zemin Sürümü

Gercek alfa kanalı (VP9/WebM, colorkey). Teknik olarak çalıştı ama:

- 📱 **iPhone'da animasyon yok** (Safari VP9 alfayı güvenilir desteklemiyor)
- 📦 **Dosya 65% büyük** (635 KB vs. 387 KB)
- 🎥 **Halka seyreldi** (8 tabak → ~4 tabak, sönükler kesildi)

**Yedek:** `Desktop/cavuszade-ring-yedek/seffaf-surumu/` — geri dönülmek istenirse hazır.

---

## Bilinen Sorunlar / Yapılacaklar

### 🔴 **Bloke Edici: GitHub Pages Build Başarısız**

- **Ne:** Derleme 2026-08-06'dan beri "building" durumda, başarısızlaşıyor
- **Sebebi:** Bilinmiyor (muhtemelen Jekyll config)
- **Çözüm:** `.nojekyll` dosya eklemek denendi ama henüz push edilmedi
- **Sonuç:** Menü yayında değil → Pages'de deploy yok

**Adım:**
```bash
touch .nojekyll
git add .nojekyll
git commit -m "GitHub Pages: disable Jekyll to fix build failure"
git push
# Pages'i kontrol et: settings → Pages → build logs
```

### 🟡 **Branch Ayrışması**

Lokal: 1 commit ahead  
Origin: 4 commit ahead

Push başlamadan önce sinkronize etmek gerek (rebase ya da merge).

### 🟡 **Fiyatlar Doğrulanmamış**

**Baklava:** 26 Mart tarihli dosyadan (4+ ay eski), ama değişmiş mi bilinmiyor  
**İçecekler:** Tam yer tutucu (çay 2.50 TL, Türk kahvesi 4.00 TL, etc.)

Kullanıcıdan kesin fiyat alınması gerekli.

### 🟡 **Eksik Adet Sayıları**

Fıstık Sarma + Havuç Dilim: parça seçimi yok (menü bunları görmüyor)

---

## Ölçümler ve Teknik Kararlar

Tüm detay burada: **`docs/superpowers/specs/halka-animasyonu-notlari.md`**

Özet:
- Video kaynak analizi (608×512 içerik, merkez (464,392))
- Kırpma 656×656 @ (136,64) — ölçümle seçildi
- Colorkey similarity=0.36 — sönük tabakları kesmek için (ölçüm sonucu)
- Döngü periyodu 16.00 sn (tahmin değil, RMS ölçüm)

---

## Sıradaki Adımlar

**Öncelik sırasına göre:**

1. `.nojekyll` ekleyip Pages'i tamir et → menü yayına alınır
2. Branch'leri sinkronize et (rebase/merge)
3. Fiyatları kullanıcıdan doğrula → commit et
4. Fıstık Sarma + Havuç Dilim adet sayıları ekle
5. QR kod oluştur ve masalara yapıştır

---

## Okul PC'deki Claude'un Yapması Gereken

1. Bu dosyayı oku ✓
2. Oku: `docs/superpowers/specs/halka-animasyonu-notlari.md`
3. Çalıştır:
   ```bash
   git status
   git log --oneline -20
   ```
4. Sonra bana şunu söyle:
   - Projenin şu anki tam durumu
   - Hangi adım yapılabilir (Pages, fiyatlar, QR?)
   - Ne engel var

---

**Sorular?** Dosyaya geri dön ya da bu chat'in URL'sini okul PC'de aç.
