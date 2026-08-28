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
