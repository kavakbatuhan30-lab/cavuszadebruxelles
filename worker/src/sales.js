/* Siparis defterinin saf mantigi. HTTP ve KV bilmez, bu yuzden tek basina
   test edilebilir.

   BU BIR KASA DEGILDIR. Fis kesmez, tutar hesaplamaz, musteriye belge
   vermez ve resmi satis kaydinin yerine gecmez. Belcikada GKS (witte kassa)
   kapsamindaki isletmede musteriye verilen fis sertifikali kasadan cikmak
   zorundadir; bu modul o zincire hic girmez. Tuttugu tek sey "tezgahtan ne
   kadar urun cikti" sayisidir -- kagit defterin dijital hali. Gerekcenin
   tamami docs/2026-08-30-siparis-defteri-design.md icinde. */

export const MAX_SATIR = 20;      /* tek siparisteki en fazla urun kalemi */
export const MAX_DILIM = 2000;    /* tek kalemde en fazla dilim/adet */
export const MAX_KG = 200;        /* tek kalemde en fazla kilogram */
export const MAX_META = 900;      /* KV metadata siniri 1024 bayt; pay birakiyoruz */
export const MAX_AY = 24;         /* trend sorgusunda en fazla kac ay */

/* Bir kilodan cikan dilim sayisi.

   TEK KAYNAK: kilo girisi burada dilime cevrilir. Sayilar
   docs/2026-08-04-qr-menu-design.md icindeki "adet/kg" tablosundan geliyor.

   null = HENUZ TEYIT EDILMEDI. O urune kilo girilebilir ve girilen deger
   kaybolmaz -- ham haliyle saklanir, raporda "cevrilemeyen kilo" olarak
   ayrica gosterilir. Katsayi buraya yazildigi anda gecmis aylar da
   kendiliginde duzelir, cunku kayitlar dilime cevrilmis halde degil
   GIRILDIGI HALDE saklanir. */
export const DILIM_PER_KG = {
  fistik:       25,
  sarma:        null,   /* TEYIT BEKLIYOR */
  havucdilim:   null,   /* TEYIT BEKLIYOR */
  bohca:        35,
  sobiyet:      20,
  sogukbaklava: 25,
  kadayif:      8,
  ceviz:        30
};

/* Kiloyla satilmayan kalemler. Bunlarda birim 'adet'tir. */
export const ADET_URUNLERI = ['su', 'soda'];

const AY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function gecerliAy(ay) {
  return typeof ay === 'string' && AY_RE.test(ay);
}

export function urunBirimi(id) {
  if (Object.prototype.hasOwnProperty.call(DILIM_PER_KG, id)) return 'dilim';
  if (ADET_URUNLERI.includes(id)) return 'adet';
  return null;
}

/* Sayi mi, sonlu mu, pozitif mi. NaN ve Infinity JSON'dan gelemez ama
   string "5" gelebilir -- onu da reddediyoruz. */
const pozitifSayi = n => typeof n === 'number' && Number.isFinite(n) && n > 0;

export function gecerliSatir(satir) {
  if (!satir || typeof satir !== 'object') return false;
  const birim = urunBirimi(satir.id);
  if (!birim) return false;

  if (birim === 'adet') {
    return satir.birim === 'adet' &&
      Number.isInteger(satir.miktar) && satir.miktar > 0 && satir.miktar <= MAX_DILIM;
  }

  if (satir.birim === 'dilim') {
    return Number.isInteger(satir.miktar) && satir.miktar > 0 && satir.miktar <= MAX_DILIM;
  }
  if (satir.birim === 'kg') {
    /* Kilo ondalikli olabilir (yarim kilo cok satilir). Kurusun altinda
       hassasiyet anlamsiz; 0,01 katlarina yuvarliyoruz ki kayan nokta
       artiklari anahtar uzunlugunu sismesin. */
    return pozitifSayi(satir.miktar) && satir.miktar <= MAX_KG &&
      Math.round(satir.miktar * 100) === satir.miktar * 100;
  }
  return false;
}

/* Bir siparisin tamamini dogrular. Hatayi cagiranin dogrudan yanit olarak
   dondurebilecegi bir dizgeyle bildirir. */
export function gecerliSiparis(satirlar) {
  if (!Array.isArray(satirlar) || satirlar.length === 0) return 'bos_siparis';
  if (satirlar.length > MAX_SATIR) return 'cok_fazla_satir';
  if (!satirlar.every(gecerliSatir)) return 'gecersiz_satir';
  return null;
}

/* KV anahtari: sale:YYYY-MM-DD:<zaman>-<rastgele>

   Her siparis KENDI anahtarina yazilir. Boylece oku-degistir-yaz dongusu
   hic olusmaz ve iki tezgahtar ayni anda kaydetse bile hicbir siparis
   kaybolmaz -- stok tarafindaki bilinen kayip guncelleme riski bu modulde
   dogmuyor.

   Ay oneki 'sale:YYYY-MM', gun oneki 'sale:YYYY-MM-DD:' olarak dogrudan
   list() ile taranabilir; ayrica dizin tutmak gerekmiyor. */
