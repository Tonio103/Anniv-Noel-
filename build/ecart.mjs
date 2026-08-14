/* Rend visible l'ecart entre deux captures, amplifie. Un chiffre dit qu'il y
   a une difference ; seule l'image dit LAQUELLE. */

import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [f1, f2, sortie, gain] = process.argv.slice(2);
const G = Number(gain || 12);
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const nav = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await nav.newPage({ viewport: { width: 390, height: 844 } });
const b64 = (f) => 'data:image/png;base64,' + readFileSync(join(root, f)).toString('base64');

await page.evaluate(async ([s1, s2, g]) => {
  const lire = async (src) => {
    const im = new Image(); im.src = src; await im.decode();
    const cv = document.createElement('canvas');
    cv.width = im.width; cv.height = im.height;
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.drawImage(im, 0, 0);
    return { d: c.getImageData(0, 0, im.width, im.height), w: im.width, h: im.height };
  };
  const a = await lire(s1), b = await lire(s2);
  const cv = document.createElement('canvas');
  cv.width = a.w; cv.height = a.h;
  document.body.style.margin = '0';
  document.body.appendChild(cv);
  const c = cv.getContext('2d');
  const out = c.createImageData(a.w, a.h);
  for (let i = 0; i < a.d.data.length; i += 4) {
    const e = Math.max(Math.abs(a.d.data[i] - b.d.data[i]),
                       Math.abs(a.d.data[i + 1] - b.d.data[i + 1]),
                       Math.abs(a.d.data[i + 2] - b.d.data[i + 2]));
    const v = Math.min(255, e * g);
    out.data[i] = v; out.data[i + 1] = v * 0.4; out.data[i + 2] = 0; out.data[i + 3] = 255;
  }
  c.putImageData(out, 0, 0);
}, [b64(f1), b64(f2), G]);

await page.screenshot({ path: join(root, sortie) });
console.log('→', sortie, `(ecarts amplifies ×${G})`);
await nav.close();
