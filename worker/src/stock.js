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
