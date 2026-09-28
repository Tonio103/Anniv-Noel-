/* La demarche du cerf.

   Le point critique d'un quadrupede anime, c'est le GLISSEMENT DES SABOTS.
   Si les pattes battent l'air pendant que le corps avance a sa propre
   vitesse, l'animal semble patiner sur de la glace et tout le reste de la
   scene perd sa credibilite. On l'evite en inversant le raisonnement
   habituel : au lieu de faire tourner des pattes et d'esperer que ca colle,
   on decide OU CHAQUE SABOT SE POSE dans le monde, et on resout la
   cinematique inverse pour que la patte atteigne ce point.

   Pendant la phase d'appui, le sabot est immobile par rapport au SOL et
   recule donc dans le repere du corps exactement a la vitesse d'avance.
   Aucun glissement n'est alors possible, quelle que soit la vitesse.

   Chaque membre a deux segments : on resout par la loi des cosinus. Le sens
   de pliure differe entre l'avant (le coude pointe vers l'arriere) et
   l'arriere (le jarret pointe vers l'avant) — les inverser suffit a rendre
   l'animal immediatement faux. */

import * as THREE from 'three';
import { creerCerf } from './deerMesh.js';
import { damp, clamp, lerp, smoothstep } from '../core/noise.js';

/* Phases de poser, en fraction de cycle.
   Le pas : sequence laterale, trois appuis au sol en permanence.
   Le trot : bipedes diagonaux, plus vif, c'est l'allure de deplacement. */
/* LA FOULEE DEPASSAIT L'ALLONGE DES PATTES.

   Antoine : la marche « bug un peu... dans les descentes montees et tout ».
   Mesure sur sol RIGOUREUSEMENT PLAT, relief neutralise : le ratio entre la
   distance demandee a une patte et son allonge maximale oscillait deja entre
   0,64 et 1,13 A CHAQUE FOULEE — donc en trot, sur terrain plat, en permanence,
   independamment de toute pente. La pente n'aggrave qu'un defaut deja present
   partout ; elle ne le cree pas.

   La cause geometrique : au repos, la distance verticale de l'attache au sabot
   (0,765 m) occupe deja 94 % de l'allonge maximale (0,816 m) — il ne restait
   que cinq centimetres de marge. Or le balayage avant-arriere de la foulee en
   trot (`demi = foulee * 0.25`) vaut 0,50 m : des que le sabot s'ecarte de sa
   position de repos, la distance totale (Pythagore : vertical et horizontal
   combines) depasse l'allonge disponible, et `_resoudre` ecrete silencieusement
   — la patte se fige tendue au maximum au lieu de suivre sa cible, et le sabot
   se detache visuellement du sol. C'etait vrai a CHAQUE cycle, pas seulement
   dans les cotes.

   La foulee en trot descend de 2,00 a 1,30 m : le rythme des pas (`cycle`)
   suit la vitesse divisee par la foulee, donc une foulee plus courte ne
   fait que hater la cadence — elle ne change rien a la regle qui interdit le
   glissement des sabots, qui ne depend que de ce rapport.

   J'AI FAILLI CORRIGER CA AUTREMENT, ET MAL : remonter `repos.y` de quelques
   centimetres pour donner du mou a la patte semblait plus simple. Mais ce
   parametre fixe la hauteur du sabot AU SOL (voir plus bas, ou j'ai fini par
   le comprendre) ; le remonter aurait fait flotter les quatre pattes en
   permanence, meme a l'arret. Seule la foulee peut bouger sans toucher au
   contact au sol.

   RESULTAT, MESURE SUR LE PARCOURS ENTIER : le pire depassement d'allonge
   tombe de 65 % a 13 % — mais en combinant cette reduction avec le
   plafonnement de pente du terrain (`terrain.js`), et c'est ce dernier qui
   a fait presque tout le travail. Voir ci-dessous : je m'en etais attribue
   le merite a tort. */
/* CE QUE J'AVAIS MAL ATTRIBUE, ET LA CADENCE QUE CA A COUTE.

   Antoine : « le cerf marche trop vite, ses pattes bougent trop vite ». Il a
   raison, et la cause est la reduction de foulee ci-dessus. Le cycle avance
   en `vitesse / foulee` — c'est cette relation, et elle seule, qui empeche
   les sabots de patiner — donc a vitesse egale, une foulee deux fois plus
   courte, c'est deux fois plus de pas par seconde. A 4,2 m/s pour 1,30 m,
   cela faisait 3,2 cycles par seconde, plus de six posers de sabot par
   seconde. Un cerf elaphe en trotte deux.

   En remesurant le depassement d'allonge foulee par foulee, sur le parcours
   entier, la conclusion precedente ne tient pas :

       foulee 1,30 → 1,128      foulee 1,80 → 1,185
       foulee 1,55 → 1,148      foulee 2,00 → 1,215

   Passer de 2,00 a 1,30 n'avait donc rien fait tomber de 65 % a 13 % : cela
   n'a gagne que neuf centiemes de ratio. Tout le reste venait du plafonnement
   de pente du terrain, fait dans le meme lot. Le plancher est dans la
   CONFORMATION DE LA PATTE — au repos elle occupe deja 94 % de son allonge —
   et aucun reglage de foulee ne l'abaisse. J'avais donc paye la cadence
   entiere pour un gain marginal, et je ne l'avais pas verifie.

   On rend donc l'essentiel de la foulee (1,55 m, deux centiemes de ratio
   au-dessus du plancher) et l'on baisse l'allure en meme temps (voir main.js,
   4,2 → 3,3 m/s), ce qu'Antoine demande aussi. La cadence revient a 2,13
   cycles par seconde, exactement celle d'avant ma correction — celle dont
   personne ne s'etait jamais plaint. */
const ALLURES = {
  pas:  { phases: { PG: 0.0, AG: 0.25, PD: 0.5, AD: 0.75 }, appui: 0.64, foulee: 1.20, hauteur: 0.12 },
  trot: { phases: { AG: 0.0, PD: 0.0, AD: 0.5, PG: 0.5 },   appui: 0.42, foulee: 1.55, hauteur: 0.24 },
};

/* La vitesse a partir de laquelle le pas atteint sa longueur pleine. En
   dessous, il raccourcit en proportion et la cadence se maintient : c'est
   ainsi qu'un animal ralentit — a pas plus courts, pas a pas plus lents.
   Placee sous l'allure de croisiere (3,3 m/s) pour que celle-ci garde
   exactement la cadence voulue, et au-dessus de l'allure d'approche des
   haltes, qui gagne ainsi des pas un peu plus courts en arrivant. */
const V_PAS_PLEIN = 2.2;

/* L'abaissement maximal du dos, en metres, quand un pas etire les pattes.
   Dix-sept centimetres sur un metre au garrot : un animal qui se tasse
   franchement dans une descente raide, pas un animal qui s'accroupit. Au-dela
   on prefere laisser une patte en butee quelques images que de le voir
   ramper — a vingt centimetres, mesure, on ne gagnait plus que quelques
   images en butee sur tout le parcours, pour une silhouette qui ne se lisait
   plus comme celle d'un cerf. */
const ABAISSE_MAX = 0.17;

