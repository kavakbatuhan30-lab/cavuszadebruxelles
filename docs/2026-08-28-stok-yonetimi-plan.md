# Stok Yönetimi — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dükkân sahibi bir ürünü panelden kapattığında, menüyü yeni açan müşteri o ürünü "tükendi" olarak görsün.

**Architecture:** Cloudflare Worker, KV'de tek bir küçük kayıt tutar (`{date, out[], updatedAt}`). Menü sayfa açılışında bu kaydı çeker; ulaşamazsa her şeyi "var" gösterir. Günlük sıfırlama zamanlayıcıyla değil, kayıttaki Brüksel takvim gününü bugünle karşılaştırarak yapılır.

**Tech Stack:** Cloudflare Workers (ES modules), Workers KV, vitest (Worker birim testleri), düz HTML/CSS/JS (menü ve panel — derleme adımı yok).

**Spec:** `docs/2026-08-28-stok-yonetimi-design.md`

## Global Constraints

- Menü ve panel **derleme adımı olmadan** çalışmalı — repo düz statik site, `package.json` yalnızca `worker/` içinde olacak.
- Worker'da **ürün listesi tutulmaz**. Kimlikler yalnızca `^[a-z0-9-]{1,32}$` kalıbına göre doğrulanır, `out` listesi en fazla 100 öğe.
- Menü, stok servisine ulaşamazsa **her ürünü "var" gösterir** (fail-open). Stok yüzünden menü asla bozulmaz.
- Şifre Worker'da düz metin tutulmaz: PBKDF2-SHA256 özeti + tuz, ayrı gizli değerler olarak.
- Tüm karşılaştırmalar (şifre özeti, jeton imzası) sabit zamanlı.
- Günün tarihi her zaman `Europe/Brussels` saat diliminde, `YYYY-MM-DD` biçiminde.
- Yazma yolunda **önce tarih sıfırlaması, sonra değişiklik** uygulanır.
- Kod yorumları ve kullanıcıya görünen metinler Türkçe; menüdeki rozet dört dilde.

---

### Task 1: Worker projesi ve tarih sıfırlama mantığı

Sıfırlama mantığı sistemin en sinsi parçası: yanlış olursa yılda iki kez bir saat kayar veya dünkü tükenmiş ürünler bugüne taşınır. Önce bunu tek başına test edilebilir saf fonksiyonlar olarak yazıyoruz.

**Files:**
- Create: `worker/package.json`
- Create: `worker/wrangler.toml`
- Create: `worker/src/stock.js`
- Test: `worker/test/stock.test.js`

**Interfaces:**
- Consumes: (yok — ilk görev)
- Produces:
  - `brusselsDate(now: Date) -> string` — `"YYYY-MM-DD"`
  - `normalizeRecord(record: object|null, today: string) -> {date, out: string[], updatedAt: string|null}`
  - `applyToggle(record: object, id: string, inStock: boolean, nowIso: string) -> {date, out, updatedAt}`
  - `isValidId(id: unknown) -> boolean`
  - `MAX_OUT: number` (100)

- [ ] **Step 1: Proje dosyalarını oluştur**

`worker/package.json`:

```json
{
  "name": "cavuszade-stok",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "vitest": "^2.1.8",
    "wrangler": "^3.99.0"
  }
}
```

`worker/wrangler.toml`:

```toml
name = "cavuszade-stok"
main = "src/index.js"
compatibility_date = "2026-08-01"

[[kv_namespaces]]
binding = "STOK"
id = "yerel-gelistirmede-wrangler-otomatik-olusturur"
```

- [ ] **Step 2: Bağımlılıkları kur**

```bash
cd worker && npm install
```

- [ ] **Step 3: Başarısız testleri yaz**

`worker/test/stock.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { brusselsDate, normalizeRecord, applyToggle, isValidId, MAX_OUT } from '../src/stock.js';

describe('brusselsDate', () => {
  it('yaz saatinde UTC+2 uygular', () => {
    // 15 Temmuz 23:30 UTC -> Brükselde 16 Temmuz 01:30
    expect(brusselsDate(new Date('2026-07-15T23:30:00Z'))).toBe('2026-07-16');
  });

  it('kis saatinde UTC+1 uygular', () => {
    // 15 Ocak 23:30 UTC -> Brükselde 16 Ocak 00:30
    expect(brusselsDate(new Date('2026-01-15T23:30:00Z'))).toBe('2026-01-16');
  });

  it('gun donmeden ayni gunu verir', () => {
    // 15 Ocak 22:30 UTC -> Brükselde 23:30, hala 15 Ocak
    expect(brusselsDate(new Date('2026-01-15T22:30:00Z'))).toBe('2026-01-15');
  });
});

describe('normalizeRecord', () => {
  it('dunku kaydi bosaltir', () => {
    const eski = { date: '2026-08-27', out: ['sarma'], updatedAt: '2026-08-27T18:00:00Z' };
    expect(normalizeRecord(eski, '2026-08-28')).toEqual({
      date: '2026-08-28', out: [], updatedAt: null
    });
  });

  it('bugunku kaydi korur', () => {
    const bugun = { date: '2026-08-28', out: ['sarma'], updatedAt: '2026-08-28T13:00:00Z' };
    expect(normalizeRecord(bugun, '2026-08-28')).toEqual(bugun);
  });

  it('kayit yoksa bos kayit uretir', () => {
    expect(normalizeRecord(null, '2026-08-28')).toEqual({
      date: '2026-08-28', out: [], updatedAt: null
    });
  });

  it('bozuk kayitta out alanini bos diziye cevirir', () => {
    const bozuk = { date: '2026-08-28' };
    expect(normalizeRecord(bozuk, '2026-08-28').out).toEqual([]);
  });
});

describe('applyToggle', () => {
  const kayit = { date: '2026-08-28', out: [], updatedAt: null };

  it('urunu tukendi yapar', () => {
    const s = applyToggle(kayit, 'sarma', false, '2026-08-28T14:00:00Z');
    expect(s.out).toEqual(['sarma']);
    expect(s.updatedAt).toBe('2026-08-28T14:00:00Z');
  });

  it('urunu geri acar', () => {
    const dolu = { date: '2026-08-28', out: ['sarma', 'ceviz'], updatedAt: null };
    expect(applyToggle(dolu, 'sarma', true, '2026-08-28T14:00:00Z').out).toEqual(['ceviz']);
  });

  it('ayni urunu iki kez kapatmak listeyi bozmaz', () => {
    let s = applyToggle(kayit, 'sarma', false, '2026-08-28T14:00:00Z');
    s = applyToggle(s, 'sarma', false, '2026-08-28T14:01:00Z');
    expect(s.out).toEqual(['sarma']);
  });

  it('listeyi sirali tutar', () => {
    let s = applyToggle(kayit, 'sarma', false, 'x');
    s = applyToggle(s, 'bohca', false, 'x');
    expect(s.out).toEqual(['bohca', 'sarma']);
  });
});

describe('isValidId', () => {
  it('gecerli kimlikleri kabul eder', () => {
    expect(isValidId('sarma')).toBe(true);
    expect(isValidId('havuc-dilim')).toBe(true);
  });

  it('gecersizleri reddeder', () => {
    expect(isValidId('Sarma')).toBe(false);       // buyuk harf
    expect(isValidId('sarma!')).toBe(false);      // isaret
    expect(isValidId('')).toBe(false);
    expect(isValidId('a'.repeat(33))).toBe(false);
    expect(isValidId(42)).toBe(false);
    expect(isValidId(null)).toBe(false);
  });
});

describe('MAX_OUT', () => {
  it('100 olarak tanimli', () => {
    expect(MAX_OUT).toBe(100);
  });
});
```

