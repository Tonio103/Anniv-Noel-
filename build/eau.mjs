/* LE RUISSEAU, VU DE PRES.

   Antoine : « quand il marche dedans on dirait que c'est bugge, en fait cela
   ne ressemble pas a de l'eau ». Le ruisseau ne se voit a aucune halte : il
   est entre deux, aux fractions 0,24 et 0,68 du chemin. Aucun outil existant
   ne le cadre. Celui-ci place le cerf juste avant une traversee, laisse la
   marche l'y amener, et capture pendant qu'il est DESSUS — au format et au
   palier du telephone, puisque c'est la que le defaut a ete vu. */

import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const frac = Number(process.argv[2] || 0.24);
const large = Number(process.env.W || 390);
const haut = Number(process.env.H || 844);
const q = process.env.Q || 'bas';

await build();
const nav = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--ignore-gpu-blocklist', '--disable-dev-shm-usage',
         '--force-device-scale-factor=1'],
});
const page = await nav.newPage({ viewport: { width: large, height: haut }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('  [ERREUR PAGE]', e.message));
await page.goto('file://' + join(root, 'dist/experience.html') + `?debug=1&q=${q}`,
                { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 120000 });

/* On demarre la balade a une quinzaine de metres en amont de la traversee,
   puis on avance par paliers en notant a chaque fois si le cerf est sur la
   glace : c'est le seul moment qui nous interesse. */
const info = await page.evaluate((f) => {
  const sc = window.__scene;
  const s0 = sc.chemin.longueur * f - 16;
  /* Il faut viser une halte SITUEE APRES la traversee, sinon le cerf se
     croit arrive, passe en approche puis en fouille, et ne bouge plus d'un
     centimetre : c'est ce qui rendait la premiere tentative immobile. */
  let cible = 0;
  for (let i = 0; i < sc.chemin.haltes.length; i++) {
    if (sc.chemin.haltes[i].s > s0 + 40) { cible = i; break; }
  }
  sc.aller(cible, 'route');
  sc.cerf.s = s0;
  sc.drone.poser(sc.cerf, sc.boucle.t);
  return {
    L: sc.chemin.longueur,
    cible, halteS: +sc.chemin.haltes[cible].s.toFixed(1),
    traversees: sc.ruisseau.passages.map((p) => ({ s: +p.s.toFixed(1), y: +p.y.toFixed(2) })),
    s: +sc.cerf.s.toFixed(1),
  };
}, frac);
console.log('  chemin', info.L.toFixed(0), 'm · traversees', JSON.stringify(info.traversees));

/* Mode « pose » : on arrete le cerf a des distances CHOISIES de la traversee,
   pour comparer deux rendus au pixel pres. En marche libre il ne retombe
   jamais deux fois au meme endroit. */
const poses = process.env.POSE ? process.env.POSE.split(',').map(Number) : null;
if (poses) {
  await page.evaluate(() => { const sc = window.__scene; sc.simuler(9.0); });
  for (const d of poses) {
    const e = await page.evaluate((dd) => {
      const sc = window.__scene;
      sc.cerf.s = sc.ruisseau.passages[0].s + dd;
      sc.cerf.vitesseCible = 0;
      sc.drone.poser(sc.cerf, sc.boucle.t);
      sc.simuler(1.4);
      return { s: +sc.cerf.s.toFixed(1), glace: sc.ruisseau.surGlace(sc.cerf.s),
               y: +sc.cerf.racine.position.y.toFixed(2) };
    }, d);
    await page.waitForTimeout(700);
    const nom = `pose${d >= 0 ? '+' : ''}${d}.png`;
    await page.screenshot({ path: join(root, 'shots', nom) });
    console.log(`  d=${d}  s=${e.s}  ${e.glace ? 'SUR LA GLACE' : '           '}  y=${e.y}  → ${nom}`);
  }
  await nav.close();
  process.exit(0);
}

for (let k = 0; k < 9; k++) {
  const e = await page.evaluate(() => {
    const sc = window.__scene;
    sc.simuler(0.9);
    return {
      s: +sc.cerf.s.toFixed(1),
      glace: sc.ruisseau.surGlace(sc.cerf.s),
      y: +sc.cerf.racine.position.y.toFixed(2),
      cam: +sc.camera.position.y.toFixed(2),
    };
  });
  await page.waitForTimeout(700);
  const nom = `eau-${frac}-${k}${e.glace ? '-GLACE' : ''}.png`;
  await page.screenshot({ path: join(root, 'shots', nom) });
  console.log(`  ${k}  s=${e.s}  ${e.glace ? 'SUR LA GLACE' : '           '}  cerf y=${e.y}  → ${nom}`);
}

await nav.close();
