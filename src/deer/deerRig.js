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

   RESULTAT, MESURE SUR LE PARCOURS ENTIER (pas la seule terrain plat) : le
   pire depassement d'allonge tombe de 65 % a 13 %, en combinant cette
   reduction avec le plafonnement de pente du terrain (`terrain.js`). Le
   residu vient desormais de la geometrie de la foulee elle-meme, plus du
   terrain : reduire encore la foulee (teste jusqu'a 1,05 m) ne le fait
   quasiment plus baisser, le plancher est dans la conformation de la patte,
   pas dans le reglage. Aller plus loin demanderait de changer les
   proportions du modele — hors de propos ici. */
const ALLURES = {
  pas:  { phases: { PG: 0.0, AG: 0.25, PD: 0.5, AD: 0.75 }, appui: 0.64, foulee: 1.20, hauteur: 0.12 },
  trot: { phases: { AG: 0.0, PD: 0.0, AD: 0.5, PG: 0.5 },   appui: 0.42, foulee: 1.30, hauteur: 0.24 },
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
    this._clin = 0;                            // 0 ouvert, 1 ferme
    this._prochainClin = 2 + Math.random() * 4;
    this._flick = 0;                           // coup de queue
    this._prochainFlick = 3 + Math.random() * 5;

    /* --- LA CARESSE : la seule reaction que le spectateur declenche lui-meme.
       Un cerf qu'on touche leve la tete d'un coup et dresse les DEUX
       oreilles vers l'avant — c'est le geste d'alerte, pas le balayage
       paresseux et asymetrique de l'ecoute ambiante. Elle est distincte des
       gestes automatiques (`_geste`) plutot que branchee dessus : ceux-ci
       ne se declenchent qu'« en route » et un a la fois, alors qu'une
       caresse doit repondre a l'instant, quelle que soit l'allure. */
    this._caresseRestant = 0;
    this.caresseFraiche = false;   // consomme une fois par le son

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
      /* LE SENS DE PLIURE.

         Il ne se derive pas au tableau : `rotateOnAxis` tourne autour d'un axe
         exprime dans le repere LOCAL de l'os, et ce repere a deja ete pivote
         par l'orientation vers la cible. Le raisonnement « une rotation
         positive autour de X amene le genou vers l'arriere » est donc faux,
         et c'est ce raisonnement qui avait fixe cette valeur.

         Chez un cervide, le carpe de l'anterieur se plie VERS L'ARRIERE — la
         patte avant se replie comme un bras, jamais vers l'avant. Le jarret du
         posterieur se plie lui aussi vers l'arriere. Les deux membres vont
         donc dans le meme sens ; c'est le decalage des masses, pas le sens de
         pliure, qui les distingue a l'oeil. */
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

    if (this.oreilles) {
      for (const o of this.oreilles) {
        const v = o.userData.cote > 0 ? this._oreilleG : this._oreilleD;
        o.rotation.z = o.userData.reposZ + v * o.userData.cote * 0.9;
        o.rotation.x = o.userData.reposX - v * 0.5;
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

    /* --- CARESSE : domine l'ecoute ambiante par une alerte symetrique ------
       Placee ici, apres le tirage aleatoire et avant le rendu des oreilles :
       elle ne remplace pas le systeme ambiant, elle le DOMINE le temps de sa
       duree (Math.max, jamais une affectation — une oreille deja plus
       dressee que l'alerte ne doit pas redescendre pour elle). L'enveloppe
       monte vite (120 ms — un sursaut), tient, puis retombe sur un tiers de
       seconde : une oreille qui revient au repos brutalement se lit comme un
       bug, pas comme un animal. */
    if (this._caresseRestant > 0) {
      this._caresseRestant -= dt;
      const passe = this._caresseDuree - this._caresseRestant;
      const env = smoothstep(0, 0.12, passe) * smoothstep(this._caresseDuree, this._caresseDuree - 0.35, passe);
      this._oreilleG = Math.max(this._oreilleG, env * 0.62);
      this._oreilleD = Math.max(this._oreilleD, env * 0.62);
      // Il jette aussi un oeil en arriere, vers celui qui l'a touche.
      this.regardAuto = Math.max(this.regardAuto, env * 0.80);
    }
  }

  /* Declenchee par le spectateur : il a touche le cerf. Reactive quelle que
     soit l'allure — contrairement aux gestes ambiants (`_vivre`), qui ne se
     tirent qu'« en route » et jamais plus d'un a la fois, celle-ci doit
     repondre a l'instant ou elle a lieu, pas attendre son tour. */
  caresser() {
    this._caresseDuree = 1.3;
    this._caresseRestant = this._caresseDuree;
    this.caresseFraiche = true;
  }

  maj(dt, temps) {
    this._vivre(dt);
    this._tics(dt);

    /* --- vitesse : montee et descente en douceur -------------------------
       `allant` module la consigne plutot que la vitesse elle-meme : le
       lissage reste seul maitre de l'acceleration, donc aucun a-coup ne
       peut passer, et la relation foulee/vitesse qui interdit le glissement
       des sabots tient toujours. */
    this.vitesse = damp(this.vitesse, this.vitesseCible * this.allant, 2.6, dt);
    if (this.vitesse < 0.05) this.vitesse = 0;

    // L'allure suit la vitesse : on marche a l'approche, on trotte en route.
    this.allure = this.vitesse > 3.4 ? 'trot' : 'pas';
    const A = ALLURES[this.allure];

    /* --- avancee sur le chemin ------------------------------------------- */
    this.s += this.vitesse * dt;
    this.placer(this.s);

    /* --- cycle de foulee -------------------------------------------------
       La duree du cycle decoule de la foulee et de la vitesse. C'est cette
       relation, et elle seule, qui garantit l'absence de glissement. */
    const foulee = A.foulee;
    if (this.vitesse > 0.05) {
      this.cycle = (this.cycle + (this.vitesse * dt) / foulee) % 1;
    } else {
      // A l'arret, on ramene les sabots au repos sans faire tourner le cycle.
      this.cycle = damp(this.cycle, Math.round(this.cycle), 6, dt) % 1;
    }

    const enMouvement = this.vitesse > 0.05;
    const yRacine = this.racine.position.y;

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

      this._resoudre(mb, this._cible);

      /* Front montant de poser : le son s'y accroche. */
      if (auSol && !this._auSol[mb.nom]) {
        this.posers.push({ nom: mb.nom, pos: mb.sabotMonde.clone(), force: clamp(this.vitesse / 6, 0.25, 1) });
      }
      this._auSol[mb.nom] = auSol;
    }

    /* --- oscillations du corps -------------------------------------------
       Deux appuis par cycle, donc le tangage bat a deux fois la frequence
       de la foulee. Faible amplitude : trop, et l'animal semble boiter. */
    const bat = enMouvement ? 1 : 0;
    this.corps.position.y = this.hauteurGarrot
      + Math.sin(this.cycle * Math.PI * 4) * 0.028 * bat;
    this.corps.rotation.x = Math.sin(this.cycle * Math.PI * 4 + 0.8) * 0.030 * bat;
    this.corps.rotation.z = Math.sin(this.cycle * Math.PI * 2) * 0.035 * bat;

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
      0.10 + Math.sin(this.cycle * Math.PI * 2) * 0.045 * bat,
      -0.30, r
    );
    this.cou.rotation.y = r * 0.95;
    this.tete.rotation.x = lerp(-0.16 + Math.sin(this.cycle * Math.PI * 2 + 1.1) * 0.05 * bat, 0.22, r);
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
      + Math.sin(this.cycle * Math.PI * 2) * 0.05 * bat;
    this.queue.rotation.z = coup * 0.30 * (this._flick > 0.5 ? 1 : -1)
      + Math.sin(this.cycle * Math.PI * 4 + 0.7) * 0.04 * bat;

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

  /* Position du garrot dans le monde — la camera vise ce point. */
  ancre(cible = new THREE.Vector3()) {
    return cible.set(
      this.racine.position.x,
      this.racine.position.y + this.hauteurGarrot,
      this.racine.position.z
    );
  }
}