- [ ] **Step 4: Testleri çalıştır, başarısız olduklarını gör**

```bash
cd worker && npm test
```

Beklenen: `Failed to resolve import "../src/stock.js"` — dosya henüz yok.

- [ ] **Step 5: En küçük uygulamayı yaz**

`worker/src/stock.js`:

```js
/* Stok kaydinin saf mantigi. HTTP ve KV bilmez, bu yuzden tek basina
   test edilebilir. */

export const MAX_OUT = 100;

const ID_RE = /^[a-z0-9-]{1,32}$/;

/* Brukseldeki takvim gunu, YYYY-MM-DD.

   Neden Intl: Cloudflarein zamanlayicisi UTC calisir, Bruksel yazin UTC+2
   kisin UTC+1. Sabit saatli bir kurulum yilda iki kez bir saat kayardi.
   'en-CA' yerel biciminin ciktisi zaten YYYY-MM-DD oldugu icin ayrica
   parcalamak gerekmiyor. */
export function brusselsDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
}

/* Kaydi bugune gore normallestirir. Kayit dunden kalmissa liste bosalir --
   gunluk sifirlama tam olarak burada olur, zamanlayici yok. */
export function normalizeRecord(record, today) {
  if (!record || record.date !== today) {
    return { date: today, out: [], updatedAt: null };
  }
  return {
    date: record.date,
    out: Array.isArray(record.out) ? record.out : [],
    updatedAt: record.updatedAt ?? null
  };
}

/* Tek bir urunun durumunu degistirir. Cagiran taraf kaydi ONCE
   normalizeRecord'dan gecirmis olmali. */
export function applyToggle(record, id, inStock, nowIso) {
  const out = new Set(record.out);
  if (inStock) out.delete(id);
  else out.add(id);
  return {
    date: record.date,
    out: [...out].sort(),
    updatedAt: nowIso
  };
}

export function isValidId(id) {
  return typeof id === 'string' && ID_RE.test(id);
}
```

- [ ] **Step 6: Testleri çalıştır, geçtiklerini gör**

```bash
cd worker && npm test
```

Beklenen: 13 test PASS.

- [ ] **Step 7: Commit**

```bash
git add worker/package.json worker/wrangler.toml worker/src/stock.js worker/test/stock.test.js worker/package-lock.json
git commit -m "feat(worker): stock record logic with DST-safe daily reset"
```

---

### Task 2: Şifre doğrulama ve oturum jetonu

**Files:**
- Create: `worker/src/auth.js`
- Test: `worker/test/auth.test.js`

