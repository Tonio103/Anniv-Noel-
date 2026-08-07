/* Gros plan sur le cerf, sous plusieurs angles.

   Le parcours normal le montre a huit metres, de dos : a cette taille, un
   defaut de robe ou de maillage passe inapercu jusqu'a ce qu'il saute aux
   yeux sur un grand ecran. On le regarde donc de pres, et de partout. */
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await build();
await mkdir(join(root, 'shots'), { recursive: true });

const nav = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await nav.newPage({ viewport: { width: 760, height: 620 } });
page.on('pageerror', (e) => console.log('  ERR:', e.message));

await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=' + (process.env.Q || 'moyen'),
  { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.__scene!==undefined', { timeout: 180000 });
await page.evaluate(() => {
  window.__scene.aller(4);
  window.__scene.simuler(4);
  // On coupe la boucle : sinon le drone reprend la main entre le rendu et la
  // capture, et on photographie son cadrage a lui, pas le notre.
  window.__scene.boucle.pause();
});

/* On detourne la boucle de rendu : le drone reprendrait la main a chaque
   image, donc on repose la camera juste avant la capture. */
const angles = [
  { nom: 'profil',  a: 1.57, d: 3.4, h: 1.5 },
  { nom: 'face',    a: 3.14, d: 3.2, h: 1.6 },
  { nom: 'troisq',  a: 2.30, d: 3.2, h: 1.5 },
  { nom: 'arriere', a: 0.10, d: 3.4, h: 1.6 },
];

for (const v of angles) {
  await page.evaluate((v) => {
    const s = window.__scene;
    s.simuler(0.35);
    const c = s.cerf.racine.position;
    const y = s.cerf.racine.rotation.y;
    s.camera.position.set(
      c.x + Math.sin(y + v.a) * v.d,
      c.y + v.h,
      c.z + Math.cos(y + v.a) * v.d
    );
    s.camera.lookAt(c.x, c.y + 0.95, c.z);
    s.camera.updateMatrixWorld();
    s.postfx.viser(v.d);
    s.postfx.rendre(s.scene, s.camera, s.boucle.t);
  }, v);
  await page.waitForTimeout(1500);
  // On refait le rendu juste avant la capture : la boucle a pu repasser.
  await page.evaluate((v) => {
    const s = window.__scene;
    const c = s.cerf.racine.position;
    const y = s.cerf.racine.rotation.y;
    s.camera.position.set(
      c.x + Math.sin(y + v.a) * v.d, c.y + v.h, c.z + Math.cos(y + v.a) * v.d);
    s.camera.lookAt(c.x, c.y + 0.95, c.z);
    s.camera.updateMatrixWorld();
    s.postfx.rendre(s.scene, s.camera, s.boucle.t);
  }, v);
  await page.screenshot({ path: join(root, `shots/cerf-${v.nom}.png`) });
  console.log('  →', v.nom);
}

await nav.close();
