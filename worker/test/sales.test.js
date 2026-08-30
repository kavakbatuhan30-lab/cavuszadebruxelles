import { describe, it, expect } from 'vitest';
import {
  DILIM_PER_KG, ADET_URUNLERI, MAX_SATIR, MAX_DILIM, MAX_KG, MAX_AY, MAX_META,
  gecerliAy, urunBirimi, gecerliSatir, gecerliSiparis, siparisAnahtari, ayOneki,
  anahtardanTarih, meta, metaBoyutu, metadanSatirlar, aylar, topla
} from '../src/sales.js';

const dilim = (id, n) => ({ id, birim: 'dilim', miktar: n });
const kg = (id, n) => ({ id, birim: 'kg', miktar: n });
const adet = (id, n) => ({ id, birim: 'adet', miktar: n });

describe('DILIM_PER_KG', () => {
  it('menudeki sekiz baklavanin hepsini tanir', () => {
    expect(Object.keys(DILIM_PER_KG).sort()).toEqual([
      'bohca', 'ceviz', 'fistik', 'havucdilim',
      'kadayif', 'sarma', 'sobiyet', 'sogukbaklava'
    ]);
  });

  it('teyit edilmis katsayilari tasarim belgesindeki gibi tutar', () => {
    expect(DILIM_PER_KG.fistik).toBe(25);
    expect(DILIM_PER_KG.ceviz).toBe(30);
    expect(DILIM_PER_KG.sobiyet).toBe(20);
    expect(DILIM_PER_KG.bohca).toBe(35);
    expect(DILIM_PER_KG.sogukbaklava).toBe(25);
    expect(DILIM_PER_KG.kadayif).toBe(8);
  });

  it('teyit edilmemis iki urunu null birakir', () => {
    expect(DILIM_PER_KG.sarma).toBeNull();
    expect(DILIM_PER_KG.havucdilim).toBeNull();
  });
});

describe('urunBirimi', () => {
  it('baklavaya dilim, icecege adet der', () => {
    expect(urunBirimi('fistik')).toBe('dilim');
    expect(urunBirimi('sarma')).toBe('dilim');
    expect(urunBirimi('su')).toBe('adet');
    expect(urunBirimi('soda')).toBe('adet');
  });

  it('bilinmeyen urune null der', () => {
    expect(urunBirimi('lahmacun')).toBeNull();
    expect(urunBirimi('')).toBeNull();
    expect(urunBirimi(null)).toBeNull();
  });

  it('Object prototip alanlarini urun sanmaz', () => {
    expect(urunBirimi('constructor')).toBeNull();
    expect(urunBirimi('toString')).toBeNull();
  });
});