**Interfaces:**
- Consumes: (Task 1'den bağımsız)
- Produces:
  - `hashPassword(password: string, saltB64: string) -> Promise<string>` (base64)
  - `verifyPassword(password: string, saltB64: string, expectedHashB64: string) -> Promise<boolean>`
  - `signToken(expMs: number, secret: string) -> Promise<string>`
  - `verifyToken(token: unknown, secret: string, nowMs: number) -> Promise<boolean>`
  - `timingSafeEqual(a: string, b: string) -> boolean`

- [ ] **Step 1: Başarısız testleri yaz**

`worker/test/auth.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  hashPassword, verifyPassword, signToken, verifyToken, timingSafeEqual
} from '../src/auth.js';

const TUZ = 'dGVzdC1zYWx0LTEyMzQ1Ng==';
const GIZLI = 'test-imza-anahtari';

describe('timingSafeEqual', () => {
  it('ayni dizeler icin dogru', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
  });
  it('farkli dizeler icin yanlis', () => {
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
  });
  it('farkli uzunlukta yanlis', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('sifre', () => {
  it('dogru sifreyi kabul eder', async () => {
    const ozet = await hashPassword('baklava123', TUZ);
    expect(await verifyPassword('baklava123', TUZ, ozet)).toBe(true);
  });

  it('yanlis sifreyi reddeder', async () => {
    const ozet = await hashPassword('baklava123', TUZ);
    expect(await verifyPassword('baklava124', TUZ, ozet)).toBe(false);
  });

  it('ozet duz metni icermez', async () => {
    const ozet = await hashPassword('baklava123', TUZ);
    expect(ozet).not.toContain('baklava');
  });

  it('ayni sifre ayni tuzla ayni ozeti verir', async () => {
    expect(await hashPassword('a', TUZ)).toBe(await hashPassword('a', TUZ));
  });
});

describe('jeton', () => {
  const SIMDI = 1_800_000_000_000;
  const YARIN = SIMDI + 86_400_000;

  it('imzaladigi jetonu dogrular', async () => {
    const j = await signToken(YARIN, GIZLI);
    expect(await verifyToken(j, GIZLI, SIMDI)).toBe(true);
  });

  it('suresi gecmis jetonu reddeder', async () => {
    const j = await signToken(SIMDI - 1000, GIZLI);
    expect(await verifyToken(j, GIZLI, SIMDI)).toBe(false);
  });

  it('kurcalanmis govdeyi reddeder', async () => {
    const j = await signToken(YARIN, GIZLI);
    const [, imza] = j.split('.');
    const sahte = btoa(JSON.stringify({ exp: YARIN + 999 })).replace(/=+$/, '');
    expect(await verifyToken(`${sahte}.${imza}`, GIZLI, SIMDI)).toBe(false);
  });

  it('baska anahtarla imzalanmis jetonu reddeder', async () => {
    const j = await signToken(YARIN, 'baska-anahtar');
    expect(await verifyToken(j, GIZLI, SIMDI)).toBe(false);
  });

  it('bozuk girdileri reddeder', async () => {
    expect(await verifyToken('', GIZLI, SIMDI)).toBe(false);
    expect(await verifyToken('noktasiz', GIZLI, SIMDI)).toBe(false);
    expect(await verifyToken(null, GIZLI, SIMDI)).toBe(false);
    expect(await verifyToken('a.b.c', GIZLI, SIMDI)).toBe(false);
  });
});
```

- [ ] **Step 2: Testleri çalıştır, başarısız olduklarını gör**

```bash
cd worker && npm test
```

Beklenen: `Failed to resolve import "../src/auth.js"`.

- [ ] **Step 3: Uygulamayı yaz**

`worker/src/auth.js`:

```js
/* Sifre dogrulama ve oturum jetonu.

   Sunucuda oturum saklanmaz: jetonun kendisi imzalidir ve icinde son
   kullanma zamani vardir. Tek dukkanda tek ortak sifre oldugu icin bu
   yeterli. Satis verisi panele girdiginde bu dosya yeniden ele alinmali --
   o noktada hazir bir kimlik saglayici dogru tercih olur. */

const ITERATIONS = 100_000;

function b64ToBytes(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

function bytesToB64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/* Sabit zamanli karsilastirma: erken cikis, saldirgana dogru karakter
   sayisini sizdirir. */
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let fark = 0;
  for (let i = 0; i < a.length; i++) fark |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return fark === 0;
}

export async function hashPassword(password, saltB64) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: b64ToBytes(saltB64), iterations: ITERATIONS, hash: 'SHA-256' },
    key, 256
  );
  return bytesToB64(new Uint8Array(bits));
}

export async function verifyPassword(password, saltB64, expectedHashB64) {
  const ozet = await hashPassword(password, saltB64);
  return timingSafeEqual(ozet, expectedHashB64);
}

async function hmac(message, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return bytesToB64(new Uint8Array(sig)).replace(/=+$/, '');
}

/* Govde yalnizca {exp:<sayi>} icerir -- ASCII, btoa guvenli. */
export async function signToken(expMs, secret) {
  const govde = btoa(JSON.stringify({ exp: expMs })).replace(/=+$/, '');
  return `${govde}.${await hmac(govde, secret)}`;
}

export async function verifyToken(token, secret, nowMs) {
  if (typeof token !== 'string') return false;
  const parcalar = token.split('.');
  if (parcalar.length !== 2) return false;
  const [govde, imza] = parcalar;
  if (!govde || !imza) return false;

  if (!timingSafeEqual(imza, await hmac(govde, secret))) return false;

  let yuk;
  try { yuk = JSON.parse(atob(govde)); } catch { return false; }
  return typeof yuk?.exp === 'number' && yuk.exp > nowMs;
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiklerini gör**

```bash
cd worker && npm test
```

Beklenen: Task 1'in 13 testi + bu dosyanın 12 testi, toplam 25 PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/src/auth.js worker/test/auth.test.js
git commit -m "feat(worker): password hashing and signed session tokens"
```

---

### Task 3: Worker uç noktaları

**Files:**
- Create: `worker/src/index.js`
- Test: `worker/test/index.test.js`

**Interfaces:**
- Consumes: `stock.js` ve `auth.js`'in tamamı (Task 1, 2)
- Produces: `export default { fetch(request, env) }` — üç uç nokta: `GET /api/stock`, `POST /api/login`, `POST /api/stock`

**Env değişkenleri:** `STOK` (KV binding), `SIFRE_OZETI`, `SIFRE_TUZU`, `JETON_ANAHTARI` (gizli değerler), `IZINLI_KAYNAK` (varsayılan `https://cavuszadebruxelles.com`)

- [ ] **Step 1: Başarısız testleri yaz**

`worker/test/index.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src/index.js';
import { hashPassword, signToken } from '../src/auth.js';

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
    async put(k, v) { depo.set(k, v); },
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

describe('bilinmeyen yol', () => {
  it('404 doner', async () => {
    expect((await worker.fetch(istek('/olmayan'), env)).status).toBe(404);
  });
});
```

- [ ] **Step 2: Testleri çalıştır, başarısız olduklarını gör**

```bash
cd worker && npm test
```

Beklenen: `Failed to resolve import "../src/index.js"`.

- [ ] **Step 3: Uygulamayı yaz**

`worker/src/index.js`:

```js
import { brusselsDate, normalizeRecord, applyToggle, isValidId, MAX_OUT } from './stock.js';
import { verifyPassword, signToken, verifyToken } from './auth.js';

const ANAHTAR = 'shop:cavuszade:stock';   /* onek ileriye donuk: ikinci dukkan yeni anahtar */
const JETON_OMRU_MS = 90 * 24 * 60 * 60 * 1000;

const json = (govde, durum = 200, ekBaslik = {}) =>
  new Response(JSON.stringify(govde), {
    status: durum,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...ekBaslik
    }
  });

function corsBasliklari(env) {
  return {
    'Access-Control-Allow-Origin': env.IZINLI_KAYNAK ?? 'https://cavuszadebruxelles.com',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

/* Kaynak kisiti yalnizca tarayiciyi baglar; tarayici disi istemciyi
   engellemez. Asil koruma jetondur, bu ikinci savunma hatti. */
function kaynakUygun(request, env) {
  const izinli = env.IZINLI_KAYNAK ?? 'https://cavuszadebruxelles.com';
  return request.headers.get('Origin') === izinli;
}

async function kayitOku(env, bugun) {
  return normalizeRecord(await env.STOK.get(ANAHTAR, 'json'), bugun);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsBasliklari(env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === '/api/stock' && request.method === 'GET') {
      const kayit = await kayitOku(env, brusselsDate());
      return json(kayit, 200, cors);
    }

    if (url.pathname === '/api/login' && request.method === 'POST') {
      if (!kaynakUygun(request, env)) return json({ error: 'forbidden_origin' }, 403, cors);

      let govde;
      try { govde = await request.json(); } catch { return json({ error: 'bad_json' }, 400, cors); }

      const dogru = typeof govde?.password === 'string' &&
        await verifyPassword(govde.password, env.SIFRE_TUZU, env.SIFRE_OZETI);
      if (!dogru) return json({ error: 'invalid_password' }, 401, cors);

      const exp = Date.now() + JETON_OMRU_MS;
      return json({
        token: await signToken(exp, env.JETON_ANAHTARI),
        expiresAt: new Date(exp).toISOString()
      }, 200, cors);
    }

    if (url.pathname === '/api/stock' && request.method === 'POST') {
      if (!kaynakUygun(request, env)) return json({ error: 'forbidden_origin' }, 403, cors);

      const yetki = request.headers.get('Authorization') ?? '';
      const jeton = yetki.startsWith('Bearer ') ? yetki.slice(7) : null;
      if (!await verifyToken(jeton, env.JETON_ANAHTARI, Date.now())) {
        return json({ error: 'invalid_token' }, 401, cors);
      }

      let govde;
      try { govde = await request.json(); } catch { return json({ error: 'bad_json' }, 400, cors); }
      if (!isValidId(govde?.id) || typeof govde?.inStock !== 'boolean') {
        return json({ error: 'invalid_id' }, 400, cors);
      }

      /* ONCE sifirlama, SONRA degisiklik. Ters sirada dunun tukenmis
         urunleri bugune tasinir ve bu ekranda hemen gorunmez. */
      const bugun = brusselsDate();
      const mevcut = await kayitOku(env, bugun);

      if (!govde.inStock && !mevcut.out.includes(govde.id) && mevcut.out.length >= MAX_OUT) {
        return json({ error: 'too_many_items' }, 400, cors);
      }

      const yeni = applyToggle(mevcut, govde.id, govde.inStock, new Date().toISOString());
      await env.STOK.put(ANAHTAR, JSON.stringify(yeni));
      return json(yeni, 200, cors);
    }

    return json({ error: 'not_found' }, 404, cors);
  }
};
```

- [ ] **Step 4: Testleri çalıştır, geçtiklerini gör**

```bash
cd worker && npm test
```

Beklenen: toplam 38 test PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/src/index.js worker/test/index.test.js
git commit -m "feat(worker): stock read/write endpoints with token auth"
```

---

### Task 4: Menü tarafı — rozet ve fail-open stok çekme

**Files:**
- Modify: `menu/index.html` (I18N, CSS, render, stok çekme)

**Interfaces:**
- Consumes: `GET /api/stock` → `{date, out: string[], updatedAt}`
- Produces: `.card.out` / `.drink.out` sınıfları; `data-id` artık içecek satırlarında da var

- [ ] **Step 1: Dört dile rozet metnini ekle**

`menu/index.html` içinde `I18N` nesnesinde her dilin `closed` satırından sonra bir alan ekle:

```js
  tr:{ ... closed:'Kapalı', soldOut:'Tükendi',
```
```js
  fr:{ ... closed:'Fermé', soldOut:'Épuisé',
```
```js
  nl:{ ... closed:'Gesloten', soldOut:'Uitverkocht',
```
```js
  en:{ ... closed:'Closed', soldOut:'Sold out',
```

- [ ] **Step 2: CSS ekle**

`.card .price small{...}` kuralından sonra:

```css
  /* ---------- Tukendi ----------
     Rozet her zaman DOM'da; yalnizca .out sinifi varken gorunur. Boylece
     stok bilgisi gelince yeniden render etmek gerekmiyor -- sadece sinif
     degisiyor, kart animasyonlari bastan baslamiyor.
     Kart tiklanabilir kaliyor: musteri urunu yine de gorebilmeli. */
  .soldout{display:none}
  .card.out img{filter:grayscale(.7); opacity:.42; transform:none}
  .card.out .price{opacity:.38; text-decoration:line-through}
  .card.out .soldout{
    display:inline-block; position:absolute; top:10px; left:50%;
    transform:translateX(-50%); z-index:2;
    background:rgba(59,30,8,.9); color:var(--cream);
    font-family:'Lato',sans-serif; font-size:9.5px; font-weight:700;
    letter-spacing:.14em; text-transform:uppercase;
    padding:5px 11px; border-radius:2px; white-space:nowrap;
  }
  .drink.out .dn, .drink.out .dp{opacity:.42}
  .drink.out .dp{text-decoration:line-through}
  .drink.out .soldout{
    display:inline-block; margin-left:7px;
    font-size:9px; font-weight:700; letter-spacing:.1em;
    text-transform:uppercase; color:var(--brown-mid); opacity:.75;
  }
```

- [ ] **Step 3: Rozeti işaretlemeye ekle ve içeceklere `data-id` ver**

`renderMenu()` içinde baklava kartı (`menu/index.html:1039` civarı) — `imgwrap` satırını değiştir:

```js
      <div class="imgwrap"><img src="${p.img}" alt="${esc(p.name)}" ${i < 4 ? '' : 'loading="lazy"'} decoding="async"><span class="soldout">${esc(t.soldOut)}</span></div>
```

İçecek satırı (`menu/index.html:1056` civarı) — `data-id` ve rozet ekle:

```js
    <div class="drink" data-id="${p.id}">
      <span class="dn">${esc(p.name)}<span class="soldout">${esc(t.soldOut)}</span></span>
      <span class="dots"></span>
      <span class="dp">${priceHtml(p)}</span>
      <span class="dd">${esc(p.desc[lang])}</span>
    </div>
```

- [ ] **Step 4: Stok çekmeyi ekle**

`renderMenu()` fonksiyonunun hemen üstüne:

```js
/* ---------- Stok ----------
   Gelistirme sirasinda yerel Worker; Task 7'de gercek adresle degistirilir. */
const STOCK_API = 'http://127.0.0.1:8787/api/stock';

let OUT_OF_STOCK = new Set();

/* Sinif degistirir, yeniden render etmez: kart giris animasyonlari
   bastan baslamasin. */
function applyStock(){
  document.querySelectorAll('#gridBaklava .card').forEach(c =>
    c.classList.toggle('out', OUT_OF_STOCK.has(c.dataset.id)));
  document.querySelectorAll('#listDrink .drink').forEach(d =>
    d.classList.toggle('out', OUT_OF_STOCK.has(d.dataset.id)));
}

/* Servise ulasilamazsa hicbir sey yapmaz -- her urun "var" kalir.
   Gerekce: yanlis "tukendi" gostermek, yanlis "var" gostermekten pahali.
   Musteri siparis vermez ve patron bunu fark etmez. */
async function fetchStock(){
  const ctl = new AbortController();
  const zamanAsimi = setTimeout(() => ctl.abort(), 2000);
  try{
    const r = await fetch(STOCK_API, { signal: ctl.signal, cache: 'no-store' });
    if(!r.ok) return;
    const d = await r.json();
    if(!Array.isArray(d.out)) return;
    OUT_OF_STOCK = new Set(d.out);
    applyStock();
  }catch(e){
    /* Aga ulasilamadi veya zaman asti: menu normal calismaya devam eder. */
  }finally{
    clearTimeout(zamanAsimi);
  }
}
```

- [ ] **Step 5: Render ve görünürlük bağlantılarını kur**

`renderMenu()` fonksiyonunun sonunda, `$('yr').textContent = ...` satırından hemen önce:

```js
  applyStock();   /* dil degisiminde yeniden render sonrasi durumu koru */
```

`startRing();` çağrısının bulunduğu başlatma bölümüne (`menu/index.html:1201` civarı) ekle:

```js
  fetchStock();
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible') fetchStock();
  });
```

- [ ] **Step 6: Worker'ı yerelde başlat ve tarayıcıda doğrula**

```bash
cd worker && npx wrangler dev
```

Ayrı bir kabukta menüyü servis et ve tarayıcıda aç. Sırayla doğrula:

1. Menü normal açılıyor, hiçbir ürün tükendi görünmüyor
2. `curl` ile bir ürünü kapat, sayfayı yenile → o ürün soluk ve rozetli
3. Dili değiştir → rozet o dilde
4. **Worker'ı durdur, sayfayı yenile → menü normal açılıyor, her şey "var"** (fail-open)
5. Sekmeyi arka plana al, ürünü değiştir, sekmeye dön → liste tazeleniyor

- [ ] **Step 7: Commit**

```bash
git add menu/index.html
git commit -m "feat(menu): show sold-out badge, fail open when stock service is down"
```

---

### Task 5: Yönetim paneli

**Files:**
- Create: `admin/index.html`
- Modify: `robots.txt`

**Interfaces:**
- Consumes: `POST /api/login`, `POST /api/stock`, `GET /api/stock`
- Produces: (son kullanıcı arayüzü — başka görev tüketmez)

- [ ] **Step 1: `robots.txt`'e paneli kapat**

`Disallow: /tmp/` satırından sonra:

```
Disallow: /admin/
```

- [ ] **Step 2: Paneli oluştur**

`admin/index.html` — ürün listesi menüdeki `PRODUCTS` kimlikleriyle eşleşir:

```html
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Çavuşzade — Stok</title>
<style>
  *{box-sizing:border-box; margin:0; padding:0}
  body{
    font-family:system-ui, -apple-system, sans-serif;
    background:#F0E8D7; color:#3B1E08;
    padding:20px; max-width:520px; margin:0 auto;
  }
  h1{font-size:19px; margin-bottom:4px}
  .alt{font-size:13px; opacity:.65; margin-bottom:20px}
  .satir{
    display:flex; align-items:center; justify-content:space-between;
    background:#fff; border-radius:9px; padding:13px 15px; margin-bottom:9px;
  }
  .satir.kapali{opacity:.55}
  .ad{font-size:15px}
  button{
    font:inherit; font-size:13px; font-weight:600; cursor:pointer;
    border:0; border-radius:7px; padding:9px 15px; min-width:96px;
  }
  .var{background:#2E7D32; color:#fff}
  .yok{background:#B71C1C; color:#fff}
  button:disabled{opacity:.5; cursor:wait}
  input{
    font:inherit; width:100%; padding:12px;
    border:1px solid #C9A84C; border-radius:8px; margin-bottom:10px;
  }
  .hata{color:#B71C1C; font-size:13px; margin-top:10px; min-height:18px}
  .durum{font-size:12px; opacity:.6; margin-top:16px}
  .gizli{display:none}
</style>
</head>
<body>

<div id="girisEkrani">
  <h1>Stok yönetimi</h1>
  <p class="alt">Devam etmek için şifreyi gir.</p>
  <input type="password" id="sifre" placeholder="Şifre" autocomplete="current-password">
  <button class="var" id="girisBtn" style="width:100%">Giriş</button>
  <div class="hata" id="girisHata"></div>
</div>

<div id="panel" class="gizli">
  <h1>Stok yönetimi</h1>
  <p class="alt">Tükenen ürünü kapat — menüde anında görünür.</p>
  <div id="liste"></div>
  <div class="durum" id="durum"></div>
</div>

<script>
/* Gelistirme sirasinda yerel Worker; Task 7'de gercek adresle degistirilir. */
const API = 'http://127.0.0.1:8787';

/* Menudeki PRODUCTS kimlikleriyle birebir ayni olmali. */
const URUNLER = [
  { id:'fistik',       ad:'Fıstıklı Baklava' },
  { id:'sarma',        ad:'Fıstık Sarma' },
  { id:'havucdilim',   ad:'Havuç Dilim' },
  { id:'bohca',        ad:'Fıstıklı Bohça' },
  { id:'sobiyet',      ad:'Şöbiyet' },
  { id:'sogukbaklava', ad:'Soğuk Baklava' },
  { id:'kadayif',      ad:'Fıstıklı Kadayıf' },
  { id:'ceviz',        ad:'Cevizli Baklava' },
  { id:'su',           ad:'Su' },
  { id:'soda',         ad:'Meyveli Soda' }
];

const $ = id => document.getElementById(id);
let jeton = localStorage.getItem('stokJetonu');
let tukenenler = new Set();

async function girisYap(){
  const btn = $('girisBtn');
  btn.disabled = true;
  $('girisHata').textContent = '';
  try{
    const r = await fetch(API + '/api/login', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ password: $('sifre').value })
    });
    if(!r.ok){
      $('girisHata').textContent = r.status === 401 ? 'Şifre yanlış.' : 'Giriş yapılamadı.';
      return;
    }
    jeton = (await r.json()).token;
    localStorage.setItem('stokJetonu', jeton);
    $('sifre').value = '';
    await panelAc();
  }catch(e){
    $('girisHata').textContent = 'Servise ulaşılamadı.';
  }finally{
    btn.disabled = false;
  }
}

async function panelAc(){
  $('girisEkrani').classList.add('gizli');
  $('panel').classList.remove('gizli');
  await durumYukle();
}

async function durumYukle(){
  try{
    const d = await (await fetch(API + '/api/stock', { cache:'no-store' })).json();
    tukenenler = new Set(d.out);
    $('durum').textContent = d.updatedAt
      ? 'Son değişiklik: ' + new Date(d.updatedAt).toLocaleString('tr-TR')
      : 'Bugün henüz değişiklik yok.';
  }catch(e){
    $('durum').textContent = 'Durum okunamadı.';
  }
  ciz();
}

function ciz(){
  $('liste').innerHTML = URUNLER.map(u => {
    const kapali = tukenenler.has(u.id);
    return `<div class="satir ${kapali ? 'kapali' : ''}">
      <span class="ad">${u.ad}</span>
      <button class="${kapali ? 'yok' : 'var'}" data-id="${u.id}">
        ${kapali ? 'Tükendi' : 'Var'}
      </button>
    </div>`;
  }).join('');

  $('liste').querySelectorAll('button').forEach(b =>
    b.addEventListener('click', () => degistir(b.dataset.id, b)));
}

async function degistir(id, btn){
  /* Su an tukenmis mi? Degilse bu tiklama onu tuketiyor demektir. */
  const suAnTukenmis = tukenenler.has(id);
  const yeniStokDurumu = suAnTukenmis;   /* tukenmisse -> var yap, varsa -> tukendi yap */
  btn.disabled = true;
  try{
    const r = await fetch(API + '/api/stock', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer ' + jeton
      },
      body: JSON.stringify({ id, inStock: yeniStokDurumu })
    });
    if(r.status === 401){
      /* Jeton suresi dolmus veya gecersiz: sifre ekranina don. */
      localStorage.removeItem('stokJetonu');
      jeton = null;
      $('panel').classList.add('gizli');
      $('girisEkrani').classList.remove('gizli');
      $('girisHata').textContent = 'Oturum süresi doldu, tekrar gir.';
      return;
    }
    if(!r.ok) throw new Error('yazilamadi');
    const d = await r.json();
    tukenenler = new Set(d.out);
    $('durum').textContent = 'Son değişiklik: ' + new Date(d.updatedAt).toLocaleString('tr-TR');
    ciz();
  }catch(e){
    $('durum').textContent = 'Değişiklik kaydedilemedi, tekrar dene.';
    ciz();   /* eski haline don */
  }
}

$('girisBtn').addEventListener('click', girisYap);
$('sifre').addEventListener('keydown', e => { if(e.key === 'Enter') girisYap(); });

if(jeton) panelAc();
</script>
</body>
</html>
```

- [ ] **Step 3: Tarayıcıda doğrula**

Worker yerelde çalışırken paneli aç ve sırayla doğrula:

1. Yanlış şifre → "Şifre yanlış." çıkıyor, panel açılmıyor
2. Doğru şifre → panel açılıyor, 10 ürün listeleniyor
3. Bir ürünü kapat → düğme kırmızıya dönüyor, "Son değişiklik" güncelleniyor
4. Menüyü yenile → o ürün tükendi görünüyor
5. Sayfayı yenile → şifre sorulmuyor (jeton saklanmış)
6. `localStorage.removeItem('stokJetonu')` → yenileyince şifre soruluyor
7. Worker'ı durdur, düğmeye bas → "Değişiklik kaydedilemedi" çıkıyor, düğme eski haline dönüyor

- [ ] **Step 4: Commit**

```bash
git add admin/index.html robots.txt
git commit -m "feat(admin): stock toggle panel behind shared password"
```

---

### Task 6: Giriş denemesi sınırı

Sınırsız şifre denemesi iki sorun doğurur: kaba kuvvet, ve her denemenin
PBKDF2 yüzünden ~100 ms CPU yakması (Worker'ın CPU bütçesine yönelik bir
saldırı yüzeyi).

**Files:**
- Modify: `worker/src/index.js`
- Modify: `worker/test/index.test.js`

**Interfaces:**
- Consumes: Task 3'ün `fetch` işleyicisi
- Produces: `/api/login` için 429 yanıtı; KV'de `rl:login:<ip>` sayaçları

- [ ] **Step 1: Başarısız testleri yaz**

`worker/test/index.test.js` içine, sahte KV'yi `expirationTtl` alacak şekilde
genişlet ve yeni bir bölüm ekle. Önce `sahteKV` içindeki `put` satırını
değiştir:

```js
    async put(k, v, opts) { depo.set(k, v); if (opts) depo.set(k + ':ttl', opts.expirationTtl); },
```

Dosyanın sonuna ekle:

```js
describe('giris denemesi siniri', () => {
  const yanlisGiris = () => worker.fetch(istek('/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://cavuszadebruxelles.com',
      'CF-Connecting-IP': '203.0.113.9'
    },
    body: JSON.stringify({ password: 'yanlis' })
  }), env);

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
    const r = await worker.fetch(istek('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://cavuszadebruxelles.com',
        'CF-Connecting-IP': '203.0.113.9'
      },
      body: JSON.stringify({ password: SIFRE })
    }), env);
    expect(r.status).toBe(429);
  });

  it('baska IP etkilenmez', async () => {
    for (let i = 0; i < 11; i++) await yanlisGiris();
    const r = await worker.fetch(istek('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://cavuszadebruxelles.com',
        'CF-Connecting-IP': '198.51.100.4'
      },
      body: JSON.stringify({ password: SIFRE })
    }), env);
    expect(r.status).toBe(200);
  });

  it('basarili giris sayaci sifirlar', async () => {
    for (let i = 0; i < 5; i++) await yanlisGiris();
    await worker.fetch(istek('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://cavuszadebruxelles.com',
        'CF-Connecting-IP': '203.0.113.9'
      },
      body: JSON.stringify({ password: SIFRE })
    }), env);
    for (let i = 0; i < 10; i++) {
      expect((await yanlisGiris()).status).toBe(401);
    }
  });
});
```

- [ ] **Step 2: Testleri çalıştır, başarısız olduklarını gör**

```bash
cd worker && npm test
```

Beklenen: yeni beş test FAIL (429 yerine 401 dönüyor).

- [ ] **Step 3: Uygulamayı yaz**

`worker/src/index.js` içinde sabitlerin yanına ekle:

```js
const GIRIS_SINIRI = 10;
const GIRIS_PENCERESI_SN = 15 * 60;
```

Ve yardımcı fonksiyonları ekle:

```js
/* IP basina giris denemesi sayaci.

   KV anlik tutarli degildir: es zamanli isteklerde sayac birkac deneme
   kacirabilir. Bu bir kesinlik araci degil, yavaslatici. Amac kaba kuvveti
   ve PBKDF2 uzerinden CPU tuketmeyi pahali hale getirmek. */
