/* Chiffre dist/experience.html dans index.html.
   AES-256-GCM · PBKDF2-SHA256 1 000 000 iterations · DEFLATE avant chiffrement
   · rembourrage aleatoire · sel et IV authentifies en AAD.

   Le mot de passe n'est jamais ecrit dans le depot : il est lu dans la
   variable d'environnement NOEL_CODE.
       NOEL_CODE="<le code>" npm run build
*/

import { readFile, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { randomBytes, pbkdf2Sync, createCipheriv } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ITER = 1_000_000;

const code = (process.env.NOEL_CODE || '').trim().toUpperCase();
if (!code) {
  console.error('NOEL_CODE manquant.  Exemple :\n  NOEL_CODE="VOTRE-CODE" npm run build');
  process.exit(1);
}

const doc = await readFile(join(root, 'dist/experience.html'));
const packed = deflateSync(doc, { level: 9 });

/* 4 octets de longueur reelle, puis le contenu, puis du rembourrage aleatoire :
   la taille du fichier publie ne trahit pas la taille du contenu. */
const pad = randomBytes(2048 + Math.floor(Math.random() * 4096));
const head = Buffer.alloc(4);
head.writeUInt32BE(packed.length, 0);
const plain = Buffer.concat([head, packed, pad]);

const salt = randomBytes(16);
const iv = randomBytes(12);
const key = pbkdf2Sync(code, salt, ITER, 32, 'sha256');

const cipher = createCipheriv('aes-256-gcm', key, iv);
cipher.setAAD(Buffer.concat([salt, iv]));
const body = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);

const gate = await readFile(join(root, 'build/gate.template.html'), 'utf8');
const out = gate
  .replace('__SALT__', salt.toString('base64'))
  .replace('__IV__', iv.toString('base64'))
  .replace('__ITER__', String(ITER))
  .replace('__DATA__', body.toString('base64'));

await writeFile(join(root, 'index.html'), out);

const kb = (n) => (n / 1024).toFixed(1) + ' Ko';
console.log(
  `index.html — ${kb(out.length)}  (experience ${kb(doc.length)} → deflate ${kb(packed.length)})`
);
