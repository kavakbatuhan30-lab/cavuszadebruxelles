import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src/index.js';
import { hashPassword } from '../src/auth.js';

const TUZ = 'dGVzdC1zYWx0LTEyMzQ1Ng==';
const JETON_ANAHTARI = 'test-jeton-anahtari';
const SIFRE = 'baklava123';

/* Bellekte KV taklidi -- gercek KV'nin kullandigimiz uc metodunu tasir. */
function sahteKV(baslangic = {}) {
  const depo = new Map(Object.entries(baslangic));
  return {
    async get(k, tip) {
      const v = depo.get(k);
      if (v === undefined) return null;
      return tip === 'json' ? JSON.parse(v) : v;
    },
    async put(k, v, opts) { depo.set(k, v); if (opts) depo.set(k + ':ttl', opts.expirationTtl); },
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

describe('bilinmeyen yol', () => {
  it('404 doner', async () => {
    expect((await worker.fetch(istek('/olmayan'), env)).status).toBe(404);
  });
});
