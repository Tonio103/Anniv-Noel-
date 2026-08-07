/* Les sabots touchent-ils vraiment la neige ?

   Un quadrupede qui flotte de quelques centimetres est le defaut le plus
   couteux qui soit : il ne se nomme pas, mais il retire toute credibilite au
   sol, donc a la scene entiere. Et c'est un defaut qu'on ne peut PAS juger a
   l'oeil sur une capture — la perspective, la pente et le relief rendent
   l'estimation visuelle non concluante dans les deux sens.

   On le mesure donc : position mondiale de chaque sabot contre la hauteur du
   terrain juste dessous, echantillonnee sur une longue marche. Ce qui compte
   n'est pas la moyenne mais le MINIMUM sur le cycle : a chaque foulee, au
   moins un sabot doit venir au contact. */
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
await page.evaluate(() => window.__scene.aller(3));

const r = await page.evaluate(() => {
  const s = window.__scene, c = s.cerf;
  const parMembre = {};
  for (const mb of c.membres) parMembre[mb.nom] = { ech: [], contacts: 0 };
  let minCycle = [];

  let halte = 1;
  for (let i = 0; i < 3600; i++) {
    if (s.phase() !== 'route') { halte = (halte % 8) + 1; s.aller(halte); }
    s.simuler(1 / 60);
    // Les matrices ne sont a jour qu'au rendu : en temps simule il faut le
    // demander explicitement, sinon on mesure la pose de l'image precedente.
    s.scene.updateMatrixWorld(true);

    let mini = Infinity;
    for (const mb of c.membres) {
      /* Le sabot est au bout de l'os bas, a (0, -L2, 0) dans son repere.
         matrixWorld est en colonnes : p = -L2 · colonne1 + translation. */
      const e = mb.bas.matrixWorld.elements;
      const x = -mb.L2 * e[4] + e[12];
      const y = -mb.L2 * e[5] + e[13];
      const z = -mb.L2 * e[6] + e[14];
      const sol = s.relief.hauteur(x, z);
      const d = y - sol;
      const m = parMembre[mb.nom];
      m.ech.push(d);
      if (d < 0.06) m.contacts++;
      if (d < mini) mini = d;
    }
    minCycle.push(mini);
  }

  /* Sur chaque demi-seconde, le sabot le plus bas doit avoir touche. Un
     animal qui flotte se reconnait a ce que ce minimum-la ne descend jamais. */
  let fenetresSansContact = 0, fenetres = 0;
  for (let i = 0; i + 30 <= minCycle.length; i += 30) {
    fenetres++;
    let m = Infinity;
    for (let k = i; k < i + 30; k++) if (minCycle[k] < m) m = minCycle[k];
    if (m > 0.10) fenetresSansContact++;
  }
  const out = { membres: {}, fenetres, fenetresSansContact };
  for (const k of Object.keys(parMembre)) {
    /* On rapporte des CENTILES, pas des extremes. Le minimum absolu sur une
       heure de marche tombe forcement sur un accident de terrain isole — le
       point ou la pente sous le sabot reel s'ecarte le plus de celle prise en
       compte par le rig. Le juger comme representatif ferait conclure a un
       defaut la ou il n'y a qu'une valeur aberrante. */
    const t = parMembre[k].ech.slice().sort((a, b) => a - b);
    const c = (p) => +t[Math.floor((t.length - 1) * p)].toFixed(3);
    out.membres[k] = {
      c01: c(0.01), c05: c(0.05), median: c(0.5), c99: c(0.99),
      mini: +t[0].toFixed(3),
      contacts: parMembre[k].contacts,
    };
  }
  return out;
});

console.log('hauteur du sabot au-dessus du sol, sur 60 s de marche :');
for (const [nom, v] of Object.entries(r.membres)) {
  /* Ce qu'on exige : le centile 5 doit etre AU CONTACT (le sabot descend
     vraiment), et ne pas s'enfoncer de plus de quinze centimetres — au-dela,
     le boulet disparaitrait sous la neige. */
  const ok = v.c05 < 0.06 && v.c05 > -0.15;
  if (!ok) erreurs++;
  console.log(`  ${ok ? 'ok ' : 'KO '} ${nom}  c5 ${v.c05} m · median ${v.median} m · c99 ${v.c99} m`
            + ` · mini ${v.mini} m · ${v.contacts} images au contact`);
}
const rythmeOk = r.fenetresSansContact === 0;
if (!rythmeOk) erreurs++;
console.log(`  ${rythmeOk ? 'ok ' : 'KO '} appui a chaque demi-seconde : ${r.fenetres - r.fenetresSansContact}/${r.fenetres}`);
console.log('erreurs :', erreurs);
await nav.close();
process.exit(erreurs ? 1 : 0);
