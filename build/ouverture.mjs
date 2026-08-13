/* La cinematique d'ouverture se joue-t-elle vraiment ?

   On entre dans la foret, puis on releve la position de la camera a
   intervalles reguliers : elle doit descendre et avancer d'un seul tenant,
   sans saut, et finir a hauteur d'homme derriere le cerf. */
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
await build();
const nav = await chromium.launch({ executablePath: CHROME,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
         '--no-sandbox','--disable-dev-shm-usage'] });
const page = await nav.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => console.log('  [ERREUR PAGE]', e.message));
await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=bas', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 120000 });

const r = await page.evaluate(() => {
  const s = window.__scene;
  document.getElementById('enterBtn').click();
  const releves = [];
  let saut = 0, prec = null;
  for (let i = 0; i < 14 * 60; i++) {
    s.simuler(1 / 60);
    const c = s.camera.position;
    if (prec) saut = Math.max(saut, Math.hypot(c.x - prec[0], c.y - prec[1], c.z - prec[2]));
    prec = [c.x, c.y, c.z];
    if (i % 60 === 0) {
      releves.push({ s: i / 60, y: +c.y.toFixed(1),
        dCerf: +c.distanceTo(s.cerf.racine.position).toFixed(1),
        v: +s.cerf.vitesse.toFixed(1), cine: s.drone.enCinematique });
    }
  }
  return { releves, sautMax: +saut.toFixed(3), phase: s.phase() };
});
console.log('  t   hauteur  dist.cerf  vitesse  cinematique');
for (const l of r.releves) {
  console.log(`${String(l.s).padStart(4)}s ${String(l.y).padStart(7)} ${String(l.dCerf).padStart(9)} ${String(l.v).padStart(8)}  ${l.cine ? 'oui' : '—'}`);
}
console.log('  plus grand saut d une image a l autre :', r.sautMax, 'm · phase finale :', r.phase);

/* Et une image a deux moments du plan : les chiffres disent que le mouvement
   est continu, ils ne disent pas ce qu'on voit. */
const instants = process.env.T
  ? process.env.T.split(',').map((v) => [String(v).replace('.', 'p'), Number(v)])
  : [['debut', 1.5], ['descente', 6.0]];
for (const [nom, t] of instants) {
  await page.evaluate(() => { location.reload(); });
  await page.waitForFunction('window.__scene !== undefined', { timeout: 120000 });
  await page.evaluate((sec) => {
    const s = window.__scene;
    document.getElementById('enterBtn').click();
    for (let i = 0; i < sec * 60; i++) s.simuler(1 / 60);
    s.boucle.pause();
    s.postfx.rendre(s.scene, s.camera, s.boucle.t);
  }, t);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(root, `shots/ouv-${nom}.png`) });
  console.log('  →', `shots/ouv-${nom}.png`);
}
await nav.close();
