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
      /* Ou ce sabot-la est pose. Sert au rangement : quand l'animal s'arrete,
         un sabot qui PORTE ne doit pas bouger d'un millimetre, et c'est cette
         valeur qu'on lui tient pendant qu'il attend son tour de rentrer. */
      mb.zGel = mb.repos.z;
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
    const viseI = clamp(-acc * 0.0062, -0.075, 0.075);
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

    /* --- cycle de foulee -------------------------------------------------
       La duree du cycle decoule de la foulee et de la vitesse. C'est cette
       relation, et elle seule, qui garantit l'absence de glissement. */
    const foulee = A.foulee;

    /* LE RANGEMENT DES PATTES, ET CE QUI NE MARCHAIT PAS AVANT.

       L'ancienne branche « a l'arret » amortissait `cycle` vers l'entier le
       plus proche, avec pour commentaire qu'elle ramenait ainsi les sabots au
       repos. Elle ne ramenait rien du tout : plus bas, tout le calcul de
       foulee etait saute d'un bloc des que l'animal s'arretait, si bien que
       les cibles se retrouvaient au repos AVANT que ce lissage ait le moindre
       effet. Le cycle convergeait donc dans le vide, pendant que les sabots,
       eux, se TELEPORTAIENT de leur position de foulee a leur position de
       repos en une seule image — 156 mm mesures pour un sabot cense porter
       l'animal, a chacune des neuf haltes.

       Un animal qui s'arrete ne fait pas cela : il finit son pas. Le sabot
       qui porte reste plante ou il est, et c'est celui qui est en l'air qui
       se repose a sa place definitive. On entretient donc une cadence
       residuelle pendant un peu moins d'une seconde apres l'arret — assez
       pour que le cycle fasse un tour complet et que les quatre sabots aient
       chacun leur moment de vol, dans leur ordre habituel. */
    /* Le rangement s'arrete quand il est FINI, pas quand une minuterie expire.
       Fixe a 0,88 s, il coupait parfois avant qu'un sabot ait eu son tour de
       vol : celui-la restait en arriere puis rejoignait sa place d'un bond a
       l'image ou la branche cessait de s'appliquer. On le termine donc sur
       l'etat reel — les quatre sabots chez eux — avec un plafond de securite
       pour qu'aucune configuration imprevue ne le laisse tourner sans fin. */
    if (this.vitesse > 0.05) this._rangement = 1;
    else if (this._rangement > 0) {
      const restants = this.membres.some((mb) => mb.zGel !== mb.repos.z);
      this._rangement = restants ? Math.max(0, this._rangement - dt / 2.2) : 0;
    }

    const cadence = this.vitesse > 0.05
      ? this.vitesse
      : (this._rangement > 0 ? foulee * 1.25 : 0);
    if (cadence > 0) this.cycle = (this.cycle + (cadence * dt) / foulee) % 1;

    /* LE TORSE ET LES PATTES N'ONT PLUS LA MEME HORLOGE.

       Le tangage du corps, le balancement du cou, de la tete et de la queue
       suivaient tous `cycle`. Or `cycle` continue desormais de tourner apres
       l'arret, pour que les pattes finissent leur pas : le torse s'est donc
       mis a rouler alors que l'animal ne bougeait plus. Ce roulis-la n'est
       pas compense sur les sabots — a raison, pendant la marche c'est la
       foulee qui decide ou le pied se pose — et il les faisait donc patiner
       de 16 mm par image pendant tout le rangement.

       Deux mouvements distincts veulent deux horloges : celle des pattes
       tourne encore un pas apres l'arret, celle du corps se fige des que
       l'animal s'immobilise. C'est aussi ce que fait l'animal — le torse se
       tasse pendant que les pattes se rangent, il ne continue pas a tanguer.
       L'extinction reste douce puisque `bat` fond separement. */
    if (this.vitesse > 0.05) {
      this._cycleCorps = (this._cycleCorps + (this.vitesse * dt) / foulee) % 1;
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
    const tang = -souffle * 0.004 * auRepos + this._tangI;
    const cosR = Math.cos(-roul), sinR = Math.sin(-roul);
    const cosT = Math.cos(-tang), sinT = Math.sin(-tang);

    /* --- chaque membre ---------------------------------------------------- */
    for (const mb of this.membres) {
      const phase = (this.cycle + (1 - ALLURES[this.allure].phases[mb.nom])) % 1;
      this._cible.copy(mb.repos);

      let auSol = true;

      if (enMouvement) {
        // Le museau pointe vers -Z : "devant" est donc en z negatif.
        const demi = foulee * 0.25;
        if (phase < A.appui) {
          /* APPUI — le sabot est immobile dans le monde. Vu du corps qui
             avance, il derive donc de l'avant vers l'arriere, exactement a
             la vitesse d'avance : c'est ce qui interdit tout glissement. */
          const u = phase / A.appui;
          this._cible.z = mb.repos.z + lerp(-demi, demi, u);
        } else {
          /* SUSPENSION — il repart devant en decrivant un arc. */
          const u = (phase - A.appui) / (1 - A.appui);
          this._cible.z = mb.repos.z + lerp(demi, -demi, u);
          this._cible.y += Math.sin(u * Math.PI) * A.hauteur;
          auSol = false;
        }
        // La ou il pose : c'est de la qu'il repartira pour rentrer.
        mb.zGel = this._cible.z;
      } else if (this._rangement > 0) {
        /* RANGEMENT — il finit son pas.

           Le corps ne bouge plus. Toute derive d'un sabot en appui est donc
           un RACLEMENT, et non plus le glissement compense d'une foulee : on
           le tient rigoureusement immobile a l'endroit ou il s'est pose.
           C'est le sabot en l'air, et lui seul, qui rejoint sa place — les
           quatre y passent chacun leur tour, dans l'ordre de l'allure, parce
           que la cadence residuelle fait encore tourner le cycle.

           J'ai failli faire bien plus simple et bien plus faux : eteindre
           progressivement l'amplitude de la foulee. Cela aurait supprime la
           teleportation, mais en etalant ses 156 mm sur une seconde — le
           sabot en appui aurait alors RACLE le sol au lieu de s'y teleporter.
           Un defaut lisse reste un defaut ; il devient meme plus difficile a
           nommer quand on le voit. */
        if (phase >= A.appui) {
          const u = (phase - A.appui) / (1 - A.appui);
          this._cible.z = lerp(mb.zGel, mb.repos.z, smoothstep(0, 1, u));
          this._cible.y += Math.sin(u * Math.PI) * A.hauteur * 0.62;
          auSol = false;
        } else {
          /* C'EST LE RETOUR AU SOL QUI ACTE LE PAS, PAS UN SEUIL SUR LA PHASE.

             J'avais d'abord ecrit `if (u > 0.98) mb.zGel = mb.repos.z`. A la
             cadence de rangement, la phase avance de deux centiemes par
             image : ce dernier centieme est enjambe une fois sur deux, le
             sabot se posait sans que sa nouvelle place soit enregistree, et
             l'image suivante le renvoyait a son ancienne position. Le
             remede etait pire que le mal — 277 mm de saut contre 156 avant
             correction. Un seuil qu'on ne franchit qu'en l'echantillonnant
             pile au bon moment n'est pas une condition, c'est un pari.

             On lit donc l'etat d'appui de l'image PRECEDENTE (`_auSol` n'est
             ecrit qu'en fin de boucle) : s'il volait et qu'il touche, le pas
             est fini, quel que soit l'endroit ou l'echantillonnage est tombe. */
          if (!this._auSol[mb.nom]) mb.zGel = mb.repos.z;
          this._cible.z = mb.zGel;
        }
      }

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
      this._cible.y -= leve;
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
    const bat = this._enMarche;
    this.corps.position.y = this.hauteurGarrot
      + Math.sin(this._cycleCorps * Math.PI * 4) * 0.028 * bat
      + leve;
    this.corps.position.x = lat;
    /* Le poitrail se souleve un peu plus que la croupe : une inspiration
       gonfle la cage thoracique, pas l'arriere-train. Quatre milliemes de
       radian, soit un quart de degre — invisible isolement, mais c'est ce
       qui distingue un corps qui respire d'un corps qu'on monte au cric. */
    this.corps.rotation.x = Math.sin(this._cycleCorps * Math.PI * 4 + 0.8) * 0.030 * bat
      + tang;
    /* Le roulis de foulee n'est PAS compense sur les sabots, lui : pendant
       la marche c'est la foulee qui decide ou le pied se pose, et cette
       bascule-la fait partie du mouvement. Seul le report d'appui a l'arret
       l'est, puisque la, par definition, rien ne doit bouger au sol. */
    this.corps.rotation.z = Math.sin(this._cycleCorps * Math.PI * 2) * 0.035 * bat + roul;

    /* --- tete, cou, queue -------------------------------------------------
       Un cerf en mouvement balance la tete. A l'arret, il la releve et
       observe. Quand il se retourne vers le visiteur, tout part du cou. */
    /* Le regard commande peut venir de la mise en scene (aux haltes) ou de
       lui-meme (en route). On prend le plus fort des deux plutot que la
       somme : additionnes, ils lui tordraient le cou au-dela du possible. */
    const cibleRegard = Math.max(this.regard, this.regardAuto);
    this._regardLisse = damp(this._regardLisse ?? 0, cibleRegard, 3.2, dt);
    const r = this._regardLisse;

    this.cou.rotation.x = lerp(
      0.10 + Math.sin(this._cycleCorps * Math.PI * 2) * 0.045 * bat,
      -0.30, r
    );
    this.cou.rotation.y = r * 0.95;
    this.tete.rotation.x = lerp(-0.16 + Math.sin(this._cycleCorps * Math.PI * 2 + 1.1) * 0.05 * bat, 0.22, r);
    this.tete.rotation.y = r * 0.55;

    // Grattage : la tete plonge vers le sol.
    if (this.grattage > 0) {
      const g = smoothstep(0, 0.25, this.grattage) * smoothstep(1, 0.75, this.grattage);
      this.cou.rotation.x += g * 0.62;
      this.tete.rotation.x += g * 0.30;
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
