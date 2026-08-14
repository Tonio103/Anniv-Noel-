/* Compare deux series de mires, pixel par pixel.

   On rapporte l'ecart maximal sur un canal, la proportion de pixels qui
   different d'au moins une unite, et l'ecart moyen. Une optimisation qui
   promet de ne rien changer doit sortir des zeros — ou des valeurs assez
   petites pour n'etre imputables qu'a l'ordre des additions en virgule
   flottante, ce qui s'explique et se dit. */

import { chromium } from 'playwright-core';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [a, b] = process.argv.slice(2);
const noms = ['route1', 'route3', 'cote3', 'route5', 'cote5', 'route7'];
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const nav = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await nav.newPage();

console.log('  mire        ecart max   pixels differents   ecart moyen');
let pireGlobal = 0;
for (const n of noms) {
  const f1 = join(root, `shots/${a}-${n}.png`), f2 = join(root, `shots/${b}-${n}.png`);
  if (!existsSync(f1) || !existsSync(f2)) { console.log(`  ${n.padEnd(10)}  (manquante)`); continue; }
  const r = await page.evaluate(async ([s1, s2]) => {
    const lire = async (src) => {
      const im = new Image(); im.src = src; await im.decode();
      const cv = document.createElement('canvas');
      cv.width = im.width; cv.height = im.height;
      const c = cv.getContext('2d', { willReadFrequently: true });
      c.drawImage(im, 0, 0);
      return c.getImageData(0, 0, im.width, im.height).data;
    };
    const d1 = await lire(s1), d2 = await lire(s2);
    if (d1.length !== d2.length) return { erreur: 'tailles differentes' };
    let max = 0, diff = 0, somme = 0;
    const n = d1.length / 4;
    for (let i = 0; i < d1.length; i += 4) {
      const e = Math.max(Math.abs(d1[i] - d2[i]), Math.abs(d1[i + 1] - d2[i + 1]),
                         Math.abs(d1[i + 2] - d2[i + 2]));
      if (e > max) max = e;
      if (e > 0) diff++;
      somme += e;
    }
    return { max, pc: +(diff / n * 100).toFixed(3), moyen: +(somme / n).toFixed(4) };
  }, ['data:image/png;base64,' + readFileSync(f1).toString('base64'),
      'data:image/png;base64,' + readFileSync(f2).toString('base64')]);
  if (r.erreur) { console.log(`  ${n.padEnd(10)}  ${r.erreur}`); continue; }
  pireGlobal = Math.max(pireGlobal, r.max);
  console.log(`  ${n.padEnd(10)} ${String(r.max).padStart(10)} ${String(r.pc + ' %').padStart(19)} ${String(r.moyen).padStart(13)}`);
}
console.log('\n  ecart maximal toutes mires confondues :', pireGlobal, '/ 255');
await nav.close();
