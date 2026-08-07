/* Le seuil est-il lisible ?

   C'est le seul ecran que TOUTE la famille verra, et il portait la fragilite
   la plus couteuse du fichier : titre, texte et bouton d'entree etaient tous
   declares transparents et ne devenaient visibles qu'une fois une animation
   CSS terminee. Si l'animation ne se joue pas — ou pire, si elle demarre et
   que son horloge n'avance pas — la page est noire et personne ne peut
   entrer.

   Cet environnement reproduit exactement ce cas : le compositeur ne commet
   aucune image de lui-meme, donc la timeline d'animation reste a zero. Il
   sert donc de banc d'essai ideal pour le filet de securite. */
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
const page = await nav.newPage({ viewport: { width: 1100, height: 700 } });
let erreurs = 0;
page.on('pageerror', (e) => { erreurs++; console.log('  ERR:', e.message); });
await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=moyen', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.__scene!==undefined', { timeout: 180000 });

// Le filet se declenche a trois secondes : on lui laisse le temps.
await page.waitForTimeout(4500);

const r = await page.evaluate(() => {
  const lire = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const cs = getComputedStyle(e);
    const b = e.getBoundingClientRect();
    return { opacite: +Number(cs.opacity).toFixed(2), largeur: b.width | 0, haut: b.height | 0,
             texte: (e.textContent || '').trim().slice(0, 34) };
  };
  return {
    entryCache: document.getElementById('entry').hidden,
    titre: lire('.entry-title'),
    occasion: lire('.entry-occasion'),
    bouton: lire('#enterBtn'),
    note: lire('.entry-note'),
  };
});

console.log('ecran du seuil, 4,5 s apres chargement :');
for (const clef of ['titre', 'occasion', 'bouton', 'note']) {
  const v = r[clef];
  const ok = v && v.opacite > 0.9 && v.largeur > 0 && v.haut > 0;
  if (!ok) erreurs++;
  console.log(`  ${ok ? 'ok ' : 'KO '} ${clef.padEnd(9)} opacite ${v?.opacite} · ${v?.largeur}x${v?.haut} · « ${v?.texte} »`);
}

await page.screenshot({ path: join(root, 'shots/seuil.png') });

/* Et il doit rester cliquable : un ecran visible mais inerte ne vaut pas
   mieux qu'un ecran noir. */
await page.click('#enterBtn');
await page.waitForTimeout(600);
const entre = await page.evaluate(() => window.__scene.phase());
const clicOk = entre === 'route';
if (!clicOk) erreurs++;
console.log(`  ${clicOk ? 'ok ' : 'KO '} le bouton fait entrer (phase = ${entre})`);
console.log('erreurs :', erreurs);
await nav.close();
process.exit(erreurs ? 1 : 0);