export class Cerf {
  constructor(palier, chemin, relief) {
    this.palier = palier;
    this.chemin = chemin;
    this.relief = relief;

    const m = creerCerf(palier);
    Object.assign(this, m);

    this.s = 0;                 // distance parcourue sur le chemin
    this.vitesse = 0;
    this.vitesseCible = 0;
    this.cycle = 0;             // avancement du cycle de foulee [0,1)
    /* L'horloge du CORPS. Distincte de celle des pattes : voir `maj()`. Elle
       se fige des que l'animal s'immobilise, alors que celle des pattes
       tourne encore un pas pour leur laisser le temps de rentrer. */
    this._cycleCorps = 0;
    this.allure = 'trot';

    this.grattage = 0;          // >0 quand il creuse la neige
    this.regard = 0;            // >0 quand il se retourne vers le visiteur
    this.tempsArret = 0;

    /* --- ce qu'il fait de lui-meme ----------------------------------------
       Les trajets entre deux haltes durent une douzaine de secondes pendant
       lesquelles, jusqu'ici, il ne se passait rien : le cerf trottait en
       ligne droite a vitesse constante. Un animal ne fait jamais ca. Il
       jette un oeil en arriere, secoue la tete pour chasser la neige, presse
       le pas puis se laisse porter.

       Ces gestes ne sont pilotes par personne : ils tombent d'eux-memes, sur
       un minuteur volontairement irregulier, pour qu'aucun trajet ne
       ressemble au precedent. C'est le seul endroit du programme ou le hasard
       est souhaitable — partout ailleurs il ferait desordre. */
    this.regardAuto = 0;        // coup d'oeil en arriere, de son initiative
    this.secousse = 0;          // il secoue la tete
    this.allant = 1;            // modulation lente de son entrain
    this._prochainGeste = 4 + Math.random() * 7;
    this._geste = null;
    this._resteGeste = 0;
    this._dureeGeste = 1;

    /* --- les trois riens qui font le vivant --------------------------------
       Aucun des trois ne se remarque consciemment, et c'est precisement ce
       qui les rend efficaces : leur ABSENCE, elle, se remarque. Un animal
       parfaitement immobile de la tete est une figurine, meme quand ses
       pattes sont animees a la perfection. */
    this._oreilleD = 0; this._oreilleG = 0;   // pivot instantane de chaque oreille
    this._prochainOreille = 1 + Math.random() * 3;
    /* L'ECOUTE : d'ou vient le bruit qu'il surveille. Ici, c'est le drone —
       c'est-a-dire nous. Un cervide suivi garde en permanence une oreille
       braquee sur ce qui le suit, meme quand il regarde ailleurs ; c'est
       meme la raison d'etre de cette mobilite. */
    this._ecoute = new THREE.Vector3();
    this._aEcoute = false;
    this._ecouteG = 0; this._ecouteD = 0;
    /* Le rangement des pattes apres un arret : 1 pendant qu'il marche, puis
       descend a zero en un peu moins d'une seconde — le temps qu'il faut aux
       quatre sabots pour rentrer, un par un. */
    this._rangement = 0;
    /* L'inertie longitudinale du torse : sa vitesse precedente, l'angle de
       tangage courant et la vitesse de cet angle. Voir `maj()`. */
    this._vPrec = 0;
    this._tangI = 0;
    this._tangV = 0;
    /* La pente lissee que le corps epouse, et la position de la racine a
       l'image precedente, pour reconnaitre une teleportation. */
    this._pente = 0;
    this._racinePrec = null;
    /* Facteur de foulee, de 0 a 1 : la longueur du pas rapportee a la
       foulee pleine. Garde d'une image a l'autre pour l'amplitude du corps. */
    this._k = 0;
    /* De combien le corps est abaisse pour qu'aucune patte au sol ne soit en
       butee, et le tampon qui sert a le calculer. */
    this._abaisse = 0;
    this._abaisseCible = 0;
    this._abaisseV = 0;
    this._cibleTest = new THREE.Vector3();
    this._clin = 0;                            // 0 ouvert, 1 ferme
    this._prochainClin = 2 + Math.random() * 4;
    this._flick = 0;                           // coup de queue
    this._prochainFlick = 3 + Math.random() * 5;

    /* --- LE SOUFFLE, ET POURQUOI IL MANQUAIT ---------------------------------

       Les oscillations du corps sont toutes multipliees par `bat`, qui vaut
       zero des que l'animal s'arrete. A l'arret, le corps est donc
       RIGOUREUSEMENT immobile : meme hauteur, meme assiette, au millimetre,
       image apres image. Or c'est exactement la que le visiteur le regarde
       le plus longtemps — les neuf haltes durent le temps qu'on lise une
       carte. Le commentaire en tete de ce fichier dit qu'une tete
       parfaitement immobile fait une figurine ; un CORPS parfaitement
       immobile la fait tout autant, et plus longtemps.

       Plus genant encore : les naseaux expulsent deja de la buee (voir
       `creerSouffle` dans deerMesh.js). L'animal souffle donc visiblement
       sans que rien ne se souleve en lui. C'est une contradiction que
       l'oeil enregistre sans la nommer.

       Une respiration au repos tourne autour de dix-huit par minute. */
    this._respire = Math.random() * Math.PI * 2;
    this._enMarche = 1;

    /* Evenements de poser, consommes par le son pour les crissements. */
    this.posers = [];
    this._auSol = { AG: true, AD: true, PG: true, PD: true };

    this._p = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this._c = new THREE.Vector3();
    this._cible = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._axe = new THREE.Vector3(1, 0, 0);
    this._bas = new THREE.Vector3(0, -1, 0);

    /* Position de repos de chaque sabot, dans le repere du corps.

       J'AI FAILLI CASSER LE CONTACT AU SOL EN CORRIGEANT CECI. Premiere idee :
       remonter `repos.y` de quelques centimetres pour donner de la marge a
       l'allonge — plus de flechissement, comme un vrai animal qui ne
       verrouille jamais ses genoux. Mais `repos.y` n'est pas un parametre
       libre : c'est lui qui, via le decalage constant du bone `corps`
       (`corps.position.y = hauteurGarrot`), place le sabot exactement au
       niveau du sol quand le terrain est plat. Le remonter aurait fait flotter
       les quatre pattes plusieurs centimetres au-dessus de la neige, tout le
       temps, y compris a l'arret — un defaut bien pire que celui qu'on
       cherchait a corriger. La marge se gagne uniquement en reduisant la
       foulee (voir ALLURES), jamais ici. */
    for (const mb of this.membres) {
      // On vise le bas du canon : le sabot, rigide, ajoute sa propre hauteur.
      mb.repos = new THREE.Vector3(
        mb.attache.position.x * 1.02,
        -this.hauteurGarrot + 0.035,   // le sabot s'enfonce dans la poudreuse
        mb.attache.position.z + (mb.avant ? 0.02 : -0.02)
      );
      mb.sabotMonde = new THREE.Vector3();
      /* L'ETAT PROPRE DE CHAQUE SABOT, dans le repere du corps (x lateral,
         z longitudinal, museau vers -Z). Voir « la locomotion par sabot »
         dans `maj()` : c'est lui, et non plus la phase seule, qui dit ou le
         pied se trouve. `leve` retient l'endroit ou il a quitte le sol, pour
         que la phase de vol parte de la ou il etait vraiment. */
      mb.pied = { x: mb.repos.x, z: mb.repos.z };
      mb.leve = { x: mb.repos.x, z: mb.repos.z };
      mb.enVol = false;
      /* Le point du MONDE ou ce sabot est pose, tant qu'il porte. `ancre`
         dit si ce point est valable : il ne l'est pas avant le premier pas,
         ni apres une teleportation. */
      mb.monde = { x: 0, z: 0 };
      mb.ancre = false;
      // Tampons de la boucle en deux passes (voir « l'abaissement du corps »).
      mb.cibleNue = new THREE.Vector3();
      mb.auSolImage = true;
      mb.poidsAppui = 1;
      mb.levee = 0;
      /* LE SENS DE PLIURE.

         Il ne se derive pas au tableau : `rotateOnAxis` tourne autour d'un axe
         exprime dans le repere LOCAL de l'os, et ce repere a deja ete pivote
         par l'orientation vers la cible. Le raisonnement « une rotation
         positive autour de X amene le genou vers l'arriere » est donc faux,
         et c'est ce raisonnement qui avait fixe cette valeur.

         LE MEME SENS POUR LES QUATRE, ET C'EST L'OEIL QUI TRANCHE.

         J'ai cru voir ici une erreur : chez un ongule le jarret ressort vers
         l'arriere, donc les posterieurs devraient plier a l'inverse des
         anterieurs. J'ai inverse, Antoine a regarde, et c'est FAUX a
         l'ecran — deux fois plutot qu'une.

         La raison est que l'articulation modelisee ici n'est pas le jarret.
         La patte arriere d'un cerf est un zigzag a TROIS segments — femur en
         avant jusqu'au grasset, tibia en arriere jusqu'au jarret, metatarse
         en avant — et une chaine a deux segments ne peut en representer
         qu'un seul pli. Celui que porte ce rig est le GRASSET, qui ressort
         bel et bien vers l'avant. Le jarret, lui, n'existe pas dans le
         modele ; le chercher menait a plier la patte a l'envers.

         Note pour plus tard : ce n'est pas un reglage a re-tester au
         jugement anatomique. Il a ete tranche a l'image, par celui qui
         regarde. */
      mb.sens = 1;
    }

    /* L'empattement : ou se tiennent, en moyenne, les pieds avant et les pieds
       arriere le long du corps. C'est sous ces deux points qu'on lit la pente
       du terrain — la lire sous le centre donnerait la pente d'un point, pas
       celle que l'animal enjambe. */
    {
      let zAv = 0, zAr = 0, nAv = 0, nAr = 0;
      for (const mb of this.membres) {
        if (mb.avant) { zAv += mb.repos.z; nAv++; } else { zAr += mb.repos.z; nAr++; }
      }
      this._zAvant = zAv / Math.max(1, nAv);
      this._zArriere = zAr / Math.max(1, nAr);
    }

    this.placer(this.s);
  }

  /* Position au sol et orientation, d'apres l'abscisse sur le chemin. */
  placer(s) {
    this.chemin.point(s, this._p);
    this.chemin.tangente(s, this._t);
    const y = this.relief.hauteur(this._p.x, this._p.z);
    this.racine.position.set(this._p.x, y, this._p.z);
    // Le corps est modelise museau vers -Z : pour regarder dans la direction
    // t, il suffit que (-sin y, -cos y) = (t.x, t.z).
    this.racine.rotation.y = Math.atan2(-this._t.x, -this._t.z);
  }

  /* DU REPERE DU CORPS AU MONDE, ET RETOUR.

     Les deux sens de la meme transformation : celle qui sert deja a poser
     les empreintes et a interroger le relief sous chaque sabot. On n'en
     ecrit pas une troisieme version — une conversion inverse qui ne serait
     pas rigoureusement l'inverse de celle des empreintes ferait deriver les
     sabots poses exactement de leur ecart. Seul le plan horizontal compte :
     la hauteur, elle, vient toujours du relief.

     Le museau pointe vers -Z ; le cap `ry` fait tourner autour de Y. */
  _versMonde(pied, monde) {
    const ry = this.racine.rotation.y, s = Math.sin(ry), c = Math.cos(ry);
    monde.x = this.racine.position.x + s * pied.z + c * pied.x;
    monde.z = this.racine.position.z + c * pied.z - s * pied.x;
  }

  _depuisMonde(monde, pied) {
    const ry = this.racine.rotation.y, s = Math.sin(ry), c = Math.cos(ry);
    const dx = monde.x - this.racine.position.x, dz = monde.z - this.racine.position.z;
    pied.x = c * dx - s * dz;
    pied.z = s * dx + c * dz;
  }

  /* Resolution a deux segments. `cibleCorps` est exprimee dans le repere du
     corps ; on la ramene dans celui de l'attache, qui n'a pas de rotation
     propre, donc une simple soustraction suffit. */
  _resoudre(mb, cibleCorps) {
    const d = this._c.subVectors(cibleCorps, mb.attache.position);
    const L1 = mb.L1, L2 = mb.L2;

    // Sans marge, une patte parfaitement tendue produit une singularite et
    // le genou part n'importe ou. On garde toujours un residu de flexion.
    const D = clamp(d.length(), Math.abs(L1 - L2) + 0.02, (L1 + L2) * 0.995);
    d.normalize();

    // Oriente le membre entier vers la cible...
    this._q.setFromUnitVectors(this._bas, d);
    mb.haut.quaternion.copy(this._q);

    // ...puis on ecarte la cuisse de l'angle au sommet du triangle.
    const cosA1 = clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1);
    const a1 = Math.acos(cosA1);
    mb.haut.rotateOnAxis(this._axe, mb.sens * a1);

