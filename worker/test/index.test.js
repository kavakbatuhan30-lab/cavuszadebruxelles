import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src/index.js';
import { hashPassword } from '../src/auth.js';
import { brusselsDate } from '../src/stock.js';

/* Rapor sorgulari icinde bulunulan Bruksel ayini kullanir; test de ayni
   kaynaktan hesaplasin ki ay donumu gecesi kirilmasin. */
const brusselsDateSimdi = () => brusselsDate().slice(0, 7);

const TUZ = 'dGVzdC1zYWx0LTEyMzQ1Ng==';
const JETON_ANAHTARI = 'test-jeton-anahtari';
const SIFRE = 'baklava123';

/* Bellekte KV taklidi -- gercek KV'nin kullandigimiz metodlarini tasir:
   get, put (metadata ve son kullanma ile), list (onek ve imlecle).

   Imlec gercekte opaktir; burada "sonraki anahtarin adi" olarak taklit
   ediliyor. Sayfalamanin kendisi taklit edilebilsin diye yeterli. */
function sahteKV(baslangic = {}) {
  const depo = new Map(Object.entries(baslangic).map(([k, v]) => [k, { deger: v }]));
  return {
    async get(k, tip) {
      const kayit = depo.get(k);
      if (!kayit) return null;
      return tip === 'json' ? JSON.parse(kayit.deger) : kayit.deger;
    },
    async put(k, deger, opts = {}) {
      depo.set(k, { deger, metadata: opts.metadata, ttl: opts.expirationTtl });
    },
    async list({ prefix = '', cursor, limit = 1000 } = {}) {
      const hepsi = [...depo.keys()].filter(k => k.startsWith(prefix)).sort();
      const bas = cursor ? hepsi.indexOf(cursor) : 0;
      const parca = hepsi.slice(bas, bas + limit);
      const bitti = bas + limit >= hepsi.length;
      return {
        keys: parca.map(name => ({ name, metadata: depo.get(name).metadata })),
        list_complete: bitti,
        cursor: bitti ? undefined : hepsi[bas + limit]
      };
    },
    _depo: depo
  };
}

let env;
beforeEach(async () => {
  env = {
    STOK: sahteKV(),
    SIFRE_OZETI: await hashPassword(SIFRE, TUZ),
    SIFRE_TUZU: TUZ,
    JETON_ANAHTARI,
    IZINLI_KAYNAK: 'https://cavuszadebruxelles.com'
  };
});

const istek = (yol, secenek = {}) =>
  new Request(`https://x.dev${yol}`, secenek);

const yazmaIstegi = (govde, jeton) => istek('/api/stock', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Origin': 'https://cavuszadebruxelles.com',
    ...(jeton ? { 'Authorization': `Bearer ${jeton}` } : {})
  },
  body: JSON.stringify(govde)
});

async function jetonAl() {
  const r = await worker.fetch(istek('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'https://cavuszadebruxelles.com' },
    body: JSON.stringify({ password: SIFRE })
  }), env);
  return (await r.json()).token;
}

describe('GET /api/stock', () => {
  it('kayit yokken bos liste doner', async () => {
    const r = await worker.fetch(istek('/api/stock'), env);
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.out).toEqual([]);
  });

  it('onbelleklenmeyi engeller', async () => {
    const r = await worker.fetch(istek('/api/stock'), env);
    expect(r.headers.get('Cache-Control')).toContain('no-store');
  });

  it('dunku kaydi bos doner', async () => {
    env.STOK = sahteKV({
      'shop:cavuszade:stock': JSON.stringify({
        date: '2020-01-01', out: ['sarma'], updatedAt: 'x'
      })
    });
    const d = await (await worker.fetch(istek('/api/stock'), env)).json();
    expect(d.out).toEqual([]);
  });
});

describe('POST /api/login', () => {
  it('dogru sifre jeton verir', async () => {
    const jeton = await jetonAl();
    expect(typeof jeton).toBe('string');
    expect(jeton.split('.')).toHaveLength(2);
  });

  it('yanlis sifre 401 doner', async () => {
    const r = await worker.fetch(istek('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://cavuszadebruxelles.com' },
      body: JSON.stringify({ password: 'yanlis' })
    }), env);
    expect(r.status).toBe(401);
  });
});

