/* Loupe : recadre et agrandit une portion d'une capture, sans lissage, pour
   juger d'un detail que la vue d'ensemble ne permet pas de trancher. */

import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const [fichier, sx, sy, sw, sh, sortie, ech, large] = process.argv.slice(2);
const S = Number(ech || 2);
const L = Number(large || 1280);
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const nav = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await nav.newPage({ viewport: { width: +sw * S, height: +sh * S } });
const b64 = readFileSync(fichier).toString('base64');

await page.setContent(`<style>html,body{margin:0;padding:0}</style>
  <img id="i" src="data:image/png;base64,${b64}"
       style="position:absolute;image-rendering:pixelated;
              width:${L * S}px;
              left:${-sx * S}px; top:${-sy * S}px">`);
await page.waitForFunction('document.getElementById("i").complete');
await page.screenshot({ path: sortie });
await nav.close();
console.log('→', sortie);
