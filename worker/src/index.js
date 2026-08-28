import { brusselsDate, normalizeRecord, applyToggle, isValidId, MAX_OUT } from './stock.js';
import { verifyPassword, signToken, verifyToken } from './auth.js';

const ANAHTAR = 'shop:cavuszade:stock';   /* onek ileriye donuk: ikinci dukkan yeni anahtar */
const JETON_OMRU_MS = 90 * 24 * 60 * 60 * 1000;
const GIRIS_SINIRI = 10;
const GIRIS_PENCERESI_SN = 15 * 60;

/* CORS her yanitta aciktir.

   GET herkese acik, salt okunur, kimlik bilgisi tasimayan veri -- kaynak
   kisitlamak ona bir sey katmaz (isteyen curl ile alir) ama yerel
   gelistirmeyi kirar.

   Yazma isteklerinde koruma CORS degil, asagidaki sunucu tarafi kaynak
   denetimi ve jetondur. Cerez kullanilmadigi, yetki Authorization
   basligiyla tasindigi icin '*' ile Authorization birlikte calisir. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

const json = (govde, durum = 200, ekBaslik = {}) =>
  new Response(JSON.stringify(govde), {
    status: durum,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...ekBaslik
    }
  });

function izinliKaynaklar(env) {
  return (env.IZINLI_KAYNAK ?? 'https://cavuszadebruxelles.com')
    .split(',').map(s => s.trim()).filter(Boolean);
}

/* Kaynak kisiti yalnizca tarayiciyi baglar; tarayici disi istemciyi
   engellemez. Asil koruma jetondur, bu ikinci savunma hatti. */
function kaynakUygun(request, env) {
  return izinliKaynaklar(env).includes(request.headers.get('Origin'));
}

async function kayitOku(env, bugun) {
  return normalizeRecord(await env.STOK.get(ANAHTAR, 'json'), bugun);
}

/* Gizli degerler konulmadan dagitim yapilabiliyor. O durumda kripto
   cagrilari istisna firlatir ve Worker 500 doner -- uretimde yasandi.
   Okuma yolu bunlara ihtiyac duymadigi icin menu calismaya devam eder;
   yalnizca yonetim uc noktalari kapanir. */
function yapilandirmaEksik(env, ...gerekli) {
  return gerekli.some(ad => !env[ad]);
}

/* IP basina giris denemesi sayaci.

   KV anlik tutarli degildir: es zamanli isteklerde sayac birkac deneme
   kacirabilir. Bu bir kesinlik araci degil, yavaslatici. Amac kaba kuvveti
   ve PBKDF2 uzerinden CPU tuketmeyi pahali hale getirmek -- her deneme
   ~100 ms CPU yaktigi icin sinirsiz deneme ayni zamanda bir CPU saldirisi. */
function girisAnahtari(request) {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'bilinmeyen';
  return `rl:login:${ip}`;
}

async function girisSayaci(env, anahtar) {
  const v = await env.STOK.get(anahtar);
  return v ? parseInt(v, 10) || 0 : 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname === '/api/stock' && request.method === 'GET') {
      const kayit = await kayitOku(env, brusselsDate());
      return json(kayit, 200, CORS);
    }

    if (url.pathname === '/api/login' && request.method === 'POST') {
      if (!kaynakUygun(request, env)) return json({ error: 'forbidden_origin' }, 403, CORS);
      if (yapilandirmaEksik(env, 'SIFRE_OZETI', 'SIFRE_TUZU', 'JETON_ANAHTARI')) {
        return json({ error: 'not_configured' }, 503, CORS);
      }

      const rlAnahtar = girisAnahtari(request);
      const deneme = await girisSayaci(env, rlAnahtar);
      if (deneme >= GIRIS_SINIRI) {
        return json({ error: 'too_many_attempts' }, 429, CORS);
      }

      let govde;
      try { govde = await request.json(); } catch { return json({ error: 'bad_json' }, 400, CORS); }

      const dogru = typeof govde?.password === 'string' &&
        await verifyPassword(govde.password, env.SIFRE_TUZU, env.SIFRE_OZETI);

      if (!dogru) {
        await env.STOK.put(rlAnahtar, String(deneme + 1), { expirationTtl: GIRIS_PENCERESI_SN });
        return json({ error: 'invalid_password' }, 401, CORS);
      }

      /* Basarili giris sayaci sifirlar: dogru sifreyi bilen kisi, once
         birkac kez yanlis yazdi diye kilitlenmemeli. */
      await env.STOK.put(rlAnahtar, '0', { expirationTtl: GIRIS_PENCERESI_SN });

      const exp = Date.now() + JETON_OMRU_MS;
      return json({
        token: await signToken(exp, env.JETON_ANAHTARI),
        expiresAt: new Date(exp).toISOString()
      }, 200, CORS);
    }

    if (url.pathname === '/api/stock' && request.method === 'POST') {
      if (!kaynakUygun(request, env)) return json({ error: 'forbidden_origin' }, 403, CORS);
      if (yapilandirmaEksik(env, 'JETON_ANAHTARI')) {
        return json({ error: 'not_configured' }, 503, CORS);
      }

      const yetki = request.headers.get('Authorization') ?? '';
      const jeton = yetki.startsWith('Bearer ') ? yetki.slice(7) : null;
      if (!await verifyToken(jeton, env.JETON_ANAHTARI, Date.now())) {
        return json({ error: 'invalid_token' }, 401, CORS);
      }

      let govde;
      try { govde = await request.json(); } catch { return json({ error: 'bad_json' }, 400, CORS); }
      if (!isValidId(govde?.id) || typeof govde?.inStock !== 'boolean') {
        return json({ error: 'invalid_id' }, 400, CORS);
      }

      /* ONCE sifirlama, SONRA degisiklik. Ters sirada dunun tukenmis
         urunleri bugune tasinir ve bu ekranda hemen gorunmez. */
      const bugun = brusselsDate();
      const mevcut = await kayitOku(env, bugun);

      if (!govde.inStock && !mevcut.out.includes(govde.id) && mevcut.out.length >= MAX_OUT) {
        return json({ error: 'too_many_items' }, 400, CORS);
      }

      const yeni = applyToggle(mevcut, govde.id, govde.inStock, new Date().toISOString());
      await env.STOK.put(ANAHTAR, JSON.stringify(yeni));
      return json(yeni, 200, CORS);
    }

    return json({ error: 'not_found' }, 404, CORS);
  }
};
