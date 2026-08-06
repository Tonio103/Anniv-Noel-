/* Verification de bout en bout : on ouvre index.html tel qu'il sera publie,
   on saisit le code, et on s'assure que l'experience demarre vraiment. */
import { chromium } from 'playwright-core';
import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = process.env.NOEL_CODE;
if (!code) { console.error('NOEL_CODE manquant'); process.exit(1); }

const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const page = await nav.newPage({ viewport:{width:900,height:560} });
page.on('pageerror', e=>console.log('  ERR PAGE:', e.message));
page.on('console', m=>{ if(m.type()==='error' && !/ERR_CONNECTION|fonts/.test(m.text())) console.log('  ERR:', m.text().slice(0,140)); });

await page.goto('file://'+join(root,'index.html'), {waitUntil:'load'});
console.log('titre du coffre :', await page.title());

// mauvais code d'abord
await page.fill('#pw','MAUVAIS-CODE'); await page.click('#go');
await page.waitForTimeout(9000);
console.log('mauvais code -> erreur affichee :', await page.evaluate(()=>document.getElementById('err')?.classList.contains('on')));

await page.reload({waitUntil:'load'});
await page.fill('#pw', code);
await page.click('#go');
await page.waitForFunction('window.__scene!==undefined || document.getElementById("gl")!==null', {timeout:180000});
await page.waitForFunction('window.__scene!==undefined', {timeout:180000});
const info = await page.evaluate(()=>({
  titre: document.title,
  palier: window.__scene.palier.nom,
  arbres: window.__scene.foret.nbArbres,
  chemin: Math.round(window.__scene.chemin.longueur),
  seuil: !document.getElementById('entry').hidden,
}));
console.log('experience dechiffree :', JSON.stringify(info));

// franchir le seuil : demarre le son et la balade
await page.click('#enterBtn');
await page.waitForTimeout(1500);
await page.evaluate(()=>window.__scene.simuler(14));
await page.waitForTimeout(2500);
await page.screenshot({ path: join(root,'shots/verif-apres-code.png') });
console.log('phase apres 14 s :', await page.evaluate(()=>window.__scene.phase()));
await nav.close();