    const cosA2 = clamp((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2), -1, 1);
    mb.bas.rotation.set(-mb.sens * (Math.PI - Math.acos(cosA2)), 0, 0);
  }

  /* Les gestes qu'il prend de lui-meme, pendant les trajets.

     Trois seulement, et jamais deux a la fois : au-dela, on ne lit plus un
     animal mais une marionnette agitee. Le minuteur est irregulier (5 a 14 s)
     pour que le spectateur ne puisse pas anticiper le prochain. Rien de tout
     ceci ne se declenche a l'arret : la, c'est la mise en scene qui commande,
     et deux intentions concurrentes sur la meme nuque donneraient un
     tremblement. */
  _vivre(dt) {
    const enRoute = this.vitesse > 1.2 && this.grattage <= 0 && this.regard <= 0.01;

    if (this._geste) {
      this._resteGeste -= dt;
      // Enveloppe en cloche : le geste monte, tient, redescend. Un creneau
      // se verrait comme un a-coup.
      const u = 1 - clamp(this._resteGeste / this._dureeGeste, 0, 1);
      const env = Math.sin(clamp(u, 0, 1) * Math.PI);

      if (this._geste === 'regarde') {
        // Il tourne la tete vers l'arriere — vers nous. C'est le geste qui
        // dit "tu suis ?", et c'etait la promesse du plan.
        this.regardAuto = env * 0.72;
      } else if (this._geste === 'secoue') {
        // Deux allers-retours francs : la neige tombe des oreilles.
        this.secousse = Math.sin(u * Math.PI * 4) * env;
      } else if (this._geste === 'presse') {
        // Un coup d'allant, puis il se laisse porter : la vitesse cesse
        // d'etre une constante.
        this.allant = 1 + env * 0.26;
      }

      if (this._resteGeste <= 0) {
        this._geste = null;
        this._prochainGeste = 5 + Math.random() * 9;
      }
    } else {
      this.regardAuto = damp(this.regardAuto, 0, 3.0, dt);
      this.secousse = damp(this.secousse, 0, 5.0, dt);
      this.allant = damp(this.allant, 1, 1.4, dt);

      if (enRoute) {
        this._prochainGeste -= dt;
        if (this._prochainGeste <= 0) {
          const d = Math.random();
          if (d < 0.45)      { this._geste = 'regarde'; this._dureeGeste = 2.2 + Math.random() * 1.1; }
          else if (d < 0.75) { this._geste = 'secoue';  this._dureeGeste = 0.9 + Math.random() * 0.4; }
          else               { this._geste = 'presse';  this._dureeGeste = 3.0 + Math.random() * 2.0; }
          this._resteGeste = this._dureeGeste;
        }
      }
    }
  }

  /* LES OREILLES, LES YEUX, LA QUEUE.

     Trois automatismes independants du reste, parce que dans la nature ils le
     sont aussi : un cerf balaie des oreilles pendant qu'il marche, cligne
     sans rapport avec ce qu'il fait, et chasse d'un coup de queue.

     Le point commun des trois, et la raison pour laquelle ils marchent : ils
     sont BREFS ET RARES. Une oreille qui tourne en permanence devient un
     essuie-glace ; un clignement toutes les deux secondes devient un tic. On
     les tire donc au sort sur des minuteurs longs, et chaque geste dure moins
     d'une demi-seconde. */
  _tics(dt) {
    /* --- oreilles ---------------------------------------------------------
       Elles ne bougent jamais ensemble : c'est l'asymetrie qui fait qu'on
       lit une ecoute et non un mecanisme. */
    this._prochainOreille -= dt;
    if (this._prochainOreille <= 0) {
      this._prochainOreille = 0.9 + Math.random() * 3.4;
      const amp = 0.22 + Math.random() * 0.42;
      if (Math.random() < 0.5) this._oreilleG = amp; else this._oreilleD = amp;
    }
    // Retour au repos rapide, mais pas instantane : le cartilage a de l'inertie.
    this._oreilleG = damp(this._oreilleG, 0, 5.5, dt);
    this._oreilleD = damp(this._oreilleD, 0, 5.5, dt);

    /* --- l'ecoute de ce qui suit ------------------------------------------
       Les coups d'oreille ci-dessus sont tires au sort : ils donnent la vie,
       mais ils ne veulent rien dire. Un cerf, lui, oriente ses pavillons
       vers ce qu'il surveille — et ce qu'il surveille, dans cette balade,
       c'est le drone qui le suit. C'est le seul geste de tout le rig qui
       reconnaisse la presence du spectateur ; sans lui, l'animal est suivi
       par quelque chose qu'il ignore, ce qu'aucune proie ne fait.

       Le relevement se prend dans le repere de LA TETE, pas du corps. La
       difference n'est pas academique : aux haltes il se retourne vers nous,
       et c'est justement la que les deux reperes divergent le plus. Pris sur
       le corps, les pavillons resteraient braques vers l'arriere alors que
       la tete nous fait face — un cerf qui vous regarde en ecoutant ailleurs.
       Pris sur la tete, ils reviennent vers l'avant tout seuls a mesure
       qu'il se tourne, ce qui est exactement ce que fait l'animal.

       On lit le cap de la tete tel qu'il etait a l'image precedente : `_tics`
       tourne avant que le cou et la tete ne soient reorientes. Un
       soixantieme de seconde de retard sur un pavillon ne se voit pas. */
    let ecouteG = 0, ecouteD = 0;
    if (this._aEcoute) {
      const dx = this._ecoute.x - this.racine.position.x;
      const dz = this._ecoute.z - this.racine.position.z;
      const cap = this.racine.rotation.y + this.cou.rotation.y + this.tete.rotation.y;
      // Passage en repere tete. Le museau pointe vers -Z.
      const lx = Math.cos(cap) * dx - Math.sin(cap) * dz;
      const lz = Math.sin(cap) * dx + Math.cos(cap) * dz;
      /* Ecart angulaire avec l'avant. Nul quand la source est pile devant,
         PI quand elle est pile derriere. */
      const ecart = Math.abs(Math.atan2(lx, -lz));
      /* Zone morte de 35 degres devant : dans ce cone le pavillon au repos
         capte deja la source, et le faire pivoter pour rien donnerait un
         tic permanent — le defaut qu'on evite partout ailleurs ici. */
      const arriere = clamp((ecart - 0.61) / (Math.PI - 0.61), 0, 1);
      // L'oreille du cote de la source se braque plus franchement que l'autre.
      const cote = Math.sign(lx) || 1;
      ecouteG = arriere * (cote > 0 ? 1 : 0.62);
      ecouteD = arriere * (cote < 0 ? 1 : 0.62);
    }
    // Lent : un pavillon se braque et TIENT. Un pavillon qui suit image par
    // image la moindre oscillation du drone serait un radar, pas une oreille.
    this._ecouteG = damp(this._ecouteG, ecouteG, 2.2, dt);
    this._ecouteD = damp(this._ecouteD, ecouteD, 2.2, dt);

    if (this.oreilles) {
      for (const o of this.oreilles) {
        const cote = o.userData.cote;
        const v = cote > 0 ? this._oreilleG : this._oreilleD;
        const e = cote > 0 ? this._ecouteG : this._ecouteD;
        o.rotation.z = o.userData.reposZ + v * cote * 0.9;
        o.rotation.x = o.userData.reposX - v * 0.5;
        /* La rotation autour de Y n'est PAS neutre ici, alors que l'axe du
           cornet est porte par Y. Elle le serait si l'oreille etait droite ;
           mais elle est ecartee de cinquante degres (`reposZ`), et three.js
           compose dans l'ordre XYZ, donc le Z s'applique en premier et sort
           l'axe du cornet du plan de rotation. C'est cet ecartement qui rend
           le pivot efficace — une oreille plaquee sur le crane ne pourrait
           pas s'orienter, chez le cerf comme ici.

           LE SIGNE A ETE MESURE, PAS DEDUIT. Je l'avais d'abord pose a
           l'envers en deroulant la composition a la main : le pavillon se
           detournait de la source au lieu de s'y braquer, en s'eloignant de
           99,6° a 138,7°. Trois rotations composees sur un axe qui n'est pas
           celui qu'on croit, ca se verifie en lisant l'angle dans le monde,
           pas en raisonnant. */
        o.rotation.y = e * cote * 0.9;
      }
    }

    /* --- clignement -------------------------------------------------------
       Cent millisecondes, comme un vrai. Plus long, on lit une somnolence. */
    this._prochainClin -= dt;
    if (this._prochainClin <= 0 && this._clin <= 0) {
      this._prochainClin = 1.8 + Math.random() * 5.0;
      this._clin = 1;
    }
    if (this._clin > 0) {
      this._clin = Math.max(0, this._clin - dt / 0.11);
      const ouvert = 1 - Math.sin(Math.min(1, 1 - this._clin) * Math.PI);
      const k = 0.06 + ouvert * 0.94;
      if (this.yeux) {
        for (const y of this.yeux) {
          y.scale.y = k;
          /* Le reflet est enfant de l'oeil : sans compensation, il s'ecrase
             avec lui et devient un trait. On lui rend sa forme en divisant
             par le meme facteur — il reste rond, et c'est l'oeil qui se
             ferme dessus, ce qui est exactement ce qu'on veut voir. */
          for (const r of y.children) {
            if (r.userData.compenser) r.scale.set(1, 1 / k, 1);
          }
        }
      }
    }

    /* --- coup de queue ----------------------------------------------------
       La version precedente balancait la queue en continu sur deux sinus. Un
       pendule, donc : le seul mouvement qu'un animal ne fait jamais. Une
       queue est au repos, et se leve d'un coup sec. */
    this._prochainFlick -= dt;
    if (this._prochainFlick <= 0) {
      this._prochainFlick = 2.2 + Math.random() * 6.0;
      this._flick = 1;
    }
    if (this._flick > 0) this._flick = Math.max(0, this._flick - dt / 0.42);
  }

  maj(dt, temps) {
    /* Un pas de temps negatif, nul ou invalide ne fait rien avancer, et un
       pas enorme est plafonne comme dans la boucle. La boucle et `damp` sont
       deja gardes ; ce rig-ci porte en plus ses propres integrateurs — le
       ressort d'inertie, le filtre d'abaissement — qu'un pas negatif ferait
       tourner a rebours, ou exploser. Une seule source de temps fautive
       suffit : chaque integrateur se protege lui-meme. */
    dt = dt > 0 ? Math.min(dt, 0.1) : 0;
    this._vivre(dt);
    this._tics(dt);

    /* --- vitesse : montee et descente en douceur -------------------------
       `allant` module la consigne plutot que la vitesse elle-meme : le
       lissage reste seul maitre de l'acceleration, donc aucun a-coup ne
       peut passer, et la relation foulee/vitesse qui interdit le glissement
       des sabots tient toujours. */
    /* L'ALLURE SE CHOISIT A L'ARRET, ET NE CHANGE PLUS ENSUITE.

       Elle suivait la vitesse instantanee : `vitesse > 3.4 ? 'trot' : 'pas'`.
       Deux defauts en decoulaient, et ils ont la meme cause — ce seuil n'a
       jamais ete remis a jour le jour ou l'allure de croisiere est passee de
       4,2 a 3,3 m/s.

       1. LE REGLAGE DE CADENCE N'A JAMAIS PRIS EFFET. Le commentaire des
          ALLURES ci-dessus conclut « la cadence revient a 2,13 cycles par
          seconde » : c'est 3,3 / 1,55, et 1,55 est la foulee du TROT. Tout
          ce raisonnement visait donc le trot. Mais a 3,3 m/s on est sous le
          seuil de 3,4, donc au PAS, de foulee 1,20 — soit 2,75 cycles par
          seconde. Les pattes battaient 29 % plus vite que voulu, ce qui est
          mot pour mot la plainte d'Antoine (« ses pattes bougent trop
          vite ») que cette correction etait censee avoir reglee.

       2. LES SABOTS SE TELEPORTAIENT EN PLEINE MARCHE. Les deux allures
          n'ont pas le meme ordre de poser : au pas PG part a 0,0 et PD a
          0,5 ; au trot c'est l'inverse. Changer de table deplace donc la
          phase d'un membre d'une DEMI-FOULEE d'un seul coup. Or 3,3 est
          colle sous le seuil, et le geste « presse » (`allant` jusqu'a
          1,26) le franchit a chaque fois : mesure sur une marche continue,
          un sabot en appui sautait de 536 mm dans une image ou le corps
          n'avancait que de 57 mm.

       On choisit donc l'allure sur la CONSIGNE, et uniquement quand
       l'animal est immobile : un cerf choisit son allure puis la tient, il
       n'en change pas au milieu d'une foulee. Plus aucun basculement ne
       peut survenir en mouvement, et 3,3 m/s donne bien le trot voulu. */
    /* Pas non plus pendant que les pattes rentrent : le rangement raisonne
       sur les phases et la fraction d'appui de l'allure en cours, et les
       changer a mi-chemin lui ferait relire le pas d'un autre patron.
       `_rangement` porte ici la valeur de l'image precedente, ce qui suffit :
       il vaut encore 1 a l'image ou la vitesse tombe sous le seuil. */
    if (this.vitesse < 0.05 && this._rangement <= 0) {
      this.allure = this.vitesseCible * this.allant > 2.0 ? 'trot' : 'pas';
    }

    this.vitesse = damp(this.vitesse, this.vitesseCible * this.allant, 2.6, dt);
    if (this.vitesse < 0.05) this.vitesse = 0;

    /* L'INERTIE DU TORSE — l'anticipation au depart et le tassement a l'arret.

       Il demarrait et s'arretait comme un objet sans masse : la vitesse
       montait et descendait en douceur, et rien dans le corps ne disait qu'il
       y avait quelque chose a mettre en mouvement. Un animal qui s'elance
       laisse sa masse en arriere une fraction de seconde et se cabre ; un
       animal qui freine pique du nez, puis se retablit en oscillant une fois.

       Plutot que deux minuteries — une pour le depart, une pour l'arret — un
       seul ressort amorti pose sur le tangage, force par l'ACCELERATION
       REELLE. Les deux effets en sortent du meme coup, et surtout ils ne
       peuvent pas se desynchroniser de ce que fait l'animal : ils sont
       calcules a partir de son mouvement, pas declares a cote.

       Sous-amorti volontairement (zeta = 0,45) : c'est le depassement qui
       donne le tassement, un ressort critique se contenterait de rejoindre
       sa position sans jamais donner l'impression d'un poids qu'on rattrape.

       Le pas de temps est borne pour l'integration. Un ressort a 9 rad/s
       integre par Euler explicite reste stable tant que le produit avec le
       pas reste petit ; sur une image longue — un changement d'onglet, une
       compilation de nuanceur — il divergerait, et une divergence ici ne se
       rattrape jamais puisque l'etat se reinjecte a chaque image. */
    const ds = Math.min(dt, 1 / 30);
    const acc = clamp((this.vitesse - this._vPrec) / Math.max(dt, 1e-4), -25, 25);
    this._vPrec = this.vitesse;
    /* LE SIGNE, MESURE ET NON DEDUIT — ET IL ETAIT FAUX.

       J'avais ecrit `-acc` en me fiant a une convention heritee du
       commentaire du souffle : « rotation.x negative souleve le poitrail ».
       Personne ne l'avait verifiee. En inclinant le corps et en lisant ou
       partent les attaches et la tete dans le monde, c'est l'inverse : une
       rotation POSITIVE souleve l'avant. Le ressort faisait donc piquer du
       nez au depart et cabrer au freinage — exactement le contraire de ce
       qu'annoncait le commentaire et le message qui l'accompagnait. Le banc
       ne pouvait pas le voir : il verifiait le meme signe, avec la meme
       convention fausse.

       Un animal qui pousse sur ses posterieurs pour s'elancer releve
       l'avant ; celui qui freine sur ses anterieurs plonge. D'ou `+acc`. */
    const viseI = clamp(acc * 0.0062, -0.075, 0.075);
    /* LE RESSORT DOIT ETRE PLUS LENT QUE CE QUI L'EXCITE.

       Premier essai a 9 rad/s : aucun rebond, mesure a 0,8 % du pic. La
       raison n'est pas le taux d'amortissement mais le RAPPORT DES VITESSES.
       La consigne de vitesse s'eteint en exponentielle a 2,6/s ; un ressort
       quatre fois plus rapide qu'elle la suit quasi statiquement, sans
       jamais accumuler l'ecart qui produirait un depassement. Il decrivait
       donc fidelement l'acceleration — et c'est precisement pour cela qu'on
       ne voyait aucune masse : une masse, ca RETARDE.

       A 4,4 rad/s il reste en arriere pendant le freinage, puis repasse de
       l'autre cote quand la deceleration cesse. C'est ce depassement-la, et
       lui seul, qu'on lit comme un poids qu'on rattrape. */
    const wI = 4.4, zI = 0.30;
    this._tangV += (wI * wI * (viseI - this._tangI) - 2 * zI * wI * this._tangV) * ds;
    this._tangI += this._tangV * ds;

    const A = ALLURES[this.allure];

    /* --- avancee sur le chemin ------------------------------------------- */
    this.s += this.vitesse * dt;
    this.placer(this.s);

    /* --- longueur du pas et cadence ---------------------------------------

       LA FOULEE RACCOURCIT QUAND ON RALENTIT, ET C'EST CE QUI REND LE DEPART
       ET L'ARRET CONTINUS.

       La longueur du pas etait fixe : a 0,1 m/s comme a 3,3, chaque sabot
       balayait toute sa course. Deux consequences, mesurees :

       · au DEPART, les sabots partent du repos, et la premiere image de
         marche les envoyait d'un coup a leur position de foulee pleine —
         jusqu'a 389 mm de saut pour un pied cense porter l'animal ;
       · a L'ARRET, symetriquement, il fallait un mecanisme a part pour
         rapatrier des pieds restes ecartes d'une foulee entiere.

       Un animal fait l'inverse : il raccourcit ses pas en ralentissant et
       les allonge en accelerant, en gardant une cadence a peu pres
       constante aux faibles allures. On fait donc croitre la longueur du
       pas avec la vitesse jusqu'a `V_PAS_PLEIN`, au-dela de quoi elle
       plafonne a la foulee de l'allure. A vitesse nulle le pas est nul :
       les sabots demarrent et finissent exactement la ou ils se tiennent.

       La cadence decoule de la longueur (vitesse / longueur), et cette
       relation reste la seule qui garantisse l'absence de glissement. Aux
       faibles allures elle vaut V_PAS_PLEIN / foulee, soit un pas et demi par
       seconde au trot : il continue de piétiner pendant qu'il s'arrete, au
       lieu de se figer en pleine foulee. */
    const foulee = A.foulee;
    const k = clamp(this.vitesse / V_PAS_PLEIN, 0, 1);
    this._k = k;
    const longueur = foulee * Math.max(k, 1e-3);
    /* LA DEMI-COURSE EXACTE.

       Elle valait `foulee * 0.25`. Or un sabot au sol doit reculer, dans le
       repere du corps, EXACTEMENT a la vitesse d'avance ; il dispose pour
       cela de la fraction d'appui du cycle. Sa course totale au sol vaut donc
       `appui x longueur`, et sa demi-course la moitie. Au trot cela fait
       0,326 m, pas 0,388 : l'ancienne valeur faisait patiner chaque appui de
       dix-neuf pour cent de la vitesse, en permanence — 21 mm par image en
       moyenne, mesures, pendant toute la balade. */
    const demi = A.appui * longueur * 0.5;

    /* Le rangement s'arrete quand il est FINI, pas quand une minuterie
       expire : quand plus aucun sabot n'est en l'air ni ecarte de sa place de
       repos. Plafond de securite pour qu'aucune configuration imprevue ne le
       laisse tourner sans fin. */
    if (this.vitesse > 0.05) this._rangement = 1;
    else if (this._rangement > 0) {
      const restants = this.membres.some((mb) => mb.enVol
        || Math.abs(mb.pied.z - mb.repos.z) > 1e-3
        || Math.abs(mb.pied.x - mb.repos.x) > 1e-3);
      this._rangement = restants ? Math.max(0, this._rangement - dt / 2.2) : 0;
    }

    /* A l'arret, la cadence de rangement est celle des faibles allures :
       l'animal finit son pas au meme rythme que celui qu'il avait en
       ralentissant, sans accelerer ni se figer a la bascule. */
    const cadence = this.vitesse > 0.05
      ? this.vitesse / longueur
      : (this._rangement > 0 ? V_PAS_PLEIN / foulee : 0);
    if (cadence > 0) this.cycle = (this.cycle + cadence * dt) % 1;

    /* LE TORSE ET LES PATTES N'ONT PAS LA MEME HORLOGE.

       Celle des pattes tourne encore un pas apres l'arret, pour que les
       sabots rentrent ; celle du corps se fige des que l'animal
       s'immobilise. C'est ce que fait l'animal — le torse se tasse pendant
       que les pattes se rangent. Un torse qui continuerait de rouler pendant
       le rangement ferait patiner les sabots poses, puisque ce roulis-la
       n'est pas compense. */
    if (this.vitesse > 0.05) {
      this._cycleCorps = (this._cycleCorps + cadence * dt) % 1;
    }

    /* --- la pente sous les pieds ------------------------------------------

       Le corps restait horizontal quelle que soit la pente, alors que le
       terrain monte jusqu'a vingt-cinq degres entre les sabots avant et
       arriere. Un quadrupede n'avance pas ainsi : son dos epouse la pente.
       Et c'est justement ce defaut qui faisait tendre les pattes au-dela de
       leur allonge — corps a plat dans une descente, les pattes arriere
       doivent aller chercher un sol plus haut qu'elles, et les pattes avant
       un sol plus bas ; le probleme n'etait pas la conformation des pattes,
       c'etait que le corps refusait de suivre.

       On mesure donc la pente la ou les sabots se posent vraiment — sous les
       pieds avant et sous les pieds arriere, pas sous le centre — et le
       corps s'y incline, avec un leger retard : un animal ne recopie pas le
       relief image par image, il l'epouse. */
    {
      const ry = this.racine.rotation.y;
      const px = this.racine.position.x, pz = this.racine.position.z;
      const hAv = this.relief.hauteur(px + Math.sin(ry) * this._zAvant, pz + Math.cos(ry) * this._zAvant);
      const hAr = this.relief.hauteur(px + Math.sin(ry) * this._zArriere, pz + Math.cos(ry) * this._zArriere);
      const visee = Math.atan2(hAv - hAr, this._zArriere - this._zAvant);
      /* Dix par seconde, soit une centaine de millisecondes de retard. A
         5,5 le dos suivait avec trop de retard dans les deux descentes raides
         du parcours (onze a vingt degres) : les anterieurs y restaient en
         butee jusqu'a 128 % de leur allonge. A 14 il epousait chaque bosse
         image par image, ce qui se lit comme un tremblement. Mesure sur tout
         le parcours, 10 ramene les images en butee de 37 a 21. */
      this._pente = damp(this._pente, visee, 10, dt);
    }

    /* --- les teleportations --------------------------------------------------
       Les sabots poses sont ancres dans le monde (voir « la locomotion par
       sabot »). Si l'animal est DEPLACE plutot qu'il ne marche — le retour a
       la lisiere en fin de balade, les outils de controle qui le posent a une
       halte — ces ancres deviennent des points a des centaines de metres, et
       les pattes iraient les chercher. Un deplacement de plus de deux metres
       en une image n'est pas un pas : on range alors les quatre sabots a leur
       place de repos, et ils se reancrent la ou il se tient maintenant. */
    {
      const px = this.racine.position.x, pz = this.racine.position.z;
      if (this._racinePrec && Math.hypot(px - this._racinePrec.x, pz - this._racinePrec.z) > 2) {
        for (const mb of this.membres) {
          mb.pied.x = mb.repos.x; mb.pied.z = mb.repos.z;
          mb.enVol = false; mb.ancre = false;
        }
        this._rangement = 0;
      }
      if (!this._racinePrec) this._racinePrec = { x: px, z: pz };
      this._racinePrec.x = px; this._racinePrec.z = pz;
    }

    const enMouvement = this.vitesse > 0.05;
    const yRacine = this.racine.position.y;

    /* LE SOUFFLE. Il ne vit qu'a l'arret : en marche, le tangage de la
       foulee est dix fois plus ample et le souffle n'y ajouterait qu'un
       battement parasite. La bascule est LISSEE — un souffle qui
       s'allumerait net a l'instant ou l'animal pose son dernier sabot se
       verrait comme un declic.

       Un centimetre et demi au garrot, pas plus. C'est peu, et c'est le
       point : on ne doit jamais POUVOIR dire que le cerf respire, on doit
       seulement ne plus pouvoir dire qu'il est en carton. */
    this._enMarche = damp(this._enMarche, enMouvement ? 1 : 0, 3, dt);
    const auRepos = 1 - this._enMarche;
    this._respire += dt * 1.85;
    const souffle = Math.sin(this._respire) * 0.5 + 0.5;
    const leve = souffle * 0.016 * auRepos;

    /* LE REPORT D'APPUI. Un quadrupede debout ne tient pas sur ses quatre
       pattes a parts egales : il pose son poids d'un cote, puis de l'autre,
       indefiniment. C'est un mouvement lent — plusieurs secondes par
       bascule — et c'est le seul qui distingue un animal arrete d'un animal
       en pause. Le souffle dit qu'il est vivant ; le report dit qu'il a un
       poids.

       Deux sinus de periodes incommensurables (10,1 s et 15,3 s) : la
       somme ne se repete jamais a l'echelle d'une halte, donc on ne peut
       pas prendre le rythme en defaut. Le roulis et le deport lateral vont
       ENSEMBLE — le torse penche du cote ou le poids passe ; les dissocier
       donnerait un balancement de metronome au lieu d'un transfert. */
    const report = (Math.sin(temps * 0.62) * 0.62
                  + Math.sin(temps * 0.41 + 1.7) * 0.38) * auRepos;
    const roul = report * 0.012;        // 0,7 degre au plus
    const lat  = report * 0.008;        // huit millimetres au plus
    /* Le tangage du poitrail fait partie du souffle (voir plus bas) et doit
       donc etre compense au meme titre : c'est une rotation du corps comme
       une autre, et son bras de levier est le plus long des trois puisque
       les sabots avant et arriere sont a un demi-metre de l'axe. */
    /* Le tangage d'inertie rejoint celui du souffle dans le lot COMPENSE : ce
       sont deux rotations du corps, et les sabots poses ne doivent suivre ni
       l'une ni l'autre. C'est d'autant plus vrai pour l'inertie que son
       rebond survit a l'immobilisation — non compense, il ferait patiner les
       quatre appuis pendant exactement le tassement qu'on cherche a montrer. */
    /* La pente rejoint le meme lot, et pour la meme raison : c'est une
       rotation du corps, et les sabots doivent rester la ou le terrain les
       porte. Compensee, elle fait exactement ce qu'on attend — le corps
       s'incline, et ce sont les pattes qui s'ajustent en longueur, les
       avant se raccourcissant en montee et les arriere s'allongeant. */
    /* Rotation POSITIVE = avant souleve (mesure : voir l'inertie plus haut).
       L'inspiration souleve le poitrail, la montee aussi. Le souffle etait
       ecrit avec le signe oppose depuis son introduction : l'animal abaissait
       le poitrail en inspirant, d'un quart de degre — invisible, mais faux,
       et c'est de ce commentaire-la qu'etait partie la mauvaise convention. */
    /* L'enveloppe du grattage, calculee ici parce que le corps s'y incline
       lui aussi (voir la tete, plus bas) — et que tout ce qui fait tourner le
       corps doit etre connu AVANT les pattes pour y etre compense. */
    const gGratte = this.grattage > 0
      ? smoothstep(0, 0.25, this.grattage) * smoothstep(1, 0.75, this.grattage) : 0;
    const tangLent = souffle * 0.004 * auRepos + this._tangI + this._pente - gGratte * 0.07;

    /* --- LA POSE COMPLETE DU CORPS, CALCULEE AVANT LES PATTES --------------

       Le balancement de foulee — rebond vertical, tangage, roulis — etait
       calcule APRES la boucle des membres et n'etait pas compense sur les
       sabots, avec pour justification que « c'est la foulee qui decide ou le
       pied se pose, et cette bascule-la fait partie du mouvement ».

       C'est faux, et l'appui exact l'a rendu visible. Un sabot pose ne sait
       rien de ce que fait le torse : quand le dos roule de deux degres, ce ne
       sont pas les pieds qui glissent de trois centimetres, ce sont les
       pattes qui plient d'un cote et se deplient de l'autre. C'est meme la
       definition du rebond de trot — le corps monte et descend PARCE QUE les
       pattes flechissent. Tant que l'appui etait approximatif, ce defaut se
       noyait dans un glissement dix fois plus gros ; une fois l'appui exact,
       il devenait la principale source de raclement restante.

       On calcule donc ici la pose complete, on la compense en entier sur les
       cibles, et on l'applique telle quelle au corps plus bas. Les deux
       emplois lisent les memes nombres : ils ne peuvent plus diverger.

       L'amplitude suit la longueur du pas : a petits pas, le corps balance
       moins. Un tiers subsiste aux plus faibles allures, sinon l'animal qui
       ralentit se raidirait d'un coup. */
    const bat = this._enMarche * (0.3 + 0.7 * k);
    const bond = Math.sin(this._cycleCorps * Math.PI * 4) * 0.028 * bat;
    const tangFoulee = Math.sin(this._cycleCorps * Math.PI * 4 + 0.8) * 0.030 * bat;
    const roulFoulee = Math.sin(this._cycleCorps * Math.PI * 2) * 0.035 * bat;

    const leveTotal = leve + bond;
    const tang = tangLent + tangFoulee;
    const roulTotal = roul + roulFoulee;
    const cosR = Math.cos(-roulTotal), sinR = Math.sin(-roulTotal);
    const cosT = Math.cos(-tang), sinT = Math.sin(-tang);

    /* --- chaque membre ---------------------------------------------------- */
    for (const mb of this.membres) {
      const phase = (this.cycle + (1 - ALLURES[this.allure].phases[mb.nom])) % 1;
      this._cible.copy(mb.repos);

      let auSol = true;

      /* LA LOCOMOTION PAR SABOT.

         Jusqu'ici, la position d'un sabot se DEDUISAIT de la phase :
         `repos + lerp(-demi, demi, u)` au sol, l'inverse en l'air. Tout
         tenait tant que la vitesse etait constante et la demi-course juste ;
         des qu'il accelerait, s'arretait ou repartait, la formule disait ou
         le pied DEVRAIT etre, sans egard pour la ou il ETAIT — d'ou les
         teleportations. Il avait fallu ajouter un mecanisme a part pour
         l'arret, et il en aurait fallu un troisieme pour le depart.

         Chaque sabot porte desormais son propre etat, et la phase ne decide
         plus que d'une chose : QUAND il leve et QUAND il pose.

         · AU SOL, il est immobile dans le monde. Dans le repere du corps qui
           avance, il recule donc exactement a la vitesse d'avance, image par
           image — ce n'est plus une approximation de l'absence de
           glissement, c'en est la definition. Dans un virage, il tourne en
           sens inverse du cap pour la meme raison.
         · EN L'AIR, il part de la ou il a quitte le sol et vise son prochain
           point de pose, a une demi-course devant sa place de repos.

         Le depart, la marche, l'arret et le rangement ne sont plus que des
         cas de cette meme regle : a vitesse nulle le pas est nul, donc le
         point de pose EST la place de repos, et chaque sabot y rentre au vol
         suivant. Un seul mecanisme, exact partout, au lieu de trois
         approximations recousues entre elles. */
      const actif = enMouvement || this._rangement > 0;
      if (actif) {
        if (phase < A.appui) {
          /* ANCRE DANS LE MONDE, PAS DANS LE CORPS.

             Premiere version : `pied.z += vitesse * dt`, c'est-a-dire reculer
             dans le repere du corps de ce dont la racine est censee avancer.
             C'etait exact sur le papier et approximatif en pratique, parce
             que la racine n'avance PAS exactement de `vitesse * dt` : le
             chemin est une courbe de Catmull-Rom dont three.js approche la
             longueur d'arc sur deux cents segments, et la ou cette
             approximation derive, le pied derive avec elle. Pire, en bout de
             chemin `point(s)` plafonne : la racine s'arrete, le pied, lui,
             continuait de reculer — 129 mm mesures sur un parcours complet.

             Un sabot pose est un point du MONDE. On retient donc ce point au
             contact, et a chaque image on le ramene dans le repere du corps
             par la transformation inverse exacte de celle qui sert a poser
             les empreintes. Translation, cap, approximation du chemin : tout
             est absorbe, parce qu'on ne suppose plus rien sur la facon dont
             la racine s'est deplacee — on se contente de savoir ou elle est. */
          if (mb.enVol || !mb.ancre) {
            mb.enVol = false;
            this._versMonde(mb.pied, mb.monde);
            mb.ancre = true;
          }
          this._depuisMonde(mb.monde, mb.pied);
        } else {
          const u = (phase - A.appui) / (1 - A.appui);
          if (!mb.enVol) {
            mb.enVol = true;
            mb.leve.x = mb.pied.x;
            mb.leve.z = mb.pied.z;
          }
          /* Il atteint son point de pose un peu AVANT la fin du vol, puis
             descend a la verticale : un sabot se POSE, il n'arrive pas en
             glissant. Sans cette marge, la fin du profil lisse laissait le
             pied a quelques millimetres de sa cible au moment du contact. */
          const w = smoothstep(0, 0.92, u);
          mb.pied.z = lerp(mb.leve.z, mb.repos.z - demi, w);
          mb.pied.x = lerp(mb.leve.x, mb.repos.x, w);
          /* La hauteur du geste suit la longueur du pas : lever le pied de
             vingt-quatre centimetres pour avancer de trois, c'est un pas de
             parade. On garde un tiers de la levee aux petits pas — assez
             pour qu'on les voie comme des pas, et non comme un glissement. */
          mb.levee = Math.sin(u * Math.PI) * A.hauteur * (0.35 + 0.65 * k);
          this._cible.y += mb.levee;
          auSol = false;
          mb.poidsAppui = smoothstep(0.55, 1.0, u);
        }
      }
      this._cible.x = mb.pied.x;
      this._cible.z = mb.pied.z;

      /* Le sabot suit le relief : sur une bosse, la patte se raccourcit.
         Sans ca, l'animal s'enfonce ou flotte des qu'il quitte le plat. */
      const mondeX = this.racine.position.x
        + Math.sin(this.racine.rotation.y) * this._cible.z
        + Math.cos(this.racine.rotation.y) * this._cible.x;
      const mondeZ = this.racine.position.z
        + Math.cos(this.racine.rotation.y) * this._cible.z
        - Math.sin(this.racine.rotation.y) * this._cible.x;
      const solPied = this.relief.hauteur(mondeX, mondeZ);
      this._cible.y += (solPied - yRacine);
      mb.sabotMonde.set(mondeX, solPied, mondeZ);

      /* Grattage : la patte avant droite racle la neige pour deterrer. */
      if (this.grattage > 0 && mb.nom === 'AD') {
        const g = Math.sin(this.grattage * Math.PI * 3.4);
        this._cible.z -= 0.34 + g * 0.28;
        this._cible.y += Math.max(0, g) * 0.30;
        auSol = g < -0.4;
      }

      mb.cibleNue.copy(this._cible);
      mb.auSolImage = auSol;
      if (auSol) { mb.poidsAppui = 1; mb.levee = 0; }
      else if (!actif || (this.grattage > 0 && mb.nom === 'AD')) mb.poidsAppui = 0;
    }

    /* --- L'ABAISSEMENT DU CORPS ---------------------------------------------

       Une fois l'appui rendu exact, le glissement restant a ete mesure patte
       par patte : sur quarante secondes de marche, 666 des 878 glissements de
       plus de quatre millimetres survenaient sur une patte EN BUTEE — une
       cible au-dela de l'allonge, jusqu'a 127 % de la longueur de la patte.
       La cinematique inverse ecrete alors en silence, la patte se fige tendue
       au maximum, et le sabot reel decroche de l'endroit ou il devait rester :
       ce n'est plus la cible qui glisse, c'est la patte qui ne peut plus la
       tenir.

       C'est le plancher documente plus haut : au repos une patte occupe deja
       94 % de son allonge. Le moindre pas un peu long, la moindre bosse sous
       un sabot suffisent a la faire passer au-dela.

       Un animal fait ce que le rig ne faisait pas : il ABAISSE LE CORPS. Un
       pas plus long, une descente, un sol qui se derobe sous un pied — le dos
       descend de quelques centimetres et la patte retrouve de la marge. On
       calcule donc, pour chaque sabot au sol, de combien le corps devrait
       descendre pour que sa patte reste sous 97 % de son allonge, et on
       prend le plus exigeant. Les sabots en l'air ne comptent pas : ils
       peuvent toujours se replier.

       Descente immediate, remontee lente. La descente doit etre immediate,
       faute de quoi la patte serait en butee pendant les quelques images de
       retard — exactement ce qu'on cherche a supprimer ; et elle est de toute
       facon continue, puisque le besoin croit a mesure que le sabot pose
       recule sous le corps. La remontee, elle, est amortie : un dos qui
       rebondirait a chaque pas se lirait comme une suspension. */
    {
      const lim = 0.97;
      let besoin = 0;
      for (const mb of this.membres) {
        if (mb.poidsAppui <= 0) continue;
        // La cible telle qu'elle sera compensee, avec la hauteur courante.
        /* On juge la patte a la hauteur OU ELLE VA SE POSER, sans la levee de
           l'arc de vol. Avec la levee, un pied en fin de vol paraissait plus
           proche de son attache qu'il ne le serait au contact : le besoin
           n'apparaissait qu'a l'image du contact, d'un coup, et la descente
           bornee mettait deux ou trois images a le rattraper. Mesure : les
           52 images en butee restantes tombaient TOUTES dans les trois images
           suivant un contact, sabot en tout debut de course. Juge a la
           hauteur de pose, le corps descend pendant que le pied s'etend vers
           le sol — ce qui est d'ailleurs l'ordre des choses chez l'animal. */
        const c = this._cibleTest.copy(mb.cibleNue);
        c.y -= mb.levee;
        c.y -= leveTotal; c.x -= lat;
        const cy = c.y, cz = c.z;
        c.y = cy * cosT - cz * sinT; c.z = cy * sinT + cz * cosT;
        const cx = c.x, cy2 = c.y;
        c.x = cx * cosR - cy2 * sinR; c.y = cx * sinR + cy2 * cosR;
        const ax = c.x - mb.attache.position.x;
        const ay = c.y - mb.attache.position.y;
        const az = c.z - mb.attache.position.z;
        const Lmax = (mb.L1 + mb.L2) * lim;
        /* ABAISSER UN CORPS INCLINE NE RAPPROCHE PAS LA CIBLE A LA VERTICALE.

           Premiere version : on supposait qu'abaisser le corps de d
           remontait la cible de d, droit vers l'attache. Vrai sur le plat,
           faux en pente — et le corps epouse des pentes de vingt-cinq degres.
           Descendre un corps incline, c'est le deplacer selon SON axe
           vertical, qui a alors une composante avant-arriere ; pour les
           anterieurs, a plus d'un metre devant le pivot, elle pesait assez
           pour laisser la patte en butee malgre l'abaissement calcule. La
           mesure l'a montre : cible exacte au dixieme de millimetre hors
           butee, jusqu'a seize millimetres d'ecart au-dela.

           On prend donc la vraie direction — l'axe vertical du corps passe
           dans le repere des cibles par la meme rotation inverse que tout le
           reste — et on resout exactement |a + d.u| = Lmax. Si la cible est
           hors de portee meme au plus pres, on prend ce plus pres. */
        const uX = -cosT * sinR, uY = cosT * cosR, uZ = sinT;
        const au = ax * uX + ay * uY + az * uZ;
        const a2 = ax * ax + ay * ay + az * az;
        let d = 0;
        if (a2 > Lmax * Lmax) {
          const disc = au * au - (a2 - Lmax * Lmax);
          d = disc >= 0 ? Math.max(0, -au - Math.sqrt(disc)) : Math.max(0, -au);
        }
        besoin = Math.max(besoin, d * mb.poidsAppui);
      }
      /* Un plafond ADOUCI. Le `min` sec faisait un angle au moment ou le
         besoin atteignait le plafond — ce qui arrive precisement dans les
         deux descentes raides — et cet angle ressortait en a-coup du dos
         malgre le filtre (seize millimetres de saccade, mesures a 154 m).
         Un minimum doux epouse le plafond sans y buter : identique au `min`
         a deux centimetres pres, et derivable partout. */
      {
        const e = 0.012;
        besoin = -e * Math.log(Math.exp(-besoin / e) + Math.exp(-ABAISSE_MAX / e));
        if (besoin < 0) besoin = 0;
      }
      /* LA DESCENTE N'ETAIT PAS CONTINUE, ET LE CORPS SAUTAIT DE 95 mm.

         J'avais suppose que le besoin evoluait sans a-coup, puisqu'un sabot
         pose recule progressivement sous le corps. C'etait vrai pendant
         l'appui, et faux au contact : a l'image ou un sabot touche le sol, il
         entre d'un coup dans l'ensemble des appuis, et si sa patte est deja
         etiree le besoin fait un saut. Avec une descente immediate, le dos
         tombait d'autant en une image — 95 mm mesures.

         Deux corrections, et la seconde n'est qu'un filet :

         · un sabot en l'air entre dans le calcul A MESURE QU'IL APPROCHE DU
           SOL (`poidsAppui`, de 0 a mi-vol a 1 au contact). Le corps commence
           donc a descendre pendant que le pied s'etend vers le sol — ce qui
           est exactement ce que fait un animal qui allonge le pas ;
         · la descente est bornee en vitesse. Si quelque chose d'imprevu fait
           encore sauter le besoin, une patte restera en butee quelques images
           plutot que de voir le dos s'effondrer d'un coup. Entre un sabot qui
           decroche de quelques millimetres et un corps qui tombe de dix
           centimetres, le second se voit bien davantage. */
      /* UN AMORTISSEUR CRITIQUE, RESOLU EXACTEMENT.

         Premiere borne : un limiteur de VITESSE. Il empechait le dos de
         s'effondrer, mais le faisait passer de l'immobilite a sa vitesse
         maximale en une image — et c'est cela, un a-coup : non pas un
         mouvement rapide, un changement brusque de vitesse. Le rebond de
         trot est plus rapide et ne choque pas, parce qu'il est sinusoidal.

         Deuxieme essai : un ressort integre par Euler. Vitesse continue, plus
         d'a-coup — et une bombe a retardement. A trente radians par seconde
         il etait tout juste stable a soixante images par seconde, et
         INSTABLE A TRENTE : le produit de la raideur par le pas de temps y
         depassait la limite, et la hauteur du dos partait a l'infini. Or
         trente images par seconde, c'est ce que tient un telephone modeste.
         Le cerf aurait litteralement explose chez une partie de la famille.
         A cinquante, il divergeait deja a soixante.

         On prend donc la solution EXACTE de l'amortisseur critique sur un pas
         de temps (l'approximation polynomiale classique de son exponentielle)
         : stable quel que soit le pas, vitesse continue par construction.

         Pourquoi un filtre, et pas le besoin tel quel : le besoin est le plus
         exigeant des quatre sabots, et le maximum de courbes lisses fait un
         COUDE la ou elles se croisent — une fois par foulee, mesure. Suivi
         directement, ce coude devient un changement brusque de vitesse du
         dos (36 mm de saccade). Le filtre l'arrondit, au prix d'un retard de
         quelques centiemes de seconde, pendant lequel une patte peut
         effleurer sa butee. La raideur a ete choisie sur la courbe mesuree
         entre ces deux defauts, sur trente secondes de trot et cent
         transitions :

             raideur   glissement (c. 99,9 / pire)   saccade du dos
               45         10,4 / 11,8 mm                6,9 mm
               70          2,3 /  3,0 mm                8,8 mm
              100          0,2 /  2,3 mm               12,4 mm

         Soixante-dix est le coude : au-dela, on ne gagne plus rien sur les
         sabots et on commence a payer en a-coups. La remontee reste lente :
         c'est la cible qui redescend doucement, pas le filtre. */
      this._abaisseCible = Math.max(besoin, damp(this._abaisseCible, besoin, 3.5, dt));
      {
        const w = 70;
        const x = w * dt, ex = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
        const ecart = this._abaisse - this._abaisseCible;
        const tmp = (this._abaisseV + w * ecart) * dt;
        this._abaisseV = (this._abaisseV - w * tmp) * ex;
        this._abaisse = this._abaisseCible + (ecart + tmp) * ex;
      }
    }
    const hauteurCorps = leveTotal - this._abaisse;

    for (const mb of this.membres) {
      this._cible.copy(mb.cibleNue);
      const auSol = mb.auSolImage;

      /* LE SOUFFLE ET LE REPORT DEPLACENT LE CORPS, PAS L'ANIMAL.

         La cible du sabot est exprimee dans le repere DU CORPS. Si on bouge
         le corps sans rien faire d'autre, les cibles le suivent et les
         quatre sabots quittent le sol — le cerf respirerait en levitant et
         se balancerait en patinant.

         On applique donc aux cibles la transformation INVERSE exacte de
         celle qu'on applique au corps plus bas. Three.js compose un objet en
         `monde = translation . rotation`, donc pour qu'un point p' du repere
         corps retombe sur le point p0 qu'il occupait sans balancement :

             translation + R . p' = p0   d'ou   p' = R⁻¹ . (p0 - translation)

         soit : on retranche d'abord le deport, on tourne ensuite de l'angle
         oppose. L'ordre n'est pas interchangeable — tourner d'abord ferait
         pivoter le deport avec le reste.

         Le bras de levier n'est pas negligeable : un sabot pend a pres d'un
         metre sous l'origine du corps, si bien que les 0,012 rad de roulis
         le deplaceraient de douze millimetres a eux seuls. C'est exactement
         l'ordre de grandeur d'un patinage visible.

         CETTE CORRECTION VIENT EN DERNIER, ET C'EST VOULU. Tout ce qui
         precede — la foulee, le suivi du relief, le grattage — raisonne sur
         la position que le sabot doit occuper DANS LE MONDE, et `sabotMonde`
         en decoule, qui sert aux empreintes et au son des posers. Corriger
         plus tot aurait donc decale les empreintes de huit millimetres par
         rapport aux sabots qui les laissent. */
      this._cible.y -= hauteurCorps;
      this._cible.x -= lat;
      {
        /* Three.js compose les angles d'Euler dans l'ordre XYZ, donc la
           rotation du corps vaut R = Rx . Rz et son inverse Rz⁻¹ . Rx⁻¹ :
           on defait le tangage d'abord, le roulis ensuite. Inverser ces
           deux lignes laisserait une erreur croisee. */
        const cy = this._cible.y, cz = this._cible.z;
        this._cible.y = cy * cosT - cz * sinT;
        this._cible.z = cy * sinT + cz * cosT;
        const cx = this._cible.x, cy2 = this._cible.y;
        this._cible.x = cx * cosR - cy2 * sinR;
        this._cible.y = cx * sinR + cy2 * cosR;
      }

      this._resoudre(mb, this._cible);

      /* Front montant de poser : le son s'y accroche. */
      if (auSol && !this._auSol[mb.nom]) {
        this.posers.push({ nom: mb.nom, pos: mb.sabotMonde.clone(), force: clamp(this.vitesse / 6, 0.25, 1) });
      }
      this._auSol[mb.nom] = auSol;
    }

    /* --- oscillations du corps -------------------------------------------
       Deux appuis par cycle, donc le tangage bat a deux fois la frequence
       de la foulee. Faible amplitude : trop, et l'animal semble boiter.

       CE FACTEUR ETAIT BINAIRE, ET IL CLAQUAIT.

       `bat` valait `enMouvement ? 1 : 0`, et `enMouvement` bascule quand la
       vitesse passe sous 0,05 m/s — ou elle est justement forcee a zero d'un
       coup, juste au-dessus. A cette image-la, tous les termes de foulee du
       corps, du cou, de la tete et de la queue etaient multiplies par zero
       SANS TRANSITION, quelle que soit la position du cycle a cet instant.

       Le cycle, lui, ne tombe pas a un endroit choisi : il tombe ou il veut.
       Sur cinquante arrets et cinquante departs, le pire cas atteint la
       pleine amplitude — 28,6 mm de saut vertical et 35 milliradians de
       roulis EN UNE IMAGE, contre 15,9 mm pour une image de marche normale.
       Deux degres de bascule du torse en un soixantieme de seconde : c'est
       un a-coup, et il se produisait aux dix-huit transitions du parcours,
       donc a chacune des neuf haltes, a l'arrivee comme au depart.

       Le remede existait deja : `_enMarche` est la version amortie de ce
       meme booleen, introduite pour fondre le souffle. La faire servir aux
       deux met fin au claquement sans rien ajouter — et les deux termes
       convergent vers zero ensemble, puisqu'a l'arret le cycle s'aligne sur
       un entier et annule le sinus de son cote.

       `enMouvement` reste binaire la ou il doit l'etre : la cinematique des
       pattes a besoin d'un etat franc pour trancher entre appui et
       suspension. C'est le rendu du corps qu'on lisse, pas la decision. */
    /* La pose calculee avant les pattes, appliquee telle quelle : voir « la
       pose complete du corps ». Le poitrail se souleve un peu plus que la
       croupe a l'inspiration — une inspiration gonfle la cage thoracique,
       pas l'arriere-train — et c'est deja dans `tang`. */
    this.corps.position.y = this.hauteurGarrot + hauteurCorps;
    this.corps.position.x = lat;
    this.corps.rotation.x = tang;
    this.corps.rotation.z = roulTotal;

    /* --- tete, cou, queue -------------------------------------------------
       Un cerf en mouvement balance la tete. A l'arret, il la releve et
       observe. Quand il se retourne vers le visiteur, tout part du cou. */
    /* Le regard commande peut venir de la mise en scene (aux haltes) ou de
       lui-meme (en route). On prend le plus fort des deux plutot que la
       somme : additionnes, ils lui tordraient le cou au-dela du possible. */
    const cibleRegard = Math.max(this.regard, this.regardAuto);
    this._regardLisse = damp(this._regardLisse ?? 0, cibleRegard, 3.2, dt);
    const r = this._regardLisse;

    /* LA TETE STABILISEE.

       Le cou et la tete avaient leur propre hochement, EN PLUS de celui du
       torse dont ils sont les enfants. Les trois s'additionnaient : mesure
       sur une marche etablie, la tete tanguait trois fois plus que le torse
       dans le monde (62 contre 21 milliradians). C'est l'inverse de ce que
       fait un animal.

       Un animal stabilise son regard. Le torse monte et descend a chaque
       foulee, mais la tete, elle, reste posee dans l'espace — c'est le
       reflexe qui permet a un cerf au trot de voir net, et c'est l'un des
       signes les plus surs qu'on regarde un etre vivant plutot qu'un objet
       articule, dont chaque piece herite docilement du mouvement de la
       precedente.

       Deux choses changent donc :

       · le cou et la tete DEFONT ce que fait le torse. Le tangage de foulee
         et celui de l'inertie sont reportes en sens inverse, repartis entre
         le cou et la tete — pas en totalite : une tete parfaitement figee
         dans l'espace se lirait comme une camera fixee sur un corps ;
       · leur hochement propre depend de l'ALLURE. Au pas, un cerf hoche
         franchement la tete a chaque foulee : c'est la signature de cette
         allure, on la garde entiere. Au trot, allure symetrique, la tete
         reste tenue : on n'en garde qu'un dixieme. A un quart, mesure, ce
         hochement residuel suffisait a lui seul a faire tanguer la tete
         presque autant que le torse.

       La pente, elle, n'est defaite qu'en partie : en montee un animal
       releve le nez sans aller jusqu'a garder le regard a l'horizontale. */
    const hoche = this.allure === 'pas' ? 1 : 0.1;
    const oscillation = tangFoulee + this._tangI;
    this.cou.rotation.x = lerp(
      0.10 + Math.sin(this._cycleCorps * Math.PI * 2) * 0.045 * bat * hoche,
      -0.30, r
    ) - oscillation * 0.52 - this._pente * 0.24;
    this.cou.rotation.y = r * 0.95;
    this.tete.rotation.x = lerp(
      -0.16 + Math.sin(this._cycleCorps * Math.PI * 2 + 1.1) * 0.05 * bat * hoche,
      0.22, r
    ) - oscillation * 0.34 - this._pente * 0.16;
    this.tete.rotation.y = r * 0.55;

    /* GRATTAGE : LA TETE PLONGE VERS LE SOL — ET ELLE MONTAIT.

       Le commentaire annoncait une tete qui plonge ; le code AJOUTAIT +0,62
       au cou et +0,30 a la tete, c'est-a-dire qu'il la relevait. Mesure :
       pendant le geste, la tete passait de 1,59 a 1,63 m au-dessus de la
       neige. A chacune des neuf haltes, l'animal grattait donc la neige le
       nez en l'air, au lieu de flairer ce qu'il deterrait.

       Signe inverse, et amplitude revue en mesurant la hauteur du museau :
       il descend de 1,64 a 0,90 m. On ne va pas plus bas — le cou n'a qu'une
       articulation, et au-dela de soixante degres de flexion la peau qui
       l'enveloppe se tordrait sur elle-meme. Le corps bascule en revanche un
       peu vers l'avant (voir `tangLent`) : c'est ainsi qu'un animal baisse
       vraiment la tete, en portant son poids sur ses anterieurs. */
    if (gGratte > 0) {
      this.cou.rotation.x -= gGratte * 1.0;
      this.tete.rotation.x -= gGratte * 0.45;
    }

    /* La secousse : le cou donne l'impulsion, la tete suit en retard et plus
       ample — c'est ce decalage qui fait "il se secoue" plutot que "sa tete
       pivote". Les bois, rigides et parentes a la tete, amplifient encore le
       mouvement, ce qui rend le geste lisible de loin. */
    if (Math.abs(this.secousse) > 0.001) {
      this.cou.rotation.z += this.secousse * 0.16;
      this.tete.rotation.z += this.secousse * 0.30;
      this.tete.rotation.y += this.secousse * 0.12;
    }

    /* La queue : au repos, plus un coup sec de temps en temps, plus un
       balancement passif quand il court — celui-la est subi, pas voulu, donc
       il suit la foulee et non une horloge propre. */
    const coup = Math.sin(this._flick * Math.PI) * (0.9 + Math.random() * 0.05);
    this.queue.rotation.x = 0.12 - coup * 0.62
      + Math.sin(this._cycleCorps * Math.PI * 2) * 0.05 * bat;
    this.queue.rotation.z = coup * 0.30 * (this._flick > 0.5 ? 1 : -1)
      + Math.sin(this._cycleCorps * Math.PI * 4 + 0.7) * 0.04 * bat;

    /* L'OMBRE DE CONTACT SUIT LE SOL.

       Je l'avais listee comme manquante au palier bas : c'etait faux, elle a
       toujours ete la, a tous les paliers. Le vrai defaut est ailleurs —
       c'etait un plan rigoureusement horizontal, alors que le terrain est
       bossele. Sur une pente elle traversait la neige d'un cote et flottait
       de l'autre, ce qui decolle l'animal du sol au lieu de l'y poser.

       On l'incline donc sur la normale du terrain, et on la retrecit quand il
       leve les pattes : une ombre de contact qui garde la meme densite alors
       que l'animal saute est aussi fausse qu'une ombre absente. */
    if (this.ombre) {
      const n = this.relief.normale(this.racine.position.x, this.racine.position.z, this._c);
      // La normale est exprimee dans le monde ; le plan est enfant de la
      // racine, qui tourne autour de Y. On annule donc ce cap.
      const cy = Math.cos(-this.racine.rotation.y), sy = Math.sin(-this.racine.rotation.y);
      const nx = n.x * cy - n.z * sy;
      const nz = n.x * sy + n.z * cy;
      this.ombre.rotation.set(-Math.PI / 2 + Math.atan2(nz, n.y), 0, -Math.atan2(nx, n.y));
      /* QUATRE CENTIMETRES ET DEMI, C'ETAIT TROP PEU.

         Le plan mesure deux metres sur trois ; la neige, elle, ondule de
         plusieurs centimetres sur cette distance, et le shader y ajoute
         encore du relief. Un plan pose a 4,5 cm TRAVERSE donc le sol au
         moindre creux, et la ou il passe dessous il est coupe net : on voit
         apparaitre sous l'animal une arete droite qui n'a rien a faire la.
         C'est ce qu'Antoine appelle l'ombre qui bugge.

         On le monte a quinze centimetres — invisible sous un cerf d'un metre
         quarante au garrot, vu d'un drone — et le decalage de polygone lui
         donne la priorite sur le sol partout ou les deux se frolent encore. */
      this.ombre.position.y = 0.15;
      const contact = this.membres.reduce((c, mb) => c + (this._auSol[mb.nom] ? 1 : 0), 0);
      /* Plus dense — et deux fois moins la ou une vraie carte d'ombre existe
         deja, sinon les deux s'additionnent et le cerf traine une flaque. Au
         palier bas il n'y a AUCUNE ombre portee dans toute la scene : cette
         tache est alors le seul lien entre l'animal et la neige, et c'est
         justement le palier sur lequel la balade sera regardee. */
      const k = this.palier?.ombres ? 0.55 : 1;
      this.ombre.material.opacity = (0.26 + (contact / 4) * 0.30) * k;
    }

    this._majSouffle(dt, temps);
  }

  /* Buee : de petites bouffees expulsees au rythme de la respiration,
     emportees vers l'arriere. Plus visible quand il souffle apres l'effort. */
  _majSouffle(dt, temps) {
    const p = this.souffle;
    const { vie, N } = p.userData;
    const arr = p.geometry.attributes.position.array;
    const debit = 0.4 + this.vitesse * 0.09;

    for (let i = 0; i < N; i++) {
      vie[i] += dt * debit;
      if (vie[i] > 1) {
        vie[i] -= 1;
        // Depart deja disperse : deux naseaux, pas un point.
        arr[i * 3] = (Math.random() - 0.5) * 0.075;
        arr[i * 3 + 1] = (Math.random() - 0.5) * 0.05;
        arr[i * 3 + 2] = -Math.random() * 0.04;
      }
      const v = vie[i];
      /* La bouffee S'EVASE en s'eloignant. Sans cet evasement, les vingt-six
         grains restaient dans un fuseau de trois centimetres et se
         superposaient tous : a trois metres, vingt-six couches a dix-huit
         pour cent d'opacite font quatre-vingt-dix-neuf pour cent, soit une
         plaque blanche opaque plaquee sur le museau. Le defaut ne se voyait
         pas au recul habituel de la camera, mais il apparaissait exactement
         quand le cerf se retourne vers nous — c'est-a-dire aux deux moments
         qui comptent, les haltes et l'adieu. */
      arr[i * 3] += (Math.random() - 0.5) * 0.010 + arr[i * 3] * dt * 1.4;
      arr[i * 3 + 1] += dt * 0.10 + Math.abs(arr[i * 3 + 1]) * dt * 0.9;
      arr[i * 3 + 2] -= dt * (0.55 + v * 0.5);
    }
    p.geometry.attributes.position.needsUpdate = true;
    // Bien plus faible qu'avant : c'est le CUMUL qui donne la densite, pas
    // l'opacite de chaque grain.
    p.material.opacity = 0.075 * clamp(this.vitesse / 4 + 0.35, 0, 1);
  }

  /* Ce qu'il surveille de l'oreille. La mise en scene lui passe la position
     du drone : c'est le seul endroit ou l'animal sait que nous existons. */
  ecouter(point) {
    if (!point) { this._aEcoute = false; return; }
    this._ecoute.copy(point);
    this._aEcoute = true;
  }

  /* Position du garrot dans le monde — la camera vise ce point. */
  ancre(cible = new THREE.Vector3()) {
    return cible.set(
      this.racine.position.x,
      this.racine.position.y + this.hauteurGarrot,
      this.racine.position.z
    );
  }
}