function girisAnahtari(request) {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'bilinmeyen';
  return `rl:login:${ip}`;
}

async function girisSayaci(env, anahtar) {
  const v = await env.STOK.get(anahtar);
  return v ? parseInt(v, 10) || 0 : 0;
}
```

`/api/login` bloğunun içini, `kaynakUygun` kontrolünden hemen sonra
başlayacak şekilde değiştir:

```js
      const rlAnahtar = girisAnahtari(request);
      const deneme = await girisSayaci(env, rlAnahtar);
      if (deneme >= GIRIS_SINIRI) {
        return json({ error: 'too_many_attempts' }, 429, cors);
      }

      let govde;
      try { govde = await request.json(); } catch { return json({ error: 'bad_json' }, 400, cors); }

      const dogru = typeof govde?.password === 'string' &&
        await verifyPassword(govde.password, env.SIFRE_TUZU, env.SIFRE_OZETI);

      if (!dogru) {
        await env.STOK.put(rlAnahtar, String(deneme + 1), { expirationTtl: GIRIS_PENCERESI_SN });
        return json({ error: 'invalid_password' }, 401, cors);
      }

      /* Basarili giris sayaci sifirlar: dogru sifreyi bilen kisi, once
         birkac kez yanlis yazdi diye kilitlenmemeli. */
      await env.STOK.put(rlAnahtar, '0', { expirationTtl: GIRIS_PENCERESI_SN });

      const exp = Date.now() + JETON_OMRU_MS;
      return json({
        token: await signToken(exp, env.JETON_ANAHTARI),
        expiresAt: new Date(exp).toISOString()
      }, 200, cors);
