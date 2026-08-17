/* La poursuite, image par image : est-elle eteinte au depart, et voit-on
   vraiment deux voitures passer ? */
import { chromium } from 'playwright-core';
import { join } from 'node:path';
const root = '/home/user/Anniv-Noel-';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage'] });
const page = await nav.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('[ERR]', e.message));
await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=moyen', { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 240000 });
await page.click('#enterBtn');

const depart = await page.evaluate(() => {
  const s = window.__scene;
  const sc = s.apparitions.scenes.find(x => x.nom === 'police');
  return { sCerf: +s.cerf.s.toFixed(1), fenetre: [+(sc.s - sc.avant).toFixed(1), +(sc.s + sc.apres).toFixed(1)], visible: sc.objet.visible };
});
console.log(`au depart : cerf a s=${depart.sCerf}, fenetre police ${depart.fenetre[0]}..${depart.fenetre[1]} — visible=${depart.visible}`);

for (const u of [0.10, 0.28, 0.40, 0.52, 0.64, 0.80]) {
  await page.evaluate((u) => {
    const s = window.__scene, THREE = window.__THREE;
    let sec = 0; while (s.drone.enCinematique && sec++ < 900) s.simuler(1/60);
    const sc = s.apparitions.scenes.find(x => x.nom === 'police');
    const T0 = 200;
    const sVue = sc.s - sc.avant + (sc.avant + sc.apres) * u;
    s.cerf.s = sVue; s.cerf.placer(sVue);
    s.drone.poser(s.cerf, T0);
    for (let i = 0; i < 90; i++) {
      s.cerf.placer(sVue);
      s.drone.maj(1/60, T0 + i/60, s.cerf);
      s.relief.maj(s.camera, s.ciel.actuel); s.foret.maj(s.camera);
      s.apparitions.maj(1/60, T0 + i/60, sVue, s.camera);
    }
    s.boucle.pause();
    s.postfx.rendre(s.scene, s.camera, T0 + 1.5);
    const o = sc.objet;
    const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).project(s.camera);
    window.__info = { vis: o.visible, x: +p.x.toFixed(2), y: +p.y.toFixed(2), d: +s.camera.position.distanceTo(new THREE.Vector3().setFromMatrixPosition(o.matrixWorld)).toFixed(1) };
  }, u);
  const i = await page.evaluate(() => window.__info);
  await page.waitForTimeout(120);
  await page.screenshot({ path: join(root, `shots/chasse-${u}.png`) });
  console.log(`  u=${u}  visible=${i.vis}  ecran x=${i.x} y=${i.y}  a ${i.d} m`);
}
await nav.close();
