/* Uretim gizli degerlerini hazirlar.
 *
 * Calistirma:  node scripts/sifre-kur.mjs
 *
 * Bu betik Cloudflare'a BAGLANMAZ. Sadece sifreni alir, ozetini hesaplar ve
 * gecici bir dosyaya yazar. Yuklemeyi ayri bir adim yapar.
 *
 * Neden boyle: wrangler'in kimlik bilgisi bazi terminallerde bulunamiyor ve
 * "non-interactive environment" hatasi veriyor. Hesaplamayi yuklemeden
 * ayirinca bu sorun tamamen ortadan kalkiyor.
 *
 * Sifre yalnizca bu surecin bellegindedir:
 *   - ekranda gorunmez (gizli istem)
 *   - komut satirina yazilmaz, kabuk gecmisine dusmez
 *   - dosyaya YAZILMAZ; dosyaya yalnizca ozeti ve tuzu gider
 *
 * Uretilen dosya .gitignore'da; yukleme bitince silinir.
 */
import { createInterface } from 'node:readline';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../src/auth.js';

const CIKTI = fileURLToPath(new URL('../.gizli-gecici.json', import.meta.url));

function gizliSor(soru) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error('Bu betik gercek bir terminalde calistirilmali.'));
      return;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    /* Yazilan karakterler ekrana basilmasin; yalnizca sorunun kendisi gorunsun. */
    rl._writeToOutput = (metin) => {
      if (metin.includes(soru)) process.stdout.write(soru);
    };
    rl.question(soru, (deger) => {
      rl.close();
      process.stdout.write('\n');
      resolve(deger);
    });
  });
}

const sifre = await gizliSor('Yonetim paneli sifresi: ');
if (sifre.length < 8) {
  console.error('\nSifre en az 8 karakter olmali. Hicbir sey yazilmadi.');
  process.exit(1);
}
const tekrar = await gizliSor('Tekrar: ');
if (sifre !== tekrar) {
  console.error('\nSifreler ayni degil. Hicbir sey yazilmadi.');
  process.exit(1);
}

const tuz = randomBytes(16).toString('base64');
const ozet = await hashPassword(sifre, tuz);
const jetonAnahtari = randomBytes(32).toString('base64');

/* Dosyaya sifre degil, ozeti gider. Ozetten sifre geri hesaplanamaz. */
writeFileSync(CIKTI, JSON.stringify({
  SIFRE_TUZU: tuz,
  SIFRE_OZETI: ozet,
  JETON_ANAHTARI: jetonAnahtari
}, null, 2), { encoding: 'utf-8', mode: 0o600 });

console.log('\nHazir. Simdi Claude\'a "oldu" de -- yuklemeyi o yapacak.');
console.log('Sifren hicbir yere kaydedilmedi.');