```

- [ ] **Step 4: Testleri çalıştır, geçtiklerini gör**

```bash
cd worker && npm test
```

Beklenen: toplam 43 test PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/src/index.js worker/test/index.test.js
git commit -m "feat(worker): rate limit login attempts per IP"
```

---

### Task 7: Yayına alma ve uçtan uca doğrulama

Bu görev **Cloudflare hesabı gerektirir**. Hesabı kullanıcı açar — hesap oluşturma işi kullanıcıya aittir. Şifre de kullanıcı tarafından belirlenir ve sohbete yazılmaz.

**Files:**
- Modify: `worker/wrangler.toml` (gerçek KV kimliği)
- Modify: `menu/index.html` (`STOCK_API` gerçek adres)
- Modify: `admin/index.html` (`API` gerçek adres)

**Interfaces:**
- Consumes: Task 1–6'in tamamı
- Produces: çalışan üretim dağıtımı

- [ ] **Step 1: Kullanıcı Cloudflare hesabı açar ve yetkilendirir**

Kullanıcının yapacağı:

```bash
cd worker && npx wrangler login
```

- [ ] **Step 2: KV alanı oluştur ve `wrangler.toml`'a yaz**

```bash
cd worker && npx wrangler kv namespace create STOK
```

Çıkan `id` değerini `wrangler.toml` içindeki yer tutucunun yerine yaz.