describe('POST /api/stock', () => {
  it('gecerli jetonla urunu kapatir', async () => {
    const jeton = await jetonAl();
    const r = await worker.fetch(yazmaIstegi({ id: 'sarma', inStock: false }, jeton), env);
    expect(r.status).toBe(200);
    expect((await r.json()).out).toEqual(['sarma']);
  });

  it('degisiklik GET ile geri okunur', async () => {
    const jeton = await jetonAl();
    await worker.fetch(yazmaIstegi({ id: 'sarma', inStock: false }, jeton), env);
    const d = await (await worker.fetch(istek('/api/stock'), env)).json();
    expect(d.out).toEqual(['sarma']);
  });

  it('jetonsuz istegi 401 ile reddeder', async () => {
    const r = await worker.fetch(yazmaIstegi({ id: 'sarma', inStock: false }, null), env);
    expect(r.status).toBe(401);
  });

  it('gecersiz kimligi 400 ile reddeder', async () => {
    const jeton = await jetonAl();
    const r = await worker.fetch(yazmaIstegi({ id: 'BUYUK!', inStock: false }, jeton), env);
    expect(r.status).toBe(400);
  });

  it('yabanci kaynagi reddeder', async () => {
    const jeton = await jetonAl();
    const r = await worker.fetch(istek('/api/stock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://kotu-site.example',
        'Authorization': `Bearer ${jeton}`
      },
      body: JSON.stringify({ id: 'sarma', inStock: false })
    }), env);
    expect(r.status).toBe(403);
  });

  it('YAZMA YOLUNDA once sifirlama uygular', async () => {
    // Dunden kalma kayit: ceviz tukenmis gorunuyor.
    env.STOK = sahteKV({
      'shop:cavuszade:stock': JSON.stringify({
        date: '2020-01-01', out: ['ceviz'], updatedAt: 'x'
      })
    });
    const jeton = await jetonAl();
    await worker.fetch(yazmaIstegi({ id: 'sarma', inStock: false }, jeton), env);
    const d = await (await worker.fetch(istek('/api/stock'), env)).json();
    // ceviz dunden kaldi, bugune tasinmamali.
    expect(d.out).toEqual(['sarma']);
  });

  it('liste ust sinira ulasinca 400 doner', async () => {
    const jeton = await jetonAl();
    const dolu = Array.from({ length: 100 }, (_, i) => `urun-${i}`).sort();
    env.STOK = sahteKV({
      'shop:cavuszade:stock': JSON.stringify({
        date: new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Brussels' }),
        out: dolu, updatedAt: 'x'
      })
    });
    const r = await worker.fetch(yazmaIstegi({ id: 'yeni-urun', inStock: false }, jeton), env);
    expect(r.status).toBe(400);
  });
});

describe('eksik yapilandirma', () => {
  /* Gizli degerler konulmadan dagitim yapilirsa Worker istisna firlatip 500
     vermemeli. Uretimde gercekten yasandi: sifre ozeti yokken /api/login
     "error code 1101" dondu. */
  it('gizli degerler yokken giris 503 doner, cokmez', async () => {
    delete env.SIFRE_OZETI;
    delete env.SIFRE_TUZU;
    const r = await worker.fetch(istek('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://cavuszadebruxelles.com' },
      body: JSON.stringify({ password: 'herhangibirsey' })
    }), env);
    expect(r.status).toBe(503);
    expect((await r.json()).error).toBe('not_configured');
  });

  it('jeton anahtari yokken yazma 503 doner, cokmez', async () => {
    delete env.JETON_ANAHTARI;
    const r = await worker.fetch(yazmaIstegi({ id: 'sarma', inStock: false }, 'herhangi.jeton'), env);
    expect(r.status).toBe(503);
  });

  it('gizli degerler yokken okuma calismaya devam eder', async () => {
    delete env.SIFRE_OZETI;
    delete env.SIFRE_TUZU;
    delete env.JETON_ANAHTARI;
    const r = await worker.fetch(istek('/api/stock'), env);
    expect(r.status).toBe(200);
  });
});