describe('gecerliSatir', () => {
  it('dilim ve kilo girisini kabul eder', () => {
    expect(gecerliSatir(dilim('fistik', 5))).toBe(true);
    expect(gecerliSatir(kg('fistik', 1))).toBe(true);
    expect(gecerliSatir(kg('fistik', 0.5))).toBe(true);
    expect(gecerliSatir(kg('fistik', 1.25))).toBe(true);
  });

  it('katsayisi olmayan urune de kilo girilebilir', () => {
    /* Katsayi eksikligi girisi engellemez -- tezgahtar beklemesin diye.
       Cevrilemeyen kilo raporda ayrica gosterilir. */
    expect(gecerliSatir(kg('sarma', 1))).toBe(true);
  });

  it('icecekte yalnizca adet birimini kabul eder', () => {
    expect(gecerliSatir(adet('su', 2))).toBe(true);
    expect(gecerliSatir(dilim('su', 2))).toBe(false);
    expect(gecerliSatir(kg('su', 2))).toBe(false);
  });

  it('baklavada adet birimini reddeder', () => {
    expect(gecerliSatir(adet('fistik', 2))).toBe(false);
  });

  it('sifir ve negatif miktari reddeder', () => {
    expect(gecerliSatir(dilim('fistik', 0))).toBe(false);
    expect(gecerliSatir(dilim('fistik', -3))).toBe(false);
    expect(gecerliSatir(kg('fistik', 0))).toBe(false);
    expect(gecerliSatir(kg('fistik', -1))).toBe(false);
  });

  it('dilimde ondalik kabul etmez', () => {
    expect(gecerliSatir(dilim('fistik', 2.5))).toBe(false);
  });

  it('kiloda kurus altini kabul etmez', () => {
    expect(gecerliSatir(kg('fistik', 0.005))).toBe(false);
    expect(gecerliSatir(kg('fistik', 1.234))).toBe(false);
  });

  it('ust sinirlari uygular', () => {
    expect(gecerliSatir(dilim('fistik', MAX_DILIM))).toBe(true);
    expect(gecerliSatir(dilim('fistik', MAX_DILIM + 1))).toBe(false);
    expect(gecerliSatir(kg('fistik', MAX_KG))).toBe(true);
    expect(gecerliSatir(kg('fistik', MAX_KG + 1))).toBe(false);
  });

  it('sayi yerine dizge gelirse reddeder', () => {
    expect(gecerliSatir({ id: 'fistik', birim: 'dilim', miktar: '5' })).toBe(false);
    expect(gecerliSatir({ id: 'fistik', birim: 'kg', miktar: '1' })).toBe(false);
  });

  it('bozuk girdide cokmez', () => {
    expect(gecerliSatir(null)).toBe(false);
    expect(gecerliSatir(undefined)).toBe(false);
    expect(gecerliSatir('fistik')).toBe(false);
    expect(gecerliSatir({})).toBe(false);
    expect(gecerliSatir({ id: 'fistik' })).toBe(false);
    expect(gecerliSatir({ id: 'fistik', birim: 'ton', miktar: 1 })).toBe(false);
  });
});

describe('gecerliSiparis', () => {
  it('dolu siparise null doner', () => {
    expect(gecerliSiparis([dilim('fistik', 5), adet('su', 1)])).toBeNull();
  });

  it('bos siparisi reddeder', () => {
    expect(gecerliSiparis([])).toBe('bos_siparis');
    expect(gecerliSiparis(null)).toBe('bos_siparis');
    expect(gecerliSiparis('fistik')).toBe('bos_siparis');
  });

  it('cok uzun siparisi reddeder', () => {
    const uzun = Array.from({ length: MAX_SATIR + 1 }, () => dilim('fistik', 1));
    expect(gecerliSiparis(uzun)).toBe('cok_fazla_satir');
  });

  it('tek bozuk satir tum siparisi dusurur', () => {
    expect(gecerliSiparis([dilim('fistik', 5), dilim('lahmacun', 1)])).toBe('gecersiz_satir');
  });
});

describe('anahtarlar', () => {
  it('ay oneki o ayin gunlerini yakalar', () => {
    const a = siparisAnahtari('2026-08-30', 1756550000000, 'ab12cd');
    expect(a.startsWith(ayOneki('2026-08'))).toBe(true);
    expect(a.startsWith(ayOneki('2026-09'))).toBe(false);
  });

  it('ayni milisaniyede iki siparis farkli anahtar alir', () => {
    expect(siparisAnahtari('2026-08-30', 1756550000000, 'aaa'))
      .not.toBe(siparisAnahtari('2026-08-30', 1756550000000, 'bbb'));
  });

  it('anahtardan tarihi geri okur', () => {
    const a = siparisAnahtari('2026-08-30', 1756550000000, 'ab12cd');
    expect(anahtardanTarih(a)).toBe('2026-08-30');
  });

  it('bozuk anahtarda null doner', () => {
    expect(anahtardanTarih('sale')).toBeNull();
  });
});