- [ ] **Step 3: Gizli değerleri koy**

Tuz ve jeton anahtarını üret:

```bash
node -e "console.log('TUZ:', require('crypto').randomBytes(16).toString('base64')); console.log('JETON:', require('crypto').randomBytes(32).toString('base64'))"
```

Şifre özetini üret — **şifreyi kullanıcı yazar, sohbete girmez**:

```bash
cd worker && node -e "
import('./src/auth.js').then(async m => {
  const readline = await import('node:readline/promises');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const sifre = await rl.question('Sifre: ');
  const tuz = await rl.question('Tuz (yukarida uretilen): ');
  console.log('OZET:', await m.hashPassword(sifre, tuz));
  rl.close();
})"
```

Üç değeri gizli olarak koy:

```bash
npx wrangler secret put SIFRE_TUZU
npx wrangler secret put SIFRE_OZETI
npx wrangler secret put JETON_ANAHTARI
```

- [ ] **Step 4: Dağıt**

```bash
cd worker && npx wrangler deploy
```

Çıktıdaki adresi not et (`https://cavuszade-stok.<hesap>.workers.dev`).

- [ ] **Step 5: Gerçek adresi menüye ve panele yaz**

`menu/index.html` içinde:

```js
const STOCK_API = 'https://cavuszade-stok.<hesap>.workers.dev/api/stock';
```

