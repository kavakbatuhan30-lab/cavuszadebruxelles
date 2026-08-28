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