describe('meta', () => {
  it('satirlari gidip gelebilir bicimde paketler', () => {
    const satirlar = [dilim('fistik', 5), kg('ceviz', 1.5), adet('su', 2)];
    expect(metadanSatirlar(meta(satirlar))).toEqual(satirlar);
  });

  it('en buyuk siparis bile KV metadata sinirina sigar', () => {
    /* Sinir asilirsa siparis kaydedilemezdi; bu testin amaci MAX_SATIR
       buyutuldugunde ya da urun kimlikleri uzadiginda sessizce degil
       burada patlamasi. */
    const idler = [...Object.keys(DILIM_PER_KG), ...ADET_URUNLERI];
    const enBuyuk = Array.from({ length: MAX_SATIR }, (_, i) => {
      const id = idler[i % idler.length];
      return { id, birim: urunBirimi(id) === 'adet' ? 'adet' : 'kg', miktar: 199.99 };
    });
    expect(metaBoyutu(meta(enBuyuk))).toBeLessThan(MAX_META);
  });

  it('bozuk metadatayi sessizce eler', () => {
    expect(metadanSatirlar(null)).toEqual([]);
    expect(metadanSatirlar({})).toEqual([]);
    expect(metadanSatirlar({ s: 'x' })).toEqual([]);
    expect(metadanSatirlar({ s: [['fistik', 'dilim']] })).toEqual([]);
    expect(metadanSatirlar({ s: [['lahmacun', 'dilim', 1]] })).toEqual([]);
    expect(metadanSatirlar({ s: [['fistik', 'dilim', 1], null] })).toEqual([dilim('fistik', 1)]);
  });
});

describe('gecerliAy', () => {
  it('dogru bicimi kabul eder', () => {
    expect(gecerliAy('2026-08')).toBe(true);
    expect(gecerliAy('2026-01')).toBe(true);
    expect(gecerliAy('2026-12')).toBe(true);
  });

  it('yanlis bicimi reddeder', () => {
    expect(gecerliAy('2026-13')).toBe(false);
    expect(gecerliAy('2026-00')).toBe(false);
    expect(gecerliAy('2026-8')).toBe(false);
    expect(gecerliAy('2026-08-30')).toBe(false);
    expect(gecerliAy('')).toBe(false);
    expect(gecerliAy(null)).toBe(false);
  });
});

describe('aylar', () => {
  it('iki ucu da dahil eder', () => {
    expect(aylar('2026-06', '2026-08')).toEqual(['2026-06', '2026-07', '2026-08']);
  });

  it('tek ay verir', () => {
    expect(aylar('2026-08', '2026-08')).toEqual(['2026-08']);
  });

  it('yil sinirini gecer', () => {
    expect(aylar('2026-11', '2027-02'))
      .toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });

  it('ters araliga bos doner', () => {
    expect(aylar('2026-08', '2026-06')).toEqual([]);
  });

  it('gecersiz aya bos doner', () => {
    expect(aylar('2026-13', '2027-01')).toEqual([]);
  });

  it('araligi MAX_AY ile sinirlar', () => {
    /* Sinirsiz aralik tek istekte yuzlerce list() cagirir. */
    expect(aylar('2000-01', '2099-12')).toHaveLength(MAX_AY);
  });
});

