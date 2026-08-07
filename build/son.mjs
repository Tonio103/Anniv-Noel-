/* Verification du son.

   Le sound design etait une exigence explicite, et il n'avait jamais ete
   verifie autrement qu'en relisant le code. Or un graphe Web Audio peut etre
   parfaitement ecrit et ne rien produire : contexte suspendu, gain reste a
   zero, source jamais demarree, sortie branchee sur rien.

   On ne se contente donc pas de lire des drapeaux : on branche un analyseur
   sur le bus maitre et on MESURE le signal. Si la valeur efficace est nulle,
   il n'y a pas de son, quoi qu'en disent les booleens.

   Chromium sans carte son fonctionne : il route vers un puits silencieux mais
   le graphe tourne et l'analyseur voit passer les echantillons. */
import { chromium } from 'playwright-core';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await build();

const nav = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await nav.newPage({ viewport: { width: 1280, height: 720 } });
let erreurs = 0;
page.on('pageerror', (e) => { erreurs++; console.log('  ERR PAGE:', e.message); });

await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=moyen', { waitUntil: 'load' });
await page.waitForFunction('window.__scene!==undefined', { timeout: 180000 });

/* Le contexte audio ne peut naitre que d'un vrai geste : on clique. */
await page.click('#enterBtn');
await page.waitForTimeout(400);

const etat = await page.evaluate(() => {
  const s = window.__scene.son;
  return { pret: s.pret, etatCtx: s.ctx?.state || null, freq: s.ctx?.sampleRate || 0,
           volume: s.maitre?.gain.value ?? null };
});
console.log('contexte   :', etat.etatCtx, '| pret :', etat.pret,
            '|', etat.freq, 'Hz | gain maitre :', etat.volume?.toFixed(3));

/* On pose l'analyseur derriere le limiteur, donc apres tout le melange, et on
   compte au passage les declenchements de bruitages. */
await page.evaluate(() => {
  const s = window.__scene.son, sfx = window.__scene.sfx;
  const a = s.ctx.createAnalyser();
  a.fftSize = 2048;
  s.limiteur.connect(a);
  window.__an = a;
  window.__buf = new Float32Array(a.fftSize);
  window.__compte = { sabot: 0, grelots: 0, grondement: 0, ouverture: 0, gerbe: 0 };
  for (const nom of Object.keys(window.__compte)) {
    const orig = sfx[nom].bind(sfx);
    sfx[nom] = (...args) => { window.__compte[nom]++; return orig(...args); };
  }
  window.__rms = () => {
    window.__an.getFloatTimeDomainData(window.__buf);
    let s2 = 0;
    for (let i = 0; i < window.__buf.length; i++) s2 += window.__buf[i] * window.__buf[i];
    return Math.sqrt(s2 / window.__buf.length);
  };
});

/* La montee du bus maitre dure 3,2 s : on echantillonne pendant ce temps pour
   voir le niveau s'installer, et non un unique instantane qui pourrait tomber
   sur un silence. */
const niveaux = [];
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(450);
  await page.evaluate(() => window.__scene.simuler(0.9));
  niveaux.push(await page.evaluate(() => window.__rms()));
}
console.log('niveau ambiance (rms) :', niveaux.map((v) => v.toFixed(4)).join(' '));
const creteAmbiance = Math.max(...niveaux);

/* Les sabots : ils doivent etre declenches par les posers reels du cycle de
   marche, pas par un minuteur. On avance donc la simulation et on compte. */
const avant = await page.evaluate(() => ({ ...window.__compte }));
await page.evaluate(() => window.__scene.simuler(12));
await page.waitForTimeout(600);
const apres = await page.evaluate(() => ({ ...window.__compte }));
const pas12s = apres.sabot - avant.sabot;
console.log('sabots sur 12 s de marche :', pas12s, '| grelots :', apres.grelots - avant.grelots);

/* Un cadeau qui sort de la neige : grondement puis gerbe. */
await page.evaluate(() => window.__scene.aller(2));
await page.evaluate(() => window.__scene.simuler(26));
await page.waitForTimeout(400);
const halte = await page.evaluate(() => ({ ...window.__compte, phase: window.__scene.phase() }));
console.log('a la halte :', 'grondement', halte.grondement, '| gerbe', halte.gerbe,
            '| phase', halte.phase);

/* L'ouverture du paquet, declenchee par le geste du visiteur. */
if (halte.phase === 'attente') {
  await page.evaluate(() => document.getElementById('gl').dispatchEvent(new PointerEvent('pointerdown')));
  await page.evaluate(() => window.__scene.simuler(3));
}
await page.waitForTimeout(500);
const cretes = [];
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(180);
  cretes.push(await page.evaluate(() => window.__rms()));
}
const fin = await page.evaluate(() => ({ ...window.__compte }));
console.log('ouverture :', fin.ouverture, '| niveau apres ouverture :',
            cretes.map((v) => v.toFixed(4)).join(' '));

/* --- verdict ------------------------------------------------------------- */
const ok = [];
const ko = [];
(etat.etatCtx === 'running' ? ok : ko).push('contexte audio en marche');
(etat.pret ? ok : ko).push('moteur pret');
(creteAmbiance > 0.0005 ? ok : ko).push('ambiance audible (rms ' + creteAmbiance.toFixed(4) + ')');
(pas12s >= 8 ? ok : ko).push('sabots synchronises (' + pas12s + ' sur 12 s)');
(apres.grelots - avant.grelots > 0 ? ok : ko).push('grelots');
(halte.grondement > 0 ? ok : ko).push('grondement d\'emergence');
(halte.gerbe > 0 ? ok : ko).push('gerbe de poudreuse');
(fin.ouverture > 0 ? ok : ko).push('ouverture du paquet');

console.log('\n  OK  : ' + ok.join(' · '));
if (ko.length) console.log('  KO  : ' + ko.join(' · '));
console.log('erreurs :', erreurs);
await nav.close();
process.exit(ko.length || erreurs ? 1 : 0);
