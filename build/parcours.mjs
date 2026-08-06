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

await page.goto('file://'+join(root,'dist/experience.html')+'?debug=1&q='+(process.env.Q||'moyen'),{waitUntil:'load'});
await page.waitForFunction('window.__scene!==undefined',{timeout:180000});
await page.click('#enterBtn');

const vues = [];
let secondes = 0;
for (let i = 0; i < 400 && vues.length < 9; i++) {
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
      if (vues.length === 1 || vues.length === 5 || vues.length === 9) {
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
await page.evaluate(()=>window.__scene.simuler(20));
await page.waitForTimeout(1800);
await page.screenshot({ path: join(root, `shots/${mobile?'mob':'pc'}-fin.png`) });
await nav.close();