describe('topla', () => {
  it('dilim girisini toplar ve kilo karsiligini verir', () => {
    const r = topla([
      { tarih: '2026-08-01', satirlar: [dilim('fistik', 5)] },
      { tarih: '2026-08-02', satirlar: [dilim('fistik', 20)] }
    ]);
    expect(r.siparis).toBe(2);
    expect(r.toplam.fistik.dilim).toBe(25);
    expect(r.toplam.fistik.kg).toBe(1);        /* 25 dilim = 1 kg */
  });

  it('kilo girisini dilime cevirir', () => {
    const r = topla([{ tarih: '2026-08-01', satirlar: [kg('ceviz', 2)] }]);
    expect(r.toplam.ceviz.dilim).toBe(60);      /* 2 kg x 30 */
    expect(r.toplam.ceviz.kg).toBe(2);
  });

  it('ayni urunun dilim ve kilo girisini birlestirir', () => {
    /* Musteri "1 kilo fistikli, ustune 5 dilim de" derse ikisi tek
       toplamda birlesmeli. */
    const r = topla([{ tarih: '2026-08-01', satirlar: [kg('fistik', 1), dilim('fistik', 5)] }]);
    expect(r.toplam.fistik.dilim).toBe(30);     /* 25 + 5 */
    expect(r.toplam.fistik.kg).toBe(1.2);
  });

  it('yarim kiloyu dogru cevirir', () => {
    const r = topla([{ tarih: '2026-08-01', satirlar: [kg('sobiyet', 0.5)] }]);
    expect(r.toplam.sobiyet.dilim).toBe(10);    /* 0,5 x 20 */
  });

  it('katsayisi olmayan urunde kiloyu kaybetmez, ayirir', () => {
    const r = topla([{ tarih: '2026-08-01', satirlar: [dilim('sarma', 4), kg('sarma', 1.5)] }]);
    expect(r.toplam.sarma.eksikKatsayi).toBe(true);
    expect(r.toplam.sarma.dilim).toBe(4);       /* kilo dilime karistirilmadi */
    expect(r.toplam.sarma.kg).toBeNull();
    expect(r.toplam.sarma.cevrilemeyenKg).toBe(1.5);
  });

  it('icecegi adet olarak sayar', () => {
    const r = topla([
      { tarih: '2026-08-01', satirlar: [adet('su', 2), adet('soda', 1)] },
      { tarih: '2026-08-01', satirlar: [adet('su', 3)] }
    ]);
    expect(r.toplam.su).toEqual({ birim: 'adet', adet: 5 });
    expect(r.toplam.soda.adet).toBe(1);
  });

  it('gun bazinda kirilim uretir ve gunleri sirali tutar', () => {
    const r = topla([
      { tarih: '2026-08-30', satirlar: [dilim('fistik', 1)] },
      { tarih: '2026-08-02', satirlar: [dilim('fistik', 2)] },
      { tarih: '2026-08-10', satirlar: [dilim('fistik', 3)] }
    ]);
    expect(Object.keys(r.gunler)).toEqual(['2026-08-02', '2026-08-10', '2026-08-30']);
    expect(r.gunler['2026-08-02'].fistik.dilim).toBe(2);
  });

  it('ayni gune iki siparisi toplar', () => {
    const r = topla([
      { tarih: '2026-08-01', satirlar: [dilim('fistik', 5)] },
      { tarih: '2026-08-01', satirlar: [dilim('fistik', 7)] }
    ]);
    expect(r.gunler['2026-08-01'].fistik.dilim).toBe(12);
    expect(r.siparis).toBe(2);
  });

  it('bos kayit listesinde bos sonuc doner', () => {
    expect(topla([])).toEqual({ siparis: 0, toplam: {}, gunler: {} });
  });

  it('bos ve bozuk kayitlari siparis saymaz', () => {
    const r = topla([
      null,
      { tarih: '2026-08-01', satirlar: [] },
      { tarih: '2026-08-01' },
      { tarih: '2026-08-01', satirlar: [dilim('fistik', 1)] }
    ]);
    expect(r.siparis).toBe(1);
    expect(r.toplam.fistik.dilim).toBe(1);
  });

  it('kayan nokta artigi biriktirmez', () => {
    /* 0,1 + 0,2 problemine karsi: 10 kez yarim kilo tam 5 kilo etmeli. */
    const kayitlar = Array.from({ length: 10 }, () => (
      { tarih: '2026-08-01', satirlar: [kg('fistik', 0.5)] }
    ));
    expect(topla(kayitlar).toplam.fistik.kg).toBe(5);
    expect(topla(kayitlar).toplam.fistik.dilim).toBe(125);
  });
});
