/* QUAND LES NUANCEURS SE COMPILENT-ILS ?

   Antoine, deux fois : « les decors ont du mal a se generer ». J'avais lu ca
   comme un probleme de portee de dessin, et corrige la portee. Mais le profil
   montre autre chose : la PREMIERE IMAGE coute dix-neuf secondes, contre une
   milliseconde et demie pour les suivantes. Ce n'est pas du dessin, c'est de
   la compilation.

   three.js compile un programme la premiere fois qu'un materiau est REELLEMENT
   dessine. Un objet elimine par le champ de vision au demarrage ne compile
   donc rien ; il compilera plus tard, en pleine balade, et cette image-la
   durera le temps d'une compilation. Sur un telephone, c'est une saccade
   franche a chaque fois qu'un nouveau type d'objet entre dans le cadre.

   On releve donc le nombre de programmes au fil de la balade : chaque
   augmentation en cours de route est une saccade a venir chez Antoine. */

import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

await build();
const nav = await chromium.launch({ executablePath: CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'] });
const page = await nav.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('  [ERREUR PAGE]', e.message));
await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=bas',
                { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 120000 });

const r = await page.evaluate(() => {
  const s = window.__scene;
  s.boucle.pause();
  s.boucle.t = 500;

  const cles = () => new Set(s.renderer.info.programs.map((p) => p.cacheKey));
  let clesPrec = cles();
  const nouvelles = [];
  const releves = [];
  let prec = s.renderer.info.programs.length;
  releves.push({ etape: 'au demarrage', programmes: prec, nouveaux: prec, ms: 0 });

  // On parcourt la balade et on note ou de nouveaux programmes apparaissent.
  for (const h of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
    s.aller(h, 'route');
    let pire = 0;
    for (let i = 0; i < 40; i++) {
      const t0 = performance.now();
      s.simuler(1 / 60);
      s.postfx.rendre(s.scene, s.camera, s.boucle.t);
      pire = Math.max(pire, performance.now() - t0);
    }
    const n = s.renderer.info.programs.length;
    if (n !== prec) {
      releves.push({ etape: `halte ${h}`, programmes: n, nouveaux: n - prec, ms: +pire.toFixed(0) });
      const c = cles();
      for (const k of c) if (!clesPrec.has(k)) nouvelles.push(`halte ${h} : ` + k.slice(0, 150));
      clesPrec = c;
    }
    prec = n;
  }

  // Et les phases d'une halte : le paquet, sa lueur, la carte.
  s.aller(3, 'approche');
  let pire = 0;
  for (let i = 0; i < 60 * 26; i++) {
    const t0 = performance.now();
    s.simuler(1 / 60);
    if (i % 4 === 0) s.postfx.rendre(s.scene, s.camera, s.boucle.t);
    pire = Math.max(pire, performance.now() - t0);
  }
  const n = s.renderer.info.programs.length;
  if (n !== prec) releves.push({ etape: 'ouverture du paquet', programmes: n, nouveaux: n - prec, ms: +pire.toFixed(0) });

  const c = cles();
  for (const k of c) if (!clesPrec.has(k)) nouvelles.push('paquet : ' + k.slice(0, 150));
  return { releves, nouvelles, total: s.renderer.info.programs.length };
});

console.log('  etape                    programmes   nouveaux');
for (const l of r.releves) {
  console.log(`  ${l.etape.padEnd(24)} ${String(l.programmes).padStart(10)} ${String(l.nouveaux).padStart(10)}`);
}
console.log('\n  programmes apparus en cours de route :');
for (const n of r.nouvelles) console.log('   ·', n);
console.log('\n  total en fin de balade :', r.total);
await nav.close();
