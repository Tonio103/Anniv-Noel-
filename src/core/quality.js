/* Paliers de qualite.

   La page sera ouverte sur des appareils inconnus — un telephone de 2019
   comme un PC de jeu. On choisit un palier de depart d'apres ce que la
   machine annonce, puis on surveille le temps de trame et on redescend
   si ca rame. On ne remonte jamais tout seul : une remontee provoquerait
   une oscillation visible, et un a-coup en pleine balade se remarque
   beaucoup plus qu'un rendu legerement plus simple. */

/* LA RESOLUTION EST LE PREMIER POSTE, ET DE TRES LOIN.

   Le palier bas rendait a `dpr: 1`. Sur un telephone dont l'ecran est en
   trois fois — c'est-a-dire n'importe quel telephone recent — cela revient a
   dessiner une image trois fois trop petite puis a l'etirer. Le resultat
   ressemble litteralement a une video basse definition : escaliers enormes
   sur chaque arete, silhouette du cerf en marches d'escalier.

   Aucun autre reglage ne compte tant que celui-la est faux. Un decor moins
   fourni se remarque a peine ; une image floue se remarque immediatement et
   ruine tout le reste. On accepte donc de payer la definition en premier, et
   de retirer des arbres si la machine peine — jamais l'inverse.

   Les EMPREINTES reviennent aussi au palier bas. Elles coutent une cible de
   512 pixels et deux quads par pas : c'est negligeable, et sans elles on
   suit un animal qui glisse sur une nappe intacte, ce qui vide la balade de
   son sujet meme. Les couper etait une fausse economie. */
export const PALIERS = {
  bas: {
    nom: 'bas',
    dpr: 1.6,
    arbres: 1100,
    ombres: false,
    ombreTaille: 512,
    postfx: 'moyen',      // halo + vignette + grain, pas de profondeur de champ
    flocons: 13000,
    empreintes: true,
    segTerrain: 112,
    brancheDetail: 5,
  },
  moyen: {
    nom: 'moyen',
    dpr: 2,
    arbres: 1800,
    ombres: true,
    ombreTaille: 1024,
    postfx: 'moyen',
    flocons: 22000,
    empreintes: true,
    segTerrain: 144,
    brancheDetail: 6,
  },
  haut: {
    nom: 'haut',
    dpr: 2,
    arbres: 3200,
    ombres: true,
    ombreTaille: 2048,
    postfx: 'complet',    // + profondeur de champ
    flocons: 34000,
    empreintes: true,
    segTerrain: 192,
    brancheDetail: 8,
  },
};

/* Detection de depart : on se fie surtout au type d'appareil et au nombre
   de coeurs, faute de mieux. WEBGL_debug_renderer_info donne parfois le nom
   du GPU, mais beaucoup de navigateurs le masquent maintenant. */
export function detecterPalier(gl) {
  const mobile = matchMedia('(hover: none) and (pointer: coarse)').matches;
  const coeurs = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;

  /* UN TELEPHONE N'EST PAS UNE MACHINE FAIBLE.

     La regle precedente disait : mobile → palier le plus bas, sans condition
     et sans exception. Un iPhone recent tient pourtant cette scene a soixante
     images par seconde en pleine definition ; le traiter comme un appareil de
     2019 lui imposait une image trois fois trop petite, aucune empreinte et
     un tiers des arbres. Autrement dit, la grande majorite des visiteurs — la
     famille ouvre ce lien sur son telephone — voyait la plus mauvaise version
     possible, et c'est la seule que personne n'avait regardee.

     On part donc du palier moyen sur mobile, et on ne descend que si
     l'appareil s'annonce vraiment modeste. La vigie, elle, reste la : si ca
     rame, elle retrograde en deux secondes. Il vaut bien mieux commencer trop
     haut et laisser la mesure corriger que de decider a l'avance, a partir
     d'un seul booleen, que tous les telephones se valent. */
  const modeste = coeurs <= 4 || mem <= 3;
  let nom = mobile ? (modeste ? 'bas' : 'moyen') : 'moyen';

  let gpu = '';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
  } catch { /* le navigateur a le droit de refuser */ }

  const logiciel = /swiftshader|llvmpipe|software|microsoft basic/i.test(gpu);
  const costaud = /rtx|radeon rx|geforce (gtx|rtx)|apple m[1-9]|arc a/i.test(gpu);

  /* Le palier haut reste reserve aux machines de bureau.

     Je l'avais ouvert aux telephones a six coeurs en corrigeant l'exces
     inverse. C'etait trop : mesure faite, ce palier envoie 1 070 000
     triangles par image, plus une passe d'ombre en 2048 qui redessine la
     foret une seconde fois, plus la profondeur de champ. Aucun telephone ne
     tient ca a soixante images par seconde, et le budget ainsi gaspille est
     exactement celui qu'il faut pour rendre en pleine definition — qui est,
     lui, ce qui se voit.

     Sur mobile, on prefere donc systematiquement DES PIXELS NETS A DES
     TRIANGLES EN PLUS. C'est le meme arbitrage que partout ailleurs dans ce
     fichier, et c'est celui que l'oeil recompense. */
  if (logiciel) nom = 'bas';
  else if (!mobile && (costaud || (coeurs >= 8 && mem >= 8))) nom = 'haut';

  const p = { ...PALIERS[nom] };
  /* On ne depasse jamais la densite reelle de l'ecran — inutile — mais on ne
     descend pas non plus sous 1,25 quand l'ecran est dense : c'est le seuil
     en dessous duquel l'escalier devient franchement visible. */
  const densite = window.devicePixelRatio || 1;
  p.dpr = Math.min(p.dpr, densite);
  if (densite >= 2 && !logiciel) p.dpr = Math.max(p.dpr, 1.25);
  p.mobile = mobile;
  p.logiciel = logiciel;
  p.gpu = gpu;
  return p;
}

