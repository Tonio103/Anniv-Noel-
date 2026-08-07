/* Releve chiffre de ce que coute la scene.

   Le temps par image n'est pas mesurable ici — le rendu est logiciel — mais
   le NOMBRE D'APPELS DE DESSIN et le nombre de triangles, eux, le sont, et
   ce sont eux qui decident du cout sur un telephone. On les releve a
   plusieurs points du parcours et pour chaque palier. */
import { chromium } from 'playwright-core';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await build();
const nav = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

for (const q of ['bas', 'moyen', 'haut']) {
  const page = await nav.newPage({ viewport: { width: 390, height: 800 } });
  page.on('pageerror', (e) => console.log('  ERR:', e.message));
  await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=' + q,
    { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__scene!==undefined', { timeout: 240000 });

  const r = await page.evaluate(() => {
    const s = window.__scene;
    const out = { palier: s.palier.nom, dpr: s.renderer.getPixelRatio(), points: [] };
    /* three remet les compteurs a zero au debut de CHAQUE render(). La chaine
       de post-traitement en enchaine sept ou huit : sans couper l'auto-reset,
       on ne lit que la derniere passe — un quad plein ecran, donc un appel et
       un triangle, ce qui n'apprend rien. */
    s.renderer.info.autoReset = false;
    for (const i of [1, 4, 7, 9]) {
      s.aller(i); s.simuler(3);
      s.renderer.info.reset();
      s.postfx.rendre(s.scene, s.camera, s.boucle.t);
      const inf = s.renderer.info.render;
      out.points.push({ halte: i, appels: inf.calls, triangles: inf.triangles });
    }
    s.renderer.info.autoReset = true;
    out.programmes = s.renderer.info.programs.length;
    out.geometries = s.renderer.info.memory.geometries;
    out.textures = s.renderer.info.memory.textures;
    /* Le multi-echantillonnage de la cible intermediaire : c'est lui qui
       decide si les aretes sont crenelees, pas le drapeau antialias du
       moteur, qui ne concerne que le tampon par defaut. */
    out.samplesScene = s.postfx.rtScene ? (s.postfx.rtScene.samples || 0) : 'pas de postfx';
    out.postfxActif = s.postfx.actif;
    return out;
  });

  console.log(`\npalier ${r.palier}  dpr=${r.dpr}  postfx=${r.postfxActif}  samples=${r.samplesScene}`);
  for (const p of r.points) {
    console.log(`   halte ${p.halte} : ${String(p.appels).padStart(4)} appels · ${String(p.triangles).padStart(7)} triangles`);
  }
  console.log(`   programmes ${r.programmes} · geometries ${r.geometries} · textures ${r.textures}`);
  await page.close();
}

await nav.close();
