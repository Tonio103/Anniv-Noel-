/* OU VIT LA FAUNE.

   PREMIERE IDEE, ABANDONNEE : LES SILENCES. Le chemin est tres occupe —
   neuf haltes, dix apparitions, un ruisseau — et poser un envol de
   passereaux au milieu d'une scene de film, c'est deux evenements a la fois.
   On calculait donc les intervalles du parcours ou il ne se passe rien, et on
   y semait les rencontres.

   Les captures au format du telephone ont tranche. Une fois comptee la
   fenetre ou chaque chose est reellement A L'IMAGE — une apparition se voit
   bien avant son ancrage, le cadre portrait ne fait que trente-trois degres
   de large — il ne restait que des trous d'un a quatre metres. Semee dans
   ces trous, la faune tombait soit hors champ, soit en meme temps qu'un
   Spider-Man, et le lievre, blanc sur blanc a vingt metres, n'existait pas.

   LA FAUNE VIT DONC AUX HALTES. C'est la que la camera s'attarde, tourne,
   se rapproche du sol ; c'est la que l'attention est disponible, parce que
   rien d'autre ne bouge pendant la lecture d'une carte. Et c'est la qu'un
   animal a une raison d'etre :

   · les bouvreuils picorent a l'endroit ou le cerf va creuser — les graines
     tombees des sapins se ramassent justement la ou la neige est remuee — et
     s'envolent a son arrivee. Premier cadeau, et seconde clairiere ;
   · la chouette, sur un chicot en lisiere de la premiere clairiere, suit du
     regard le drone qui orbite pendant la lecture, puis traverse quand le
     cerf repart ;
   · le lievre, tapi un peu plus loin que le dernier cadeau, reste fige tant
     que le cerf est immobile — c'est ce que fait un lievre — et detale quand
     il se remet en marche.

   Les haltes sont designees par leur GENRE (premier cadeau, derniere
   clairiere...), pas par leur numero : si l'on ajoute une halte, la
   chouette reste sur la premiere clairiere. Tout le tirage est reproductible
   (graine fixe) : la meme foret a chaque visite, et le meme lievre a sa
   meme remise. */

import { rng } from '../../core/noise.js';

/* Le poste de chaque espece autour de sa halte.

   `avance` : ou, le long du chemin, par rapport a l'endroit ou le cerf
   s'arrete. `cote` : +1 est le cote du drone (et du cadeau, qui se pose
   toujours face a l'objectif), -1 le cote oppose.

   · Bouvreuils : deux metres et demi au-dela de l'arret, du cote OPPOSE au
     drone. Le drone, decale sur la droite, vise le cerf : son axe continue
     vers la gauche du chemin, donc c'est la que tombe le fond du cadre. Du
     cote du drone, ils s'envoleraient vers l'objectif et sortiraient du champ
     en une image ; du cote oppose, on les voit partir vers le fond.
   · Lievre : huit metres au-dela, du cote du drone. Il faut qu'il soit HORS
     de sa distance de fuite quand le cerf s'arrete (sept metres), sinon il
     partirait pendant la halte, dans le dos de la camera qui regarde le
     cadeau ; et le plus pres possible, pour qu'a la reprise il soit grand
     dans le cadre : a onze metres, il n'y faisait qu'une vingtaine de
     pixels. Il traverse alors devant le cerf, de droite a gauche.
   · Chouette : huit metres au-dela, du cote oppose. Pendant la halte, le
     drone tourne autour du cerf depuis la droite : le chicot est dans le
     fond du plan, un peu sur le cote pour que le cerf ne le masque pas. */
export const POSTES = {
  passereaux: { avance: 2.5, cote: -1 },
  lievre: { avance: 8, cote: 1 },
  chouette: { avance: 8, cote: -1 },
};

/* Quelle rencontre a quelle halte. `rang` compte dans les haltes de ce
   genre, et -1 designe la derniere.

   Le choix a ete fait halte par halte, en regardant ce qui est a l'image a
   ce moment-la (build/faune.mjs le reverifie) :

   · premier cadeau — Spider-Man attend quinze metres plus loin, mais
     l'envol se joue AVANT l'arret, et l'araignee n'occupe l'attention
     qu'apres ;
   · deuxieme et troisieme cadeaux, quatrieme : une apparition se joue
     pendant l'approche ou pendant la halte elle-meme — on n'y ajoute rien ;
   · dernier cadeau — la scene du film se referme a l'arrivee, le chemin est
     libre sur vingt-cinq metres apres : le lievre y est seul ;
   · premiere clairiere — l'apparition suivante est a vingt-cinq metres :
     la chouette a le temps de traverser ;
   · seconde clairiere — l'envol precede de peu le trou noir, qui ne s'ouvre
     qu'une fois le cerf reparti. */
const PLAN = [
  { espece: 'passereaux', genre: 'gift', rang: 0 },
  { espece: 'lievre', genre: 'gift', rang: -1 },
  { espece: 'chouette', genre: 'clearing', rang: 0 },
  { espece: 'passereaux', genre: 'clearing', rang: 1 },
];

/* Les sites, en abscisse le long du chemin.

   `stations` : le contenu des haltes, dans l'ordre de `chemin.haltes`. Un
   genre absent (moins de clairieres que prevu, par exemple) ne pose
   simplement pas la rencontre : il vaut mieux une chouette de moins qu'une
   chouette posee au mauvais endroit. */
export function repartir(chemin, stations, graine = 20261128) {
  const rand = rng(graine);
  const sites = [];
  for (const r of PLAN) {
    const rangs = [];
    stations.forEach((st, i) => { if (st.kind === r.genre && chemin.haltes[i]) rangs.push(i); });
    const i = rangs[r.rang < 0 ? rangs.length + r.rang : r.rang];
    if (i === undefined) continue;
    const poste = POSTES[r.espece];
    const sHalte = chemin.haltes[i].s;
    sites.push({
      espece: r.espece, halte: i, sHalte,
      s: sHalte + poste.avance, cote: poste.cote, alea: rand(),
    });
  }
  return sites.sort((x, y) => x.s - y.s);
}