`admin/index.html` içinde:

```js
const API = 'https://cavuszade-stok.<hesap>.workers.dev';
```

- [ ] **Step 6: Yayına gönder ve uçtan uca doğrula**

```bash
git add menu/index.html admin/index.html worker/wrangler.toml
git commit -m "chore: point menu and admin at deployed stock worker"
git push
```

Pages dağıtımı bittikten sonra **gerçek adreste** sırayla doğrula:

1. `cavuszadebruxelles.com/admin/` açılıyor, şifre soruyor
2. Şifreyle girildikten sonra bir ürün kapatılıyor
3. **Başka bir cihazdan** `cavuszadebruxelles.com/menu/` açılıyor → ürün tükendi görünüyor
4. Ürün geri açılıyor → menü yenilenince normale dönüyor
5. `curl -s https://cavuszade-stok.<hesap>.workers.dev/api/stock` → geçerli JSON
6. Jetonsuz yazma denemesi 401 dönüyor:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -X POST \
     -H "Origin: https://cavuszadebruxelles.com" \
     -H "Content-Type: application/json" \
     -d '{"id":"sarma","inStock":false}' \
     https://cavuszade-stok.<hesap>.workers.dev/api/stock
   ```
7. `cavuszadebruxelles.com/robots.txt` içinde `Disallow: /admin/` görünüyor

- [ ] **Step 7: Gece sıfırlamasını doğrula**

Sıfırlamayı beklemeden sınamak için KV'ye dünkü tarihli bir kayıt yaz:

```bash
cd worker && npx wrangler kv key put --remote --binding STOK \
  "shop:cavuszade:stock" \
  '{"date":"2020-01-01","out":["sarma"],"updatedAt":"2020-01-01T00:00:00Z"}'
