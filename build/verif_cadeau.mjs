/* Portrait du cadeau ouvert, en gros plan, avec le montage de camera fiable
   (marche naturelle + reglage manuel de la vue) plutot que `halte.mjs`, dont
   le demarrage a froid laisse la camera-ressort partir dans le decor. */
import { chromium } from 'playwright-core';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await build();
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--disable-dev-shm-usage'] });
const page = await nav.newPage({ viewport: { width: 800, height: 700 } });
page.on('pageerror', (e) => console.log('  [ERREUR PAGE]', e.message));
await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=haut',
                { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 180000 });

await page.evaluate(() => {
  const s = window.__scene;
  // `aller(i,'attente')` saute FOUILLE/PERCEE, donc `halte.preparer()`
  // n'est jamais appele et `halte.cadeau` reste nul. On passe par 'approche'
  // puis on avance jusqu'a la vraie ATTENTE, en suivant le meme chemin que
  // la balade reelle.
  s.aller(3, 'approche');
  let t = 0;
  while (s.phase() !== 'attente' && t < 30) { s.simuler(0.2); t += 0.2; }
  s.boucle.pause();
  // On desamorce les gestes spontanes pour figer une pose lisible.
  s.cerf.regard = 0; s.cerf.regardAuto = 0; s.cerf._geste = null; s.cerf._prochainGeste = 999;
});

for (const [nom, d, h, dist] of [['face', 0, 0.55, 2.0], ['trois-quart', 0.9, 0.65, 1.9], ['dessus', 0.3, 1.3, 1.6]]) {
  await page.evaluate(([d0, h0, dist0]) => {
    const s = window.__scene;
    const c = s.halte.cadeau.groupe.position;
    s.camera.position.set(c.x + Math.sin(d0) * dist0, c.y + h0, c.z + Math.cos(d0) * dist0);
    s.camera.lookAt(c.x, c.y + s.halte.cadeau.centreY, c.z);
    s.camera.updateMatrixWorld();
    s.postfx.viser(dist0);
    s.postfx.rendre(s.scene, s.camera, s.boucle.t);
  }, [d, h, dist]);
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(root, `shots/cadeau-${nom}.png`) });
  console.log('  →', nom);
}
await nav.close();