/* Surveillance du temps de trame. On regarde une moyenne glissante plutot
   que des trames isolees : un pic ponctuel (le navigateur qui compile un
   shader) ne doit pas declencher une degradation. */
export class Vigie {
  /* LE FILET S'ARRETAIT LA OU IL SERVAIT.

     `this.fini = palier.nom === 'bas'` : une fois au palier bas, la
     surveillance se coupait entierement. Or c'est le palier que recoit la
     quasi-totalite des telephones — donc, sur l'appareil ou la fluidite est
     le plus en jeu, il n'y avait aucun filet du tout. Un appareil qui ramait
     a vingt images par seconde ramait jusqu'au bout.

     Il n'y a pourtant plus de palier en dessous : que faire ? Baisser la
     DENSITE DE PIXELS. C'est de tres loin le premier levier sur un mobile,
     dont le goulot est le remplissage et non la geometrie — passer de 1,6 a
     1,2 retire 44 % des pixels a dessiner sans toucher a un seul triangle,
     a un seul arbre, a une seule ombre.

     ET ON LA REND QUAND ON PEUT. C'est la partie qui compte pour « ameliorer
     la fluidite sans inhiber la qualite » : la densite ne descend que d'un
     cran a la fois, jusqu'a ce que ca passe, et elle REMONTE des que
     l'appareil tient confortablement. Un telephone recent garde donc toute
     sa finesse ; un vieux modele recoit exactement la reduction dont il a
     besoin, et pas une de plus. Personne ne paie pour le voisin.

     Les deux seuils sont volontairement ecartes — on baisse au-dela de 20 ms
     (50 im/s), on remonte en deca de 13,5 ms (74 im/s) — pour qu'un appareil
     pile a la limite ne passe pas son temps a osciller entre deux densites,
     ce qui se verrait bien plus qu'une image de moins par seconde. */
  constructor(palier, surBaisse) {
    this.palier = palier;
    this.surBaisse = surBaisse;
    this.moy = 16.7;
    this.mauvais = 0;
    this.bon = 0;
    this.grace = 2.5;       // on laisse la scene se mettre en place
    this.dprPlein = palier.dpr;   // la densite nominale, celle qu'on vise
    /* PLANCHER A 1,0, ET PAS UN CRAN PLUS BAS.

       J'avais mis 0,85 en raisonnant en pourcentage de pixels economises,
       sans me demander a quoi ressemble le resultat. Antoine a repondu :
       « c'est flou, et au loin ca fait des sortes de carres ». Les deux
       viennent de la meme cause, et la seconde est pire que la premiere.

       Sous 1,0, on dessine moins de pixels que l'ecran n'en affiche : tout est
       necessairement adouci. Mais surtout, les tampons de flou du
       post-traitement sont en DEMI-resolution — a densite 0,85 ils tombent a
       0,42 fois l'ecran, et le halo comme la profondeur de champ remontent
       alors en blocs franchement visibles sur les zones etendues, c'est-a-dire
       le fond. Une economie qui degrade la moitie lointaine de chaque image
       n'est pas une economie acceptable.

       Le pas de descente est aussi adouci — 8 % au lieu de 14 % — pour qu'un
       appareil qui frole la limite n'y perde qu'un cran, pas deux. */
    this.dprMin = 1.0;

    /* --- LA REMONTEE NE POUVAIT PAS SE PRODUIRE -----------------------------

       Le seuil de remontee etait un nombre absolu : 13,5 ms, soit 74 images
       par seconde. Or `dt` n'est pas le temps de TRAVAIL d'une image, c'est
       l'intervalle entre deux images livrees — et cet intervalle est cale sur
       la synchronisation verticale de l'ecran. Sur un ecran 60 Hz, il vaut
       16,7 ms quoi qu'il arrive, meme sur une machine qui n'utilise qu'un
       dixieme de son budget. La condition etait donc INATTEIGNABLE sur la
       quasi-totalite des appareils : la plupart des telephones et presque
       tous les moniteurs sont en 60 Hz.

       Consequence concrete : il suffisait d'un hoquet passager — la
       compilation des nuanceurs au demarrage, un onglet qui repasse au
       premier plan, une seconde de chauffe — pour que la densite de pixels
       baisse, et elle ne remontait PLUS JAMAIS. La visite entiere se
       deroulait alors en dessous de ce que l'appareil savait faire, sans que
       rien ne le signale. C'est la qualite d'image la plus facile a rendre :
       elle n'a jamais ete perdue faute de puissance, mais faute d'une mesure
       exprimee dans la bonne unite.

       On mesure donc la PERIODE D'AFFICHAGE elle-meme — la trame la plus
       courte que l'appareil sache livrer — et « confortable » devient « on
       tient la cadence de l'ecran avec de la marge », ce qui a un sens a
       60 comme a 120 Hz. */
    this.periode = 16.7;

    /* Un aller-retour suffit a trancher : si une remontee est suivie d'une
       baisse, c'est que le palier d'avant etait le bon. On s'y tient et on
       cesse d'essayer, pour ne pas osciller — une oscillation se voit
       beaucoup plus qu'un cran de densite en moins. */
    this.remontees = 0;
    this.figee = false;
  }

