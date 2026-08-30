import { brusselsDate, normalizeRecord, applyToggle, isValidId, MAX_OUT } from './stock.js';
import { verifyPassword, signToken, verifyToken } from './auth.js';
import {
  DILIM_PER_KG, MAX_META, gecerliAy, gecerliSiparis, siparisAnahtari,
  ayOneki, anahtardanTarih, meta, metaBoyutu, metadanSatirlar, aylar, topla
} from './sales.js';

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

async function jetonGecerli(request, env) {
  const yetki = request.headers.get('Authorization') ?? '';
  const jeton = yetki.startsWith('Bearer ') ? yetki.slice(7) : null;
  return verifyToken(jeton, env.JETON_ANAHTARI, Date.now());
}

/* Bir ayin butun siparislerini okur.

   Yalnizca list() cagirir, siparis basina get() CAGIRMAZ. Satirlar
   anahtarin metadata'sinda durdugu icin buna gerek yok. Onemli: Workers'ta
   istek basina alt istek sayisi sinirlidir; siparis basina bir get() ayda
   birkac yuz siparisten sonra raporu tamamen calismaz hale getirirdi. */
const SAYFA_SINIRI = 20;   /* 20 x 1000 anahtar; bir ayda buna asla varilmaz */

async function ayKayitlari(env, ay) {
  const onek = ayOneki(ay);
  const kayitlar = [];
  let cursor;
  for (let sayfa = 0; sayfa < SAYFA_SINIRI; sayfa++) {
    const r = await env.STOK.list({ prefix: onek, cursor });
    for (const k of r.keys) {
      const tarih = anahtardanTarih(k.name);
      if (tarih) kayitlar.push({ tarih, satirlar: metadanSatirlar(k.metadata) });
    }
    if (r.list_complete) break;
    cursor = r.cursor;
    if (!cursor) break;
  }
  return kayitlar;
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

      if (!await jetonGecerli(request, env)) {
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

    /* ---- Siparis defteri ------------------------------------------------
       Stogun aksine bu uc noktalar HERKESE ACIK DEGIL: satis miktari
       isletmenin ic verisi, menude gosterilmiyor. Ikisi de jeton ister ve
       tarayici tarafinda ayrica kaynak denetiminden gecer. */

    if (url.pathname === '/api/sales' && request.method === 'POST') {
      if (!kaynakUygun(request, env)) return json({ error: 'forbidden_origin' }, 403, CORS);
      if (yapilandirmaEksik(env, 'JETON_ANAHTARI')) {
        return json({ error: 'not_configured' }, 503, CORS);
      }
      if (!await jetonGecerli(request, env)) {
        return json({ error: 'invalid_token' }, 401, CORS);
      }

      let govde;
      try { govde = await request.json(); } catch { return json({ error: 'bad_json' }, 400, CORS); }

      const hata = gecerliSiparis(govde?.satirlar);
      if (hata) return json({ error: hata }, 400, CORS);

      const ust = meta(govde.satirlar);
      if (metaBoyutu(ust) > MAX_META) return json({ error: 'siparis_cok_buyuk' }, 400, CORS);

      /* Her siparis KENDI anahtarina yazilir: oku-degistir-yaz yok, yani iki
         tezgahtar ayni anda kaydetse bile siparis kaybolmaz. Stok tarafinda
         acik is olarak duran kayip guncelleme riski burada dogmuyor. */
      const simdi = new Date();
      const tarih = brusselsDate(simdi);
      const anahtar = siparisAnahtari(
        tarih, simdi.getTime(), crypto.randomUUID().slice(0, 8)
      );

      await env.STOK.put(
        anahtar,
        JSON.stringify({ tarih, ts: simdi.toISOString(), satirlar: govde.satirlar }),
        { metadata: ust }
      );

      return json({ ok: true, anahtar, tarih, satirlar: govde.satirlar }, 200, CORS);
    }

    if (url.pathname === '/api/sales' && request.method === 'GET') {
      if (!kaynakUygun(request, env)) return json({ error: 'forbidden_origin' }, 403, CORS);
      if (yapilandirmaEksik(env, 'JETON_ANAHTARI')) {
        return json({ error: 'not_configured' }, 503, CORS);
      }
      if (!await jetonGecerli(request, env)) {
        return json({ error: 'invalid_token' }, 401, CORS);
      }

      /* dilimPerKg her iki yanitta da doner: cevrim tablosunun tek kaynagi
         worker, panel kendi kopyasini tutmasin diye. */
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');

      if (from || to) {
        const liste = aylar(from, to);
        if (liste.length === 0) return json({ error: 'gecersiz_aralik' }, 400, CORS);
        const sonuc = [];
        for (const ay of liste) {
          const { siparis, toplam } = topla(await ayKayitlari(env, ay));
          sonuc.push({ ay, siparis, toplam });
        }
        return json({ aylar: sonuc, dilimPerKg: DILIM_PER_KG }, 200, CORS);
      }

      const ay = url.searchParams.get('month') ?? brusselsDate().slice(0, 7);
      if (!gecerliAy(ay)) return json({ error: 'gecersiz_ay' }, 400, CORS);

      const { siparis, toplam, gunler } = topla(await ayKayitlari(env, ay));
      return json({ ay, siparis, toplam, gunler, dilimPerKg: DILIM_PER_KG }, 200, CORS);
    }

    return json({ error: 'not_found' }, 404, CORS);
  }
};