export function siparisAnahtari(tarih, zamanMs, rastgele) {
  return `sale:${tarih}:${zamanMs}-${rastgele}`;
}

export function ayOneki(ay) {
  return `sale:${ay}`;
}

/* Anahtardan takvim gununu geri okur. list() zaten yalnizca eslesen
   anahtarlari dondugu icin bu ayristirma guvenli. */
export function anahtardanTarih(anahtar) {
  const p = anahtar.split(':');
  return p.length >= 3 ? p[1] : null;
}

/* list() metadata'yi anahtarlarla birlikte dondurur; yani aylik rapor icin
   siparis basina ayrica get() cagirmak gerekmiyor. Bu sadece hiz meselesi
   degil: Workers'ta istek basina alt istek sayisi sinirli, siparis basina
   bir get() ayda birkac yuz siparisten sonra o siniri patlatirdi.

   Bu yuzden satirlar metadata'ya sikistirilmis dizi olarak konur. */
export function meta(satirlar) {
  return { s: satirlar.map(x => [x.id, x.birim, x.miktar]) };
}

export function metaBoyutu(m) {
  return JSON.stringify(m).length;
}

export function metadanSatirlar(m) {
  if (!m || !Array.isArray(m.s)) return [];
  return m.s
    .filter(x => Array.isArray(x) && x.length === 3)
    .map(([id, birim, miktar]) => ({ id, birim, miktar }))
    .filter(gecerliSatir);
}

/* from ve to dahil, aradaki butun aylar. Ters verilirse bos doner. */
export function aylar(from, to) {
  if (!gecerliAy(from) || !gecerliAy(to)) return [];
  const liste = [];
  let [y, a] = from.split('-').map(Number);
  const [sy, sa] = to.split('-').map(Number);
  while (y < sy || (y === sy && a <= sa)) {
    liste.push(`${y}-${String(a).padStart(2, '0')}`);
    if (liste.length > MAX_AY) return liste.slice(0, MAX_AY);
    if (++a > 12) { a = 1; y++; }
  }
  return liste;
}

const yuvarla = (n, basamak) => {
  const k = 10 ** basamak;
  return Math.round(n * k) / k;
};

function bosKalem(id) {
  const birim = urunBirimi(id);
  return birim === 'adet'
    ? { birim: 'adet', adet: 0 }
    : { birim: 'dilim', dilimGirisi: 0, kgGirisi: 0 };
}

/* Ham girisleri turetilmis degerlere cevirir: dilim toplami, kilo karsiligi
   ve katsayisi olmayan urunlerde cevrilemeyen kilo. */
function kalemiKapat(id, ham) {
  if (ham.birim === 'adet') return { birim: 'adet', adet: ham.adet };

  const f = DILIM_PER_KG[id];
  if (f == null) {
    return {
      birim: 'dilim',
      dilim: ham.dilimGirisi,
      kg: null,
      cevrilemeyenKg: yuvarla(ham.kgGirisi, 3),
      eksikKatsayi: true
    };
  }
  const dilim = ham.dilimGirisi + ham.kgGirisi * f;
  return {
    birim: 'dilim',
    dilim: yuvarla(dilim, 1),
    kg: yuvarla(dilim / f, 2),
    cevrilemeyenKg: 0,
    eksikKatsayi: false
  };
}

function kapat(hamlar) {
  const cikti = {};
  for (const [id, ham] of Object.entries(hamlar)) cikti[id] = kalemiKapat(id, ham);
  return cikti;
}

function ekle(hedef, satir) {
  const ham = hedef[satir.id] ?? (hedef[satir.id] = bosKalem(satir.id));
  if (ham.birim === 'adet') ham.adet += satir.miktar;
  else if (satir.birim === 'kg') ham.kgGirisi += satir.miktar;
  else ham.dilimGirisi += satir.miktar;
}

/* kayitlar: [{ tarih, satirlar }] -- sirasi onemsiz.

   Donen yapi: gun bazinda kirilim (ay ici grafik icin), urun bazinda
   toplam (ay sonu raporu icin) ve siparis sayisi. */
export function topla(kayitlar) {
  const toplamHam = {};
  const gunHam = {};
  let siparis = 0;

  for (const k of kayitlar) {
    if (!k || !Array.isArray(k.satirlar) || k.satirlar.length === 0) continue;
    siparis++;
    const gun = gunHam[k.tarih] ?? (gunHam[k.tarih] = {});
    for (const satir of k.satirlar) {
      ekle(toplamHam, satir);
      ekle(gun, satir);
    }
  }

  const gunler = {};
  for (const tarih of Object.keys(gunHam).sort()) gunler[tarih] = kapat(gunHam[tarih]);

  return { siparis, toplam: kapat(toplamHam), gunler };
}