```

Ardından `GET /api/stock` çağır — `out` **boş** dönmeli. Dönmüyorsa
`normalizeRecord` üretimde çalışmıyor demektir.

---

## Notlar

**Kaba kuvvet sınırı kesin değildir.** Task 6'daki sayaç KV üzerinde tutulur
ve KV anlık tutarlı değildir; eş zamanlı isteklerde birkaç deneme kaçabilir.
Amaç kesin bir kilit değil, kaba kuvveti ve PBKDF2 üzerinden CPU tüketmeyi
pahalı hale getirmektir. Sıkı bir sınır gerekirse Durable Objects'e geçmek
gerekir — şu anki tehdit düzeyi için orantısız.

**Giriş doğrulaması elle yazıldı.** Satış verisi bu panele girdiği gün
`auth.js` yeniden ele alınmalı; o noktada hazır bir kimlik sağlayıcı doğru
tercih olur. Spec'te de böyle not düşüldü.

**Menü ve panelde ürün listesi iki yerde.** `admin/index.html` içindeki
`URUNLER` dizisi, `menu/index.html` içindeki `PRODUCTS` kimlikleriyle
eşleşmek zorunda. Ürün eklenirse ikisi birden güncellenmeli. Bu bilinçli bir
ödün: alternatifi menüyü arka uca taşımaktı, spec bunu kapsam dışı bıraktı.
Fiyat düzenleme adımına geçildiğinde bu tekrar ortadan kalkar.
