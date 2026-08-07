import { chromium } from 'playwright-core';
import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await build();
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const vp = process.env.MOB ? {width:390,height:800} : {width:900,height:560};
const page = await nav.newPage({ viewport: vp, deviceScaleFactor:1 });
page.on('pageerror', e=>console.log('ERR PAGE:', e.message));
page.on('console', m=>{ if(m.type()==='error' && !/ERR_CONNECTION/.test(m.text())) console.log('ERR:', m.text().slice(0,150)); });
await page.goto('file://'+join(root,'dist/experience.html')+'?debug=1&q='+(process.env.Q||'moyen'),{waitUntil:'load'});
await page.waitForFunction('window.__scene!==undefined',{timeout:120000});
const pref = process.env.MOB ? 'mob' : 'run';
// depart reel a la halte demandee, puis deroulement naturel des phases
const idx = Number(process.env.IDX||2);
await page.evaluate((i)=>{ window.__scene.aller(i); }, idx);
for (const [nom, sec] of JSON.parse(process.env.PLAN)) {
  await page.evaluate((s)=>window.__scene.simuler(s), sec);
  await page.waitForTimeout(2300);
  await page.screenshot({ path: join(root,`shots/${pref}-${nom}.png`) });
  console.log(' ->', nom, '| phase =', await page.evaluate(()=>window.__scene.phase()));
}
await nav.close();
