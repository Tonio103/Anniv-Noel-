/* LA VIGIE REND-ELLE CE QU'ELLE A PRIS ?

   Elle baisse la densite de pixels quand ca rame — ca, on l'a vu marcher.
   Mais la remontee, elle, n'avait jamais ete vue fonctionner une seule fois,
   et pour cause : son seuil etait un nombre ABSOLU (13,5 ms, soit 74 images
   par seconde) alors que `dt` n'est pas le temps de travail d'une image mais
   l'INTERVALLE entre deux images livrees — cale sur la synchronisation
   verticale de l'ecran. Sur un ecran 60 Hz cet intervalle vaut 16,7 ms quoi
   qu'il arrive, meme sur une machine qui n'utilise qu'un dixieme de son
   budget. Le seuil etait donc hors d'atteinte sur la quasi-totalite des
   appareils, et toute densite perdue l'etait pour de bon.

   Deux choses a distinguer, parce qu'elles n'ont pas le meme statut :

   · une RETROGRADATION DE PALIER est definitive, et c'est voulu (voir le
     commentaire de `Vigie`) — repasser d'un palier a l'autre se verrait
     beaucoup trop ;
   · une BAISSE DE DENSITE a l'interieur du palier, elle, doit se rendre des
     que l'appareil respire. C'est ce que ce banc verifie.

   Aucun navigateur ici : la vigie est une machine a etats qui ne consomme
   que des deltas. On lui joue des scenarios de trames et on regarde ce
   qu'elle decide — reproductible a la milliseconde. */

import { Vigie, PALIERS } from '../src/core/quality.js';

globalThis.window = globalThis.window || { devicePixelRatio: 3 };

const PERIODE = { '60 Hz': 1 / 60, '90 Hz': 1 / 90, '120 Hz': 1 / 120 };

function jouer({ hz = '60 Hz', depart = 'bas', dpr, scenario, secondes = 120 }) {
  const p = PERIODE[hz];
  let palier = { ...PALIERS[depart], mobile: true };
  if (dpr !== undefined) palier.dpr = dpr;
  const v = new Vigie(palier, (q) => { palier = q; });
  const journal = [];
  let t = 0, prec = palier.dpr;
  while (t < secondes) {
    // Le scenario recoit la densite COURANTE : c'est indispensable pour
    // decrire une machine dont la cadence depend de ce qu'on lui demande.
    const dt = scenario(t, p, palier.dpr);
    v.tic(dt);
    if (Math.abs(palier.dpr - prec) > 0.001) {
      journal.push({ t: +t.toFixed(1), dpr: +palier.dpr.toFixed(3) });
      prec = palier.dpr;
    }
    t += dt;
  }
  return { dpr: +palier.dpr.toFixed(3), nom: palier.nom, journal, figee: v.figee,
           periode: +v.periode.toFixed(2) };
}

const lent = 0.033;                       // ~30 im/s : la vigie doit reagir
const cas = [];
let echecs = 0;
const dire = (bon, texte) => { console.log(`   ${bon ? 'OK ' : 'KO '} ${texte}`); if (!bon) echecs++; };

/* ---------------------------------------------------------------------------
   1. LE CAS QUI ETAIT CASSE : au palier bas, la densite est rognee par une
   periode de rame, puis l'appareil respire. Elle doit revenir a son nominal.
   A 60 Hz, l'ancien seuil absolu de 13,5 ms l'interdisait purement et
   simplement. --------------------------------------------------------------- */
for (const hz of ['60 Hz', '90 Hz', '120 Hz']) {
  const r = jouer({ hz, depart: 'bas', dpr: 1.6,
                    scenario: (t, p) => (t < 26 ? lent : p) });
  console.log(`\n1. rame 26 s puis l'appareil respire — ${hz}`);
  console.log(`   ${r.journal.map((e) => `${e.t}s→${e.dpr}`).join('  ') || 'aucun changement'}`);
  console.log(`   densite finale ${r.dpr} · periode estimee ${r.periode} ms`);
  dire(r.journal.some((e) => e.dpr < 1.59), 'la densite a bien baisse pendant la rame');
  dire(r.dpr > 1.59, 'elle est revenue a son nominal une fois la rame passee');
}

/* ---------------------------------------------------------------------------
   2. Machine confortable depuis le debut : on ne doit RIEN toucher. --------- */
{
  const r = jouer({ depart: 'moyen', scenario: (t, p) => p });
  console.log('\n2. machine confortable depuis le debut — 60 Hz');
  console.log(`   ${r.journal.length ? r.journal.map((e) => `${e.t}s→${e.dpr}`).join('  ') : 'aucun changement'}`);
  dire(r.journal.length === 0, 'rien n\'a bouge');
}

/* ---------------------------------------------------------------------------
   3. Machine durablement trop lente : elle descend, et une fois au plancher
   elle s'y tient — sans jamais osciller. ----------------------------------- */
{
  const r = jouer({ depart: 'bas', dpr: 1.6, scenario: () => lent });
  console.log('\n3. machine durablement trop lente — 60 Hz');
  console.log(`   ${r.journal.map((e) => `${e.t}s→${e.dpr}`).join('  ')}`);
  const remontees = r.journal.filter((e, i) => i && e.dpr > r.journal[i - 1].dpr).length;
  dire(r.dpr <= 1.001, 'elle est descendue jusqu\'au plancher de 1,0');
  dire(remontees === 0, 'aucune remontee pendant qu\'elle rame');
}

/* ---------------------------------------------------------------------------
   4. LE CAS QUI FERAIT OSCILLER UN REGULATEUR NAIF : la machine tient la
   cadence a densite reduite, mais rame des qu'on la remonte. On accepte UN
   aller-retour — il faut bien essayer pour savoir — mais pas deux. -------- */
{
  const r = jouer({
    depart: 'bas', dpr: 1.6, secondes: 240,
    // La machine ne tient la cadence qu'en dessous de 1,2 de densite : des
    // qu'on la remonte au-dessus, elle rame de nouveau.
    scenario: (t, p, dpr) => (dpr > 1.2 ? lent : p),
  });
  console.log('\n4. tient la cadence a densite reduite, rame des qu\'on remonte');
  console.log(`   ${r.journal.map((e) => `${e.t}s→${e.dpr}`).join('  ')}`);
  console.log(`   figee : ${r.figee}`);
  const remontees = r.journal.filter((e, i) => i && e.dpr > r.journal[i - 1].dpr).length;
  dire(remontees >= 1, `elle a bien tente de rendre la densite (${remontees})`);
  dire(remontees <= 1, 'elle n\'a pas recommence : pas d\'oscillation');
  dire(r.figee, 'le verrou est pose apres l\'aller-retour');
}

console.log('\nechecs :', echecs);
process.exit(echecs ? 1 : 0);
