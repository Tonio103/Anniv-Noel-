/* QUI DESSINE CES BANDES ?

   La traversee du ruisseau montre trois choses au meme endroit : des bandes
   bleues paralleles en travers de toute la largeur, une trainee sombre a
   cote du cerf, et un ruban gris sale. Trois defauts possibles, trois
   causes possibles — et deviner laquelle est laquelle, c'est se tromper.

   On refait donc EXACTEMENT le meme cadre, en eteignant un element a la
   fois. Ce qui disparait avec l'element lui appartient. */

import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
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

// Amener le cerf sur la glace, puis l'y ARRETER : le cadre doit etre le meme
// d'un essai a l'autre, sinon on compare deux images differentes.
const etat = await page.evaluate(() => {
  const sc = window.__scene;
  const s0 = sc.chemin.longueur * 0.24 - 16;
  let cible = 0;
  for (let i = 0; i < sc.chemin.haltes.length; i++) {
    if (sc.chemin.haltes[i].s > s0 + 40) { cible = i; break; }
  }
  sc.aller(cible, 'route');
  sc.cerf.s = s0;
  sc.drone.poser(sc.cerf, sc.boucle.t);
  /* On le fait marcher pour que les empreintes existent, puis on le REPOSE
     sur la traversee : la duree de simulation ne tombe jamais deux fois au
     meme endroit, et il faut ici un cadre reproductible. */
  sc.simuler(9.0);
  sc.cerf.s = sc.ruisseau.passages[0].s - 1.2;
  sc.cerf.vitesseCible = 0;
  sc.drone.poser(sc.cerf, sc.boucle.t);
  sc.simuler(1.4);
  return { s: +sc.cerf.s.toFixed(1), glace: sc.ruisseau.surGlace(sc.cerf.s) };
});
console.log('  cerf a s =', etat.s, '· sur la glace :', etat.glace);

const essais = [
  ['temoin', () => {}],
  ['sans-ruisseau', () => { window.__scene.ruisseau.groupe.visible = false; }],
  ['ruisseau-ruban-seul', () => {
    window.__scene.ruisseau.groupe.children.forEach((c, i) => { c.visible = i % 3 === 0; });
  }],
  ['ruisseau-berges-seules', () => {
    window.__scene.ruisseau.groupe.children.forEach((c, i) => { c.visible = i % 3 === 1; });
  }],
  ['sans-empreintes', () => {
    window.__scene.scene.traverse((o) => {
      const u = o.material?.userData?.uniforms;
      if (u && u.uAEmpreintes) u.uAEmpreintes.value = 0;
    });
  }],
  ['sans-ombres', () => { window.__scene.renderer.shadowMap.enabled = false; }],
  ['sans-cerf', () => { window.__scene.cerf.racine.visible = false; }],
  ['sans-scintille', () => {
    window.__scene.scene.traverse((o) => {
      const u = o.material?.userData?.uniforms;
      if (u && u.uScintille) u.uScintille.value = 0;
    });
  }],
];

for (const [nom, f] of essais) {
  await page.evaluate(`(${f.toString()})()`);
  await page.evaluate(() => { const sc = window.__scene; sc.cerf.vitesseCible = 0; sc.simuler(0.6); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(root, `shots/bande-${nom}.png`) });
  console.log('  →', `bande-${nom}.png`);
  await page.evaluate(() => {
    const sc = window.__scene;
    sc.ruisseau.groupe.visible = true;
    sc.ruisseau.groupe.children.forEach((c) => { c.visible = true; });
    sc.cerf.racine.visible = true;
    sc.renderer.shadowMap.enabled = true;
    sc.scene.traverse((o) => {
      const u = o.material?.userData?.uniforms;
      if (u && u.uAEmpreintes) u.uAEmpreintes.value = 1;
      if (u && u.uScintille) u.uScintille.value = 1;
    });
  });
}

await nav.close();