describe('CORS', () => {
  it('GET her kaynaga acik', async () => {
    const r = await worker.fetch(istek('/api/stock', {
      headers: { 'Origin': 'http://localhost:8765' }
    }), env);
    expect(r.status).toBe(200);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('IZINLI_KAYNAK virgullu liste kabul eder', async () => {
    env.IZINLI_KAYNAK = 'https://cavuszadebruxelles.com, http://localhost:8765';
    const jeton = await jetonAl();
    const r = await worker.fetch(istek('/api/stock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:8765',
        'Authorization': `Bearer ${jeton}`
      },
      body: JSON.stringify({ id: 'sarma', inStock: false })
    }), env);
    expect(r.status).toBe(200);
  });

  it('OPTIONS on istegi 204 doner', async () => {
    const r = await worker.fetch(istek('/api/stock', { method: 'OPTIONS' }), env);
    expect(r.status).toBe(204);
    expect(r.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });
});

describe('giris denemesi siniri', () => {
  const girisDene = (sifre, ip = '203.0.113.9') => worker.fetch(istek('/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://cavuszadebruxelles.com',
      'CF-Connecting-IP': ip
    },
    body: JSON.stringify({ password: sifre })
  }), env);

  const yanlisGiris = () => girisDene('yanlis');

  it('10 denemeye kadar 401 doner', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await yanlisGiris()).status).toBe(401);
    }
  });

  it('11. denemede 429 doner', async () => {
    for (let i = 0; i < 10; i++) await yanlisGiris();
    expect((await yanlisGiris()).status).toBe(429);
  });

  it('sinira takilinca sifreyi hic kontrol etmez', async () => {
    for (let i = 0; i < 11; i++) await yanlisGiris();
    // Dogru sifreyle bile 429: sayac IP bazli, sifreden bagimsiz.
    expect((await girisDene(SIFRE)).status).toBe(429);
  });

  it('baska IP etkilenmez', async () => {
    for (let i = 0; i < 11; i++) await yanlisGiris();
    expect((await girisDene(SIFRE, '198.51.100.4')).status).toBe(200);
  });

  it('basarili giris sayaci sifirlar', async () => {
    for (let i = 0; i < 5; i++) await yanlisGiris();
    await girisDene(SIFRE);
    for (let i = 0; i < 10; i++) {
      expect((await yanlisGiris()).status).toBe(401);
    }
  });

  it('sayaca son kullanma suresi konur', async () => {
    await yanlisGiris();
    expect(env.STOK._depo.get('rl:login:203.0.113.9').ttl).toBe(15 * 60);
  });
});

/* ---- Siparis defteri ---------------------------------------------------- */

const siparisYaz = (satirlar, jeton) => istek('/api/sales', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Origin': 'https://cavuszadebruxelles.com',
    ...(jeton ? { 'Authorization': `Bearer ${jeton}` } : {})
  },
  body: JSON.stringify({ satirlar })
});

const raporOku = (sorgu, jeton) => istek(`/api/sales${sorgu}`, {
  headers: {
    'Origin': 'https://cavuszadebruxelles.com',
    ...(jeton ? { 'Authorization': `Bearer ${jeton}` } : {})
  }
});

