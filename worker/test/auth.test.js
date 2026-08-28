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
