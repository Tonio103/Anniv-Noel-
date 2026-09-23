/* Chiffre dist/experience.html dans index.html.
   AES-256-GCM · PBKDF2-SHA256 1 000 000 iterations · DEFLATE avant chiffrement
   · rembourrage aleatoire · sel et IV authentifies en AAD.

   L'ACCES SE FAIT PAR ADRESSE E-MAIL, ET NON PAR UN CODE PARTAGE.

   Le contenu est chiffre UNE SEULE FOIS avec une cle de contenu tiree au
   hasard. Cette cle est ensuite emballee separement pour chaque adresse
   autorisee : `emballage_i = AES-GCM(PBKDF2(adresse_i), cle_de_contenu)`.
   Le visiteur tape son adresse, le navigateur en derive une cle et essaie
   chaque emballage ; le sceau d'authentification de GCM dit lequel s'ouvre,
   sans qu'aucune comparaison explicite soit necessaire.

   Trois consequences qui valaient qu'on procede ainsi :

   · LES ADRESSES NE SONT PAS DANS LE FICHIER. On n'y trouve que des
     emballages indechiffrables — pas les adresses, pas leurs empreintes.
     La page ne dit donc pas qui est invite, meme a qui sait l'ouvrir.
   · Le cout pour le visiteur ne depend pas du nombre d'invites : une seule
     derivation PBKDF2, puis quelques dechiffrements AES negligeables.
   · Le nombre d'invites est masque par des emballages leurres, qui ne
     s'ouvrent jamais et sont indiscernables des vrais.

   CE QUE CELA NE PROTEGE PAS. Une adresse e-mail n'est pas un secret :
   c'est un nom. Quiconque connait une adresse invitee peut ouvrir la page.
   Le million d'iterations rend couteuse la recherche d'une adresse INCONNUE,
   pas la saisie d'une adresse connue. C'est donc une porte qui dit « c'est
   pour toi », pas une serrure — et c'est plus faible qu'un code tire au
   hasard que personne ne devine. Pour une liste d'anniversaire en famille,
   c'est le bon compromis ; il ne faudrait pas en attendre davantage.

   Les adresses ne sont jamais ecrites dans le depot : elles sont lues dans
   la variable d'environnement NOEL_EMAILS, separees par des virgules.
       NOEL_EMAILS="un@exemple.fr, deux@exemple.fr" npm run build
*/

import { readFile, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { randomBytes, pbkdf2Sync, createCipheriv } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ITER = 1_000_000;
const LEURRES = 16;      // taille apparente de la liste d'invites

/* La meme normalisation ici et dans la page, sans quoi une adresse tapee
   avec une majuscule ne retomberait pas sur la bonne cle. On se limite a
   ce qui est sur : espaces en trop et casse. On ne touche NI aux points du
   nom, NI aux suffixes en « + » — certains fournisseurs les ignorent,
   d'autres non, et « corriger » l'adresse de quelqu'un serait le meilleur
   moyen de lui fermer la porte au nez. */
const normaliser = (a) => a.trim().toLowerCase();

const adresses = (process.env.NOEL_EMAILS || '')
  .split(/[,;\n]+/)
  .map(normaliser)
  .filter(Boolean);

if (!adresses.length) {
  console.error('NOEL_EMAILS manquant.  Exemple :\n'
    + '  NOEL_EMAILS="un@exemple.fr, deux@exemple.fr" npm run build');
  process.exit(1);
}
const douteuses = adresses.filter((a) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a));
if (douteuses.length) {
  console.error('Ces adresses ne ressemblent pas a des adresses e-mail :\n  '
    + douteuses.join('\n  ')
    + '\nUne faute de frappe ici ferme la porte a quelqu un sans que rien ne le signale.');
  process.exit(1);
}
const uniques = [...new Set(adresses)];

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

/* La cle de contenu : tiree au hasard, elle n'est derivee de rien et ne
   ressemble a rien. C'est elle, et non une adresse, qui chiffre la page. */
const cleContenu = randomBytes(32);

const cipher = createCipheriv('aes-256-gcm', cleContenu, iv);
cipher.setAAD(Buffer.concat([salt, iv]));
const body = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);

/* Un emballage de la cle de contenu par adresse autorisee. Le sel est commun
   a tout le lot : il est tire au hasard a chaque construction, ce qui suffit
   a interdire les tables precalculees, et il permet au visiteur de ne payer
   qu'UNE seule derivation quel que soit le nombre d'invites. */
const emballer = (adresse) => {
  const k = pbkdf2Sync(adresse, salt, ITER, 32, 'sha256');
  const ivw = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', k, ivw);
  c.setAAD(Buffer.concat([salt, ivw]));
  const w = Buffer.concat([c.update(cleContenu), c.final(), c.getAuthTag()]);
  return { iv: ivw.toString('base64'), w: w.toString('base64') };
};

const vrais = uniques.map(emballer);

/* Les leurres : du bruit de la meme taille exacte qu'un vrai emballage
   (32 octets de cle + 16 de sceau). Ils ne s'ouvrent jamais, et rien ne les
   distingue des vrais — le fichier ne dit donc pas combien de personnes
   sont invitees. */
const leurres = Array.from({ length: Math.max(0, LEURRES - vrais.length) }, () => ({
  iv: randomBytes(12).toString('base64'),
  w: randomBytes(48).toString('base64'),
}));

/* Melange : sans cela, les vrais emballages occuperaient les premieres
   places et leur nombre se lirait a l'oeil. */
const lot = [...vrais, ...leurres];
for (let i = lot.length - 1; i > 0; i--) {
  const j = randomBytes(1)[0] % (i + 1);
  [lot[i], lot[j]] = [lot[j], lot[i]];
}

const gate = await readFile(join(root, 'build/gate.template.html'), 'utf8');
const out = gate
  .replace('__SALT__', salt.toString('base64'))
  .replace('__IV__', iv.toString('base64'))
  .replace('__ITER__', String(ITER))
  .replace('__KEYS__', JSON.stringify(lot))
  .replace('__DATA__', body.toString('base64'));

await writeFile(join(root, 'index.html'), out);

const kb = (n) => (n / 1024).toFixed(1) + ' Ko';
console.log(
  `index.html — ${kb(out.length)}  (experience ${kb(doc.length)} → deflate ${kb(packed.length)})`
);
console.log(
  `${vrais.length} adresse${vrais.length > 1 ? 's' : ''} autorisee${vrais.length > 1 ? 's' : ''}`
  + `, noyee${vrais.length > 1 ? 's' : ''} dans ${lot.length} emballages.`
);
