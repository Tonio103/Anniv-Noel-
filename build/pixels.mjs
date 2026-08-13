/* Lire des pixels dans une capture. Juger une couleur a l'oeil sur une image
   compressee dans un rapport de conversation, c'est deviner ; ici on lit la
   valeur. Usage : node build/pixels.mjs <png> x,y x,y ... */

import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const [fichier, ...pts] = process.argv.slice(2);
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const nav = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await nav.newPage();
const b64 = readFileSync(fichier).toString('base64');

const r = await page.evaluate(async ([src, points]) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const c = cv.getContext('2d');
  c.drawImage(img, 0, 0);
  return points.map((p) => {
    const [x, y] = p.split(',').map(Number);
    // Moyenne sur une petite fenetre : un pixel isole attrape un flocon.
    const d = c.getImageData(Math.max(0, x - 2), Math.max(0, y - 1), 5, 3).data;
    let R = 0, G = 0, B = 0;
    for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; }
    const n = d.length / 4;
    return { p, rgb: [R / n, G / n, B / n].map((v) => Math.round(v)) };
  });
}, ['data:image/png;base64,' + b64, pts]);

for (const l of r) console.log(`  ${l.p.padStart(9)}  rgb(${l.rgb.join(', ')})  #${l.rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`);
await nav.close();
