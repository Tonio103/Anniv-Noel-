/* Captures de la faune pendant une vraie balade (boucle en pause, temps
   simule), au format du telephone, a chaque moment de rencontre. */
import { chromium } from 'playwright-core';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await build();
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await nav.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('  ERR:', e.message));
await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=moyen', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.__scene!==undefined', undefined, { timeout: 180000 });
await page.evaluate(() => {
  const sc = window.__scene; sc.boucle.pause();
  sc.aller(1); sc.cerf.s = 90; sc.cerf.vitesse = 3.3; sc.cerf.vitesseCible = 3.3;
  window.__etat = { dansPhase: 0, ph: sc.phase(), marques: {} };
});
/* Avance jusqu'au prochain evenement nomme (ou `max` secondes). */
const avancer = (max) => page.evaluate((max) => {
  const sc = window.__scene, E = window.__etat, h = 1 / 60, f = sc.faune;
  const evts = {
    oiseaux: () => f.passereaux.troupes.find((tr) => tr.envolee && !E.marques['o' + tr.s]),
    lievre: () => f.lievres.find((l) => l.etat === 2 && !E.marques.lievre),
    tapi: () => f.lievres.find((l) => l.tapi > 0.95 && !E.marques.tapi),
    cri: () => f.chouettes.find((c) => c.criDepuis !== undefined && !E.marques.cri),
    vol: () => f.chouettes.find((c) => c.etat === 1 && !E.marques.vol),
  };
  for (let t = 0; t < max; t += h) {
    sc.simuler(h);
    E.dansPhase += h;
    const p = sc.phase();
    if (p !== E.ph) { E.ph = p; E.dansPhase = 0; }
    if (p === 'attente' && E.dansPhase > 3) { document.getElementById('gl').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1 })); E.dansPhase = 0; }
    if (p === 'lecture' && E.dansPhase > 4) { document.getElementById('cardNext').click(); E.dansPhase = 0; }
    for (const [nom, test] of Object.entries(evts)) {
      const x = test();
      if (x) { E.marques[nom === 'oiseaux' ? 'o' + x.s : nom] = true; return { nom, s: sc.cerf.s.toFixed(1), halte: nom === 'oiseaux' ? Math.round(x.s) : '' }; }
    }
    if (p === 'fin') return { nom: 'fin' };
  }
  return { nom: 'rien' };
}, max);
const vue = async (nom) => {
  await page.evaluate(() => {
    const sc = window.__scene;
    sc.empreintes.rendre(sc.renderer, sc.cerf.racine.position, 1 / 60);
    sc.postfx.rendre(sc.scene, sc.camera, sc.boucle.t);
  });
  await page.screenshot({ path: join(root, `shots/faune-${nom}.png`) });
  console.log('  capture', nom);
};
const sim = (s) => page.evaluate((s) => window.__scene.simuler(s), s);
for (;;) {
  const e = await avancer(400);
  console.log('  evenement', JSON.stringify(e));
  if (e.nom === 'fin' || e.nom === 'rien') break;
  if (e.nom === 'oiseaux') { await sim(0.4); await vue(`bouvreuils-envol-${e.halte}`); await sim(0.8); await vue(`bouvreuils-vol-${e.halte}`); }
  if (e.nom === 'tapi') { await vue('lievre-tapi'); }
  if (e.nom === 'lievre') { await sim(0.5); await vue('lievre-fuite'); await sim(0.7); await vue('lievre-traverse'); }
  if (e.nom === 'cri') { await sim(1.3); await vue('chouette-cri'); }
  if (e.nom === 'vol') { await sim(0.7); await vue('chouette-envol'); await sim(0.9); await vue('chouette-traverse'); }
}
await nav.close();