  _appliquer(grace = 2.5) {
    this.mauvais = 0;
    this.bon = 0;
    // On repart de la cadence de l'ecran, pas d'un 60 Hz suppose.
    this.moy = this.periode;
    this.grace = grace;
    this.surBaisse(this.palier);
  }

  tic(dt) {
    if (this.grace > 0) { this.grace -= dt; return; }

    const ms = dt * 1000;
    this.moy += (ms - this.moy) * 0.06;

    /* La periode d'affichage, suivie par le bas : on descend vite vers une
       trame plus courte (c'est une borne physique, pas du bruit) et on ne
       remonte qu'a pas comptes, pour qu'une periode de rame ne fasse pas
       passer un ecran 120 Hz pour un 60 Hz. Les trames aberrantes — sous
       4 ms, soit plus de 250 images par seconde — sont ignorees. */
    if (ms > 4) {
      this.periode += (ms - this.periode) * (ms < this.periode ? 0.20 : 0.0015);
    }

    if (this.moy > 20) {
      this.bon = 0;
      this.mauvais += dt;
      if (this.mauvais < 2) return;

      // Une baisse qui suit une remontee tranche la question : on ne remonte
      // plus. Le niveau d'avant etait le bon.
      if (this.remontees > 0) this.figee = true;

      // 1. tant qu'il reste un palier au-dessous, c'est lui qu'on prend :
      //    il rend bien plus que la densite, et il se voit moins.
      if (this.palier.nom !== 'bas') {
        const suivant = this.palier.nom === 'haut' ? 'moyen' : 'bas';
        this.palier = { ...PALIERS[suivant], mobile: this.palier.mobile };
        this.palier.dpr = Math.min(this.palier.dpr, window.devicePixelRatio || 1);
        this.dprPlein = this.palier.dpr;
        this._appliquer();
        return;
      }

      // 2. au dernier palier, on rogne la densite, par petits crans.
      if (this.palier.dpr > this.dprMin + 0.01) {
        this.palier = { ...this.palier,
          dpr: Math.max(this.dprMin, this.palier.dpr * 0.92) };
        this._appliquer();
      } else {
        // Plus rien a donner : on cesse de mesurer pour ne pas y passer du
        // temps a chaque image sans jamais rien pouvoir en faire.
        this.grace = 1e9;
      }
      return;
    }

    this.mauvais = Math.max(0, this.mauvais - dt * 0.5);

    /* Confortable et de la densite en reserve : on la rend, doucement.

       « Confortable » se juge maintenant PAR RAPPORT A L'ECRAN : on tient sa
       cadence avec quinze pour cent de marge. A 60 Hz cela vaut 19,2 ms, a
       120 Hz 9,6 — la meme phrase dans les deux cas, alors qu'un seuil fixe
       n'avait de sens dans aucun des deux.

       On ne depasse jamais `dprPlein`, la densite nominale du palier : il
       s'agit de RENDRE ce qu'un incident passager avait pris, pas de miser
       sur une marge qu'on ne peut pas mesurer. Tenir la synchronisation
       verticale prouve qu'on suit l'ecran ; cela ne prouve pas qu'on
       pourrait dessiner deux fois plus de pixels. */
    if (!this.figee && this.moy < this.periode * 1.15
        && this.palier.dpr < this.dprPlein - 0.01) {
      this.bon += dt;
      if (this.bon > 4) {
        this.palier = { ...this.palier,
          dpr: Math.min(this.dprPlein, this.palier.dpr * 1.10) };
        this.remontees++;
        this._appliquer(3.5);
      }
    } else {
      this.bon = Math.max(0, this.bon - dt * 0.5);
    }
  }
}
