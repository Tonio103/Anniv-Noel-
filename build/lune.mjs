/* Vise la direction de la lumiere et capture : c'est le seul moyen de voir la
   lune, qui n'entre dans le cadre de la balade que par intermittence. */
import { chromium } from 'playwright-core';
import { build } from './build.mjs';
await build();
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage'] });
const page = await nav.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', e => console.log('ERREUR', e.message));
await page.goto('file:///home/user/Anniv-Noel-/dist/experience.html?debug=1&q=bas', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 120000 });
await page.evaluate(() => {
  const s = window.__scene, THREE = window.__THREE;
  s.aller(5); s.simuler(6);
  s.boucle.pause();
  const cam = s.camera;
  const dir = s.ciel.uniforms.uSoleilDir.value.clone().normalize();
  cam.lookAt(cam.position.clone().add(dir.multiplyScalar(50)));
  cam.updateMatrixWorld(true);
  s.ciel.mesh.position.copy(cam.position);
  s.postfx.rendre(s.scene, cam, s.boucle.t);
});
await page.waitForTimeout(500);
await page.screenshot({ path: '/home/user/Anniv-Noel-/shots/lune.png' });
await nav.close();
console.log('ok');
