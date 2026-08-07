/* Est-ce qu'il est vivant ?

   Les petits automatismes — oreilles, clignement, coup de queue, gestes
   spontanes — sont exactement le genre de code qu'on peut ecrire, brancher,
   et qui ne se declenche jamais : un minuteur mal remis a zero, une condition
   qui n'est jamais vraie, une valeur ecrasee plus bas dans la meme frame. Et
   comme leur absence ressemble a de la sobriete, personne ne s'en apercoit.

   On echantillonne donc l'animal pendant une minute de marche simulee et on
   verifie que chaque chose bouge VRAIMENT, avec l'amplitude attendue. */
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
const page = await nav.newPage({ viewport: { width: 640, height: 400 } });
let erreurs = 0;
page.on('pageerror', (e) => { erreurs++; console.log('  ERR:', e.message); });

await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=moyen', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.__scene!==undefined', { timeout: 180000 });
await page.evaluate(() => { window.__scene.aller(4); });

/* Un pas de simulation fin : les tics durent un dixieme de seconde, un
   echantillonnage grossier les manquerait tous et conclurait a tort. */
const r = await page.evaluate(() => {
  const s = window.__scene, c = s.cerf;
  const rel = {
    oreilleG: [], oreilleD: [], oeil: [], queueX: [], queueZ: [],
    regardAuto: [], allant: [], secousse: [], vitesse: [],
  };
  /* Les gestes spontanes sont volontairement SUPPRIMES aux haltes — la mise
     en scene y commande la nuque, et deux intentions concurrentes donneraient
     un tremblement. Il faut donc echantillonner en TRAJET : des que la balade
     quitte la route, on la renvoie sur un autre troncon. Sans cela on mesure
     surtout des arrets et on conclut a tort que rien ne bouge. */
  let halte = 1;
  for (let i = 0; i < 5400; i++) {           // 90 s a 1/60
    if (s.phase() !== 'route') { halte = (halte % 8) + 1; s.aller(halte); }
    s.simuler(1 / 60);
    rel.oreilleG.push(c.oreilles[1].rotation.z);
    rel.oreilleD.push(c.oreilles[0].rotation.z);
    rel.oeil.push(c.yeux[0].scale.y);
    rel.queueX.push(c.queue.rotation.x);
    rel.queueZ.push(c.queue.rotation.z);
    rel.regardAuto.push(c.regardAuto);
    rel.allant.push(c.allant);
    rel.secousse.push(c.secousse);
    rel.vitesse.push(c.vitesse);
  }
  const stat = (a) => {
    let mn = Infinity, mx = -Infinity;
    for (const v of a) { if (v < mn) mn = v; if (v > mx) mx = v; }
    return { min: +mn.toFixed(3), max: +mx.toFixed(3), etendue: +(mx - mn).toFixed(3) };
  };
  const out = {};
  for (const k of Object.keys(rel)) out[k] = stat(rel[k]);
  // Combien de clignements : un front descendant sous 0,5.
  let clins = 0;
  for (let i = 1; i < rel.oeil.length; i++) {
    if (rel.oeil[i] < 0.5 && rel.oeil[i - 1] >= 0.5) clins++;
  }
  out.clins = clins;
  return out;
});

const lignes = [
  ['oreille gauche', r.oreilleG.etendue, 0.05],
  ['oreille droite', r.oreilleD.etendue, 0.05],
  ['queue (leve)',   r.queueX.etendue,   0.10],
  ['queue (cote)',   r.queueZ.etendue,   0.05],
  ['coup d\'oeil',   r.regardAuto.etendue, 0.20],
  ['entrain',        r.allant.etendue,   0.05],
  ['vitesse',        r.vitesse.etendue,  0.30],
];
console.log('sur 90 s de marche :');
for (const [nom, v, seuil] of lignes) {
  const ok = v >= seuil;
  if (!ok) erreurs++;
  console.log(`  ${ok ? 'ok ' : 'KO '} ${nom.padEnd(16)} amplitude ${v}  (attendu >= ${seuil})`);
}
const clinsOk = r.clins >= 8 && r.clins <= 60;
if (!clinsOk) erreurs++;
console.log(`  ${clinsOk ? 'ok ' : 'KO '} clignements     ${r.clins} en 90 s  (attendu 8 a 60)`);
console.log(`  (secousse de tete : amplitude ${r.secousse.etendue})`);
console.log('erreurs :', erreurs);
await nav.close();
process.exit(erreurs ? 1 : 0);
