/* Parcourt la balade entiere de bout en bout, comme le ferait un visiteur :
   on avance en temps simule, on touche quand l'invite apparait, on referme
   chaque carte. Verifie qu'aucune halte ne bloque et que les neuf cartes
   passent bien. */
import { chromium } from 'playwright-core';
import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await build();

const mobile = !!process.env.MOB;
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const page = await nav.newPage({
  viewport: mobile ? {width:390,height:800} : {width:1280,height:720},
  deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile,
});
let erreurs = 0;
page.on('pageerror', e=>{ erreurs++; console.log('  ERR PAGE:', e.message); });
page.on('console', m=>{ if(m.type()==='error' && !/ERR_CONNECTION|fonts|favicon/.test(m.text())) { erreurs++; console.log('  ERR:', m.text().slice(0,140)); } });

await page.goto('file://'+join(root,'dist/experience.html')+'?debug=1&q='+(process.env.Q||'moyen'),{waitUntil:'load', timeout:180000});
/* Le delai par defaut de Playwright est de trente secondes ; en rendu
   logiciel, la page met de trente a quarante secondes a se charger, pour
   l'essentiel a compiler ses nuanceurs. Le test echouait donc au chargement
   selon la charge de la machine, ce qui n'apprend rien sur la balade. */
await page.waitForFunction('window.__scene!==undefined',{timeout:180000});
await page.click('#enterBtn');

const vues = [];
let secondes = 0;
/* COMBIEN DE CARTES ATTENDRE ? On le DEMANDE a la page, on ne l'ecrit pas.
   Ce nombre etait fige a neuf. Le jour ou une idee a ete retiree de la liste,
   la boucle a continue de tourner en esperant une neuvieme carte qui
   n'existait plus — six cents secondes de simulation, bien au-dela de la fin
   de la balade, si bien que l'adieu du cerf avait eu lieu et etait termine
   avant meme le premier releve. Le test annoncait alors « AUCUN ADIEU » pour
   un adieu parfaitement joue. */
const attendues = await page.evaluate(
  () => window.__scene.stations.filter((st) => st.card).length);
for (let i = 0; i < 400 && vues.length < attendues; i++) {
  const etat = await page.evaluate(() => {
    const s = window.__scene;
    s.simuler(1.5);
    const carteVisible = !document.getElementById('card').hidden;
    return { phase: s.phase(), carte: carteVisible,
             titre: document.getElementById('cardTitle')?.textContent || null };
  });
  secondes += 1.5;
  if (etat.phase === 'attente') {
    await page.evaluate(() => document.getElementById('gl').dispatchEvent(new PointerEvent('pointerdown')));
  } else if (etat.phase === 'lecture' && etat.carte && etat.titre) {
    if (vues[vues.length-1] !== etat.titre) {
      vues.push(etat.titre);
      if (vues.length === 1 || vues.length === Math.ceil(attendues / 2) || vues.length === attendues) {
        await page.waitForTimeout(1800);
        await page.screenshot({ path: join(root, `shots/${mobile?'mob':'pc'}-carte-${vues.length}.png`) });
      }
    }
    await page.evaluate(() => document.getElementById('cardNext').click());
  }
}
console.log('cartes vues (' + vues.length + ') :');
vues.forEach((v,i)=>console.log('  ' + (i+1) + '. ' + v));
console.log('temps simule :', Math.round(secondes) + ' s | erreurs :', erreurs);
console.log('phase finale :', await page.evaluate(()=>window.__scene.phase()));

/* LA FIN. Elle se joue en quatre temps sur une douzaine de secondes : on
   avance par paliers et on releve ce qui doit s'etre produit a chaque fois. */
const etapes = [];
for (const [s, quoi] of [[3, 'ralentit'], [4, 'adieu'], [4, 'camera posee'], [4, 'texte']]) {
  /* ON RELEVE LE MAXIMUM SUR L'INTERVALLE, PAS LA VALEUR A L'INSTANT.
     L'adieu du cerf dure une seconde ou deux ; l'echantillonner a quatre
     instants fixes revient a esperer tomber dessus. Le test l'a signale
     absent le jour ou la balade a raccourci d'une halte — alors qu'il avait
     bien eu lieu, simplement plus tot. Un evenement bref se mesure sur une
     fenetre. */
  await page.evaluate((s2) => {
    const sc = window.__scene;
    sc.regardMax = Math.max(sc.regardMax || 0, sc.cerf.regard);
    for (let i = 0; i < s2 * 60; i++) {
      sc.simuler(1 / 60);
      sc.regardMax = Math.max(sc.regardMax, sc.cerf.regard);
    }
  }, s);
  etapes.push(await page.evaluate((q) => {
    const s = window.__scene;
    return { quoi: q, phase: s.phase(),
             regard: +(s.regardMax || 0).toFixed(2),
             vitesse: +s.cerf.vitesseCible.toFixed(2),
             figee: !!s.drone.fige,
             outro: !document.getElementById('outro').hidden };
  }, quoi));
}
for (const e of etapes) {
  console.log(`  ${e.quoi.padEnd(12)} phase=${e.phase} regard=${e.regard} v=${e.vitesse} camera_posee=${e.figee} texte=${e.outro}`);
}
const der = etapes[etapes.length-1];
const adieu = etapes.some(e=>e.regard > 0.4);
console.log('fin :', [
  adieu ? 'il se retourne' : 'AUCUN ADIEU',
  der.figee ? 'camera posee' : 'CAMERA TOUJOURS EN POURSUITE',
  der.outro ? 'texte affiche' : 'PAS DE TEXTE',
].join(' · '));
if (!adieu || !der.figee || !der.outro) erreurs++;

/* Le rendu logiciel ne fait jamais avancer la timeline des animations CSS :
   getAnimations() les donne "running" avec currentTime bloque a zero, si bien
   que TOUT ce qui apparait en fondu — l'ecran d'entree comme le texte de fin —
   reste a l'opacite zero sur les captures. Ce n'est pas un defaut de la page,
   c'est le compositeur qui ne commet aucune image de lui-meme.
   On avance donc les animations a la main avant de photographier. */
await page.evaluate(()=>window.__scene.simuler(6));
await page.waitForTimeout(2500);
const opac = await page.evaluate(()=>getComputedStyle(document.getElementById('outro')).opacity);
console.log('opacite du texte de fin :', opac);
if (Number(opac) < 0.9) { console.log('  ERR: le texte de fin ne s\'affiche pas'); erreurs++; }
await page.screenshot({ path: join(root, `shots/${mobile?'mob':'pc'}-fin.png`) });

/* Le retour : le bouton doit vraiment relancer la balade sur place. */
await page.click('#outroAgain');
await page.evaluate(()=>window.__scene.simuler(3));
const apres = await page.evaluate(()=>({
  phase: window.__scene.phase(),
  s: Math.round(window.__scene.cerf.s),
  figee: !!window.__scene.drone.fige,
}));
console.log('retour :', JSON.stringify(apres));
if (apres.phase !== 'route' || apres.figee || apres.s > 60) {
  console.log('  ERR: le retour ne relance pas la balade');
  erreurs++;
}
console.log('erreurs totales :', erreurs);
await nav.close();
process.exit(erreurs ? 1 : 0);