describe('POST /api/sales', () => {
  it('jetonsuz istegi reddeder', async () => {
    const r = await worker.fetch(siparisYaz([{ id: 'fistik', birim: 'dilim', miktar: 5 }]), env);
    expect(r.status).toBe(401);
  });

  it('yabanci kaynagi reddeder', async () => {
    const jeton = await jetonAl();
    const r = await worker.fetch(istek('/api/sales', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://kotu.example',
        'Authorization': `Bearer ${jeton}`
      },
      body: JSON.stringify({ satirlar: [{ id: 'fistik', birim: 'dilim', miktar: 5 }] })
    }), env);
    expect(r.status).toBe(403);
  });

  it('siparisi kaydeder', async () => {
    const jeton = await jetonAl();
    const satirlar = [
      { id: 'fistik', birim: 'dilim', miktar: 5 },
      { id: 'ceviz', birim: 'kg', miktar: 1 },
      { id: 'su', birim: 'adet', miktar: 2 }
    ];
    const r = await worker.fetch(siparisYaz(satirlar, jeton), env);
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.ok).toBe(true);
    expect(d.anahtar.startsWith('sale:')).toBe(true);
    expect(d.satirlar).toEqual(satirlar);
  });

  it('satirlari metadataya yazar -- rapor get() cagirmadan okuyabilsin', async () => {
    const jeton = await jetonAl();
    const r = await worker.fetch(
      siparisYaz([{ id: 'fistik', birim: 'dilim', miktar: 5 }], jeton), env);
    const { anahtar } = await r.json();
    expect(env.STOK._depo.get(anahtar).metadata).toEqual({ s: [['fistik', 'dilim', 5]] });
  });

  it('es zamanli iki siparis birbirini ezmez', async () => {
    /* Bu modulun tasarim gerekcesi: her siparis kendi anahtarina gider,
       oku-degistir-yaz yok. Ikisi de kalmali. */
    const jeton = await jetonAl();
    const [a, b] = await Promise.all([
      worker.fetch(siparisYaz([{ id: 'fistik', birim: 'dilim', miktar: 5 }], jeton), env),
      worker.fetch(siparisYaz([{ id: 'ceviz', birim: 'dilim', miktar: 3 }], jeton), env)
    ]);
    const ka = (await a.json()).anahtar;
    const kb = (await b.json()).anahtar;
    expect(ka).not.toBe(kb);
    expect([...env.STOK._depo.keys()].filter(k => k.startsWith('sale:'))).toHaveLength(2);
  });

  it('bos siparisi reddeder', async () => {
    const jeton = await jetonAl();
    const r = await worker.fetch(siparisYaz([], jeton), env);
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('bos_siparis');
  });

  it('bilinmeyen urunu reddeder', async () => {
    const jeton = await jetonAl();
    const r = await worker.fetch(
      siparisYaz([{ id: 'lahmacun', birim: 'dilim', miktar: 1 }], jeton), env);
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('gecersiz_satir');
  });

  it('negatif miktari reddeder', async () => {
    const jeton = await jetonAl();
    const r = await worker.fetch(
      siparisYaz([{ id: 'fistik', birim: 'dilim', miktar: -5 }], jeton), env);
    expect(r.status).toBe(400);
  });

  it('bozuk JSON gelirse 400 doner', async () => {
    const jeton = await jetonAl();
    const r = await worker.fetch(istek('/api/sales', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://cavuszadebruxelles.com',
        'Authorization': `Bearer ${jeton}`
      },
      body: '{bozuk'
    }), env);
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('bad_json');
  });

  it('stok kaydina dokunmaz', async () => {
    const jeton = await jetonAl();
    await worker.fetch(siparisYaz([{ id: 'fistik', birim: 'dilim', miktar: 5 }], jeton), env);
    const r = await worker.fetch(istek('/api/stock'), env);
    expect((await r.json()).out).toEqual([]);
  });
});

describe('GET /api/sales', () => {
  async function doldur(jeton, siparisler) {
    for (const s of siparisler) {
      const r = await worker.fetch(siparisYaz(s, jeton), env);
      expect(r.status).toBe(200);
    }
  }

  it('jetonsuz istegi reddeder', async () => {
    /* Satis miktari isletmenin ic verisi -- stok gibi herkese acik degil. */
    const r = await worker.fetch(raporOku('?month=2026-08'), env);
    expect(r.status).toBe(401);
  });

  it('kayit yokken bos rapor doner', async () => {
    const jeton = await jetonAl();
    const r = await worker.fetch(raporOku('?month=2026-08', jeton), env);
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.ay).toBe('2026-08');
    expect(d.siparis).toBe(0);
    expect(d.toplam).toEqual({});
  });

  it('ay verilmezse icinde bulunulan ayi kullanir', async () => {
    const jeton = await jetonAl();
    const d = await (await worker.fetch(raporOku('', jeton), env)).json();
    expect(d.ay).toMatch(/^\d{4}-\d{2}$/);
  });

  it('gecersiz ayi reddeder', async () => {
    const jeton = await jetonAl();
    const r = await worker.fetch(raporOku('?month=2026-13', jeton), env);
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('gecersiz_ay');
  });

  it('siparisleri urun bazinda toplar', async () => {
    const jeton = await jetonAl();
    await doldur(jeton, [
      [{ id: 'fistik', birim: 'dilim', miktar: 5 }],
      [{ id: 'fistik', birim: 'dilim', miktar: 7 }, { id: 'su', birim: 'adet', miktar: 1 }]
    ]);
    const ay = brusselsDateSimdi();
    const d = await (await worker.fetch(raporOku(`?month=${ay}`, jeton), env)).json();
    expect(d.siparis).toBe(2);
    expect(d.toplam.fistik.dilim).toBe(12);
    expect(d.toplam.su.adet).toBe(1);
  });

  it('kilo girisini dilime cevirir', async () => {
    const jeton = await jetonAl();
    await doldur(jeton, [[{ id: 'ceviz', birim: 'kg', miktar: 2 }]]);
    const ay = brusselsDateSimdi();
    const d = await (await worker.fetch(raporOku(`?month=${ay}`, jeton), env)).json();
    expect(d.toplam.ceviz.dilim).toBe(60);   /* 2 kg x 30 dilim */
  });

  it('cevrim tablosunu yanitla birlikte doner', async () => {
    /* Panel kendi kopyasini tutmasin diye: tablo tek yerde, worker'da. */
    const jeton = await jetonAl();
    const d = await (await worker.fetch(raporOku('?month=2026-08', jeton), env)).json();
    expect(d.dilimPerKg.fistik).toBe(25);
    expect(d.dilimPerKg.sarma).toBeNull();
  });

  it('baska ayin siparisini bu aya karistirmaz', async () => {
    const jeton = await jetonAl();
    await doldur(jeton, [[{ id: 'fistik', birim: 'dilim', miktar: 5 }]]);
    const d = await (await worker.fetch(raporOku('?month=1999-01', jeton), env)).json();
    expect(d.siparis).toBe(0);
  });

  it('gun bazinda kirilim verir', async () => {
    const jeton = await jetonAl();
    await doldur(jeton, [[{ id: 'fistik', birim: 'dilim', miktar: 5 }]]);
    const ay = brusselsDateSimdi();
    const d = await (await worker.fetch(raporOku(`?month=${ay}`, jeton), env)).json();
    expect(Object.keys(d.gunler)).toHaveLength(1);
  });

  it('bin anahtardan fazlasinda sayfalamayi surdurur', async () => {
    /* KV list() bir cagrida en fazla 1000 anahtar doner. Imlec dongusu
       kirilirsa rapor sessizce eksik cikardi -- en tehlikeli hata bicimi. */
    const jeton = await jetonAl();
    for (let i = 0; i < 1400; i++) {
      await env.STOK.put(
        `sale:2026-07-15:${1000000000000 + i}-x${i}`,
        JSON.stringify({ tarih: '2026-07-15', satirlar: [] }),
        { metadata: { s: [['fistik', 'dilim', 1]] } }
      );
    }
    const d = await (await worker.fetch(raporOku('?month=2026-07', jeton), env)).json();
    expect(d.siparis).toBe(1400);
    expect(d.toplam.fistik.dilim).toBe(1400);
  });

  it('aylik trend araligi doner', async () => {
    const jeton = await jetonAl();
    const d = await (await worker.fetch(raporOku('?from=2026-06&to=2026-08', jeton), env)).json();
    expect(d.aylar.map(a => a.ay)).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(d.aylar[0].gunler).toBeUndefined();   /* trendde gun kirilimi yok */
  });

  it('ters araligi reddeder', async () => {
    const jeton = await jetonAl();
    const r = await worker.fetch(raporOku('?from=2026-08&to=2026-06', jeton), env);
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('gecersiz_aralik');
  });

  it('trendde ayi ayirir', async () => {
    const jeton = await jetonAl();
    await env.STOK.put('sale:2026-06-10:1-a',
      JSON.stringify({}), { metadata: { s: [['fistik', 'dilim', 4]] } });
    await env.STOK.put('sale:2026-07-10:1-b',
      JSON.stringify({}), { metadata: { s: [['fistik', 'dilim', 9]] } });
    const d = await (await worker.fetch(raporOku('?from=2026-06&to=2026-07', jeton), env)).json();
    expect(d.aylar[0].toplam.fistik.dilim).toBe(4);
    expect(d.aylar[1].toplam.fistik.dilim).toBe(9);
  });
});

describe('bilinmeyen yol', () => {
  it('404 doner', async () => {
    expect((await worker.fetch(istek('/olmayan'), env)).status).toBe(404);
  });
});
