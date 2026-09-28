/* LES ATTITUDES DU CERF.

   Le rig sait marcher, trotter, s'arreter, gratter, se retourner vers nous.
   Il ne savait pas REAGIR. Autour de lui, depuis que la foret est habitee,
   des bouvreuils s'envolent a trois metres de son museau, un lievre detale
   devant ses sabots, une chouette traverse le chemin a hauteur de ses bois
   — et il continuait droit devant, la tete dans l'axe, comme si rien
   n'avait eu lieu. C'est le genre d'indifference qui trahit une machine
   plus surement qu'un pied qui glisse.

   Ce module lui donne quatre choses, toutes tirees de ce que fait un
   cervide, et qui ne demandent a la mise en scene qu'une ligne chacune :

   1. L'ATTENTION. On lui designe un point ; il y tourne la tete et les
      oreilles. Pas en le suivant continument — un animal ne regarde pas
      comme une camera motorisee — mais par SACCADES : la tete pivote vite
      vers un nouvel angle, puis s'y immobilise, puis se recale d'un coup
      quand la cible s'est trop deplacee. C'est cette alternance de
      mouvements vifs et d'arrets nets qui fait lire « il a vu quelque
      chose », la ou un suivi lisse fait lire « il est asservi a quelque
      chose ». Un evenement brusque le fait en plus SURSAUTER : la tete se
      releve d'un coup, la queue part.

   2. LA NEIGE SUR LE DOS. Il neige pendant toute la balade, et le cerf
      reste de longues secondes immobile a chaque halte, le temps qu'on lise
      une carte. La neige s'y pose donc, en plaques, sur ce qui regarde le
      ciel : l'echine, la croupe, le dessus du cou et du crane.

   3. L'EBROUEMENT. Quand il y en a assez et qu'il est immobile depuis un
      moment, il s'en debarrasse comme le fait tout mammifere a fourrure :
      une onde qui part de la tete, gagne le cou, puis secoue tout le torse
      a plus de quatre battements par seconde, en projetant la neige de part
      et d'autre. Le dos redevient brun. C'est une petite histoire en trois
      temps — la neige tombe, elle s'accumule, il s'ebroue — et elle se
      raconte toute seule pendant qu'on lit la carte.

   4. LE FLAIRAGE. Un cerf ne gratte pas la neige au hasard : il flaire
      d'abord, le museau au ras du sol, par petites inspirations rapides, et
      ne frappe du sabot qu'une fois arrete sur ce qu'il a senti. Jusqu'ici,
      le premier coup de patte tombait un tiers de seconde apres l'ordre de
      creuser — alors que le cerf, qui arrive au pas, mettait encore une
      seconde et demie a s'arreter : il grattait en marchant.

   Tout ce qui fait tourner le corps (le roulis de l'ebrouement) est calcule
   AVANT les pattes et compense sur les sabots, comme le reste de la pose :
   les pieds ne bougent pas quand le cerf se secoue, ce sont les pattes qui
   plient. Voir « la pose complete du corps » dans deerRig.js. */

import * as THREE from 'three';
import { clamp, damp, smoothstep } from '../core/noise.js';

/* Duree d'un ebrouement complet, et frequence du battement du torse. Un
   chien mouille bat a quatre ou cinq hertz ; un cerf, plus lourd, un peu
   moins vite. */
const DUREE_EBROUE = 1.45;
const HZ_EBROUE = 4.2;

/* La neige : combien de temps d'immobilite pour que le dos soit couvert, et
   au bout de combien d'immobilite il envisage de s'ebrouer. Quarante-cinq
   secondes pour un dos couvert, c'est un ebrouement toutes les vingt
   secondes environ pendant une longue lecture : assez pour qu'on le voie a
   presque chaque halte, pas assez pour qu'il devienne un tic. */
const SECONDES_POUR_COUVRIR = 45;
const ATTENTE_AVANT_EBROUE = 4.5;
const NEIGE_POUR_EBROUE = 0.42;

export class Attitudes {
  constructor(cerf) {
    this.cerf = cerf;

    // --- l'attention -------------------------------------------------------
    this.vise = new THREE.Vector3();
    this._demande = 0;           // force demandee a cette image
    this.k = 0;                  // attention lissee, 0..1
    this.lacet = 0;              // angle horizontal courant de la tete, relatif au corps
    this.tangage = 0;            // angle vertical courant
    this._lacetTenu = 0;         // angle vise par la derniere saccade
    this._tangageTenu = 0;
    this._depuisSaccade = 0;
    this.sursaut = 0;            // 1 au sursaut, retombe en une demi-seconde

    // --- la neige et l'ebrouement ----------------------------------------------
    /* Un peu de neige des le depart : le cerf attendait a la lisiere avant
       que la balade ne commence. */
    this.neige = 0.3;
    this.immobile = 0;
    this.ebroue = -1;            // < 0 : au repos ; sinon, temps ecoule
    this.roulis = 0;             // roulis du torse, lu par le rig avant les pattes
    this._roulisV = 0;
    this._emission = 0;
    this._prochainEssai = 0;

    // --- le flairage ---------------------------------------------------------
    this.flaire = 0;             // 0..1, museau au ras de la neige
    this.frappe = 0;             // 0..1, la patte a le droit de frapper
    this._frappeT = 0;           // horloge propre des coups de sabot
    this._temps = 0;

    /* Evenements pour la mise en scene, vides par elle a chaque image :
       { type: 'ebrouement' } au debut du geste (le son),
       { type: 'neige', x, y, z, dx, dz, force } pour chaque bouffee projetee. */
    this.evenements = [];
  }

  /* Designer ce qui l'interesse, a chaque image tant que ca dure. `force`
     proche de 1 pour un evenement brusque (il sursaute), plus faible pour
     une simple curiosite. Sans nouvel appel, l'attention retombe d'elle-
     meme : l'appelant n'a rien a relacher. */
  interesser(point, force = 1) {
    if (force <= this._demande) return;
    this.vise.copy(point);
    this._demande = force;
  }

  /* Ce qu'il ecoute de preference : l'objet de son attention quand il y en
     a un, sinon rien (le rig retombe alors sur le drone). */
  get source() { return this.k > 0.3 ? this.vise : null; }

  maj(dt, temps) {
    const c = this.cerf;
    this._temps = temps;
    this._majAttention(dt, c);
    this._majNeige(dt, c);
    this._majEbrouement(dt, temps, c);
    this._majFlairage(dt, c);
  }

  /* --- 1. L'ATTENTION ------------------------------------------------------- */
  _majAttention(dt, c) {
    const demande = this._demande;
    this._demande = 0;

    // Le sursaut : seulement si l'evenement surgit, pas s'il dure.
    if (demande >= 0.9 && this.k < 0.2 && this.sursaut <= 0) {
      this.sursaut = 1;
      c._flick = 1;              // la queue part avec la tete
    }
    if (this.sursaut > 0) this.sursaut = Math.max(0, this.sursaut - dt / 0.55);

    /* L'attention monte vite (on tourne la tete en un quart de seconde) et
       redescend lentement : on continue un moment a regarder la ou la chose
       a disparu, avant de s'en desinteresser. */
    this.k = damp(this.k, demande, demande > this.k ? 7 : 1.1, dt);
    if (this.k < 0.002 && demande <= 0) {
      this.lacet = damp(this.lacet, 0, 3, dt);
      this.tangage = damp(this.tangage, 0, 3, dt);
      return;
    }

    /* L'angle de la cible dans le repere du corps. Le museau pointe vers -Z,
       et une rotation positive autour de Y tourne -Z vers -X : l'angle qui
       amene le museau sur la cible est donc atan2(-x, -z). Le signe est
       verifie par build/rig.mjs, qui mesure ou pointe vraiment le museau. */
    const r = c.racine;
    const dx = this.vise.x - r.position.x, dz = this.vise.z - r.position.z;
    const cap = r.rotation.y;
    const lx = Math.cos(cap) * dx - Math.sin(cap) * dz;
    const lz = Math.sin(cap) * dx + Math.cos(cap) * dz;
    const d = Math.hypot(lx, lz);
    /* Un cerf ne tourne pas la tete au-dela de quatre-vingts degres environ
       sans tourner les epaules ; au-dela, il regarde du coin de l'oeil — et
       ses yeux, sur les cotes du crane, voient presque derriere lui. */
    const lacetVoulu = clamp(Math.atan2(-lx, -lz), -1.35, 1.35);
    const hauteurYeux = r.position.y + 1.55;
    const tangageVoulu = clamp(Math.atan2(this.vise.y - hauteurYeux, Math.max(d, 1)), -0.35, 0.55);

    /* LA SACCADE. On ne suit la cible que lorsqu'elle s'est assez deplacee
       — ou, plus lentement, quand on la tient depuis un moment. Entre deux,
       l'angle tenu ne bouge pas. */
    this._depuisSaccade += dt;
    const ecart = Math.abs(lacetVoulu - this._lacetTenu) + Math.abs(tangageVoulu - this._tangageTenu) * 0.7;
    if (ecart > 0.16 || (this._depuisSaccade > 0.7 && ecart > 0.05)) {
      this._lacetTenu = lacetVoulu;
      this._tangageTenu = tangageVoulu;
      this._depuisSaccade = 0;
    }
    // Rapide vers l'angle tenu : c'est le mouvement vif de la saccade.
    this.lacet = damp(this.lacet, this._lacetTenu, 13, dt);
    this.tangage = damp(this.tangage, this._tangageTenu, 11, dt);
  }

  /* Ce que l'attention ajoute au cou et a la tete, apres tout le reste.
     `retenue` : ce qui l'en empeche (la tete dans la neige, le regard mis en
     scene vers le visiteur). */
  poserTete(retenue) {
    const c = this.cerf;
    const k = this.k * (1 - clamp(retenue, 0, 1));
    if (k > 0.001) {
      // Le cou porte l'essentiel du lacet, la tete finit le geste.
      c.cou.rotation.y += this.lacet * 0.6 * k;
      c.tete.rotation.y += this.lacet * 0.4 * k;
      // Rotation positive = avant souleve (convention mesuree).
      c.cou.rotation.x += this.tangage * 0.55 * k;
      c.tete.rotation.x += this.tangage * 0.45 * k;
    }
    if (this.sursaut > 0) {
      // Une bosse breve : la tete monte d'un coup, puis se pose.
      const s = Math.sin(this.sursaut * Math.PI) * this.sursaut;
      c.cou.rotation.x += 0.20 * s;
      c.tete.rotation.x -= 0.06 * s;
    }

    /* L'EBROUEMENT, COTE TETE. L'onde part de la tete (les oreilles, le
       crane) et descend vers le torse : la tete bat donc la premiere, puis le
       cou avec un retard de phase, pendant que le torse — plus bas, dans le
       rig — ne s'ebranle qu'ensuite. C'est ce decalage qui fait l'onde. */
    if (this.ebroue >= 0) {
      const u = this.ebroue / DUREE_EBROUE;
      const w = this.ebroue * Math.PI * 2 * HZ_EBROUE;
      const eTete = smoothstep(0.0, 0.10, u) * (1 - smoothstep(0.55, 0.95, u));
      const eCou = smoothstep(0.06, 0.22, u) * (1 - smoothstep(0.65, 1.0, u));
      c.tete.rotation.z += Math.sin(w + 1.6) * 0.34 * eTete;
      c.tete.rotation.y += Math.sin(w + 1.1) * 0.10 * eTete;
      c.cou.rotation.z += Math.sin(w + 0.8) * 0.16 * eCou;
    }

    /* LE FLAIRAGE, COTE TETE : le museau plonge un peu plus bas que pour
       gratter, et la tete palpite par petites inspirations — six par
       seconde, deux centimetres d'amplitude au bout du museau. */
    if (this.flaire > 0.001) {
      const palpite = Math.sin(this._temps * Math.PI * 2 * 6.0);
      c.tete.rotation.x -= this.flaire * (0.16 + palpite * 0.028);
    }
  }

  /* --- 2. LA NEIGE ------------------------------------------------------------ */
  _majNeige(dt, c) {
    if (c.vitesse < 0.05) this.immobile += dt;
    else this.immobile = 0;
    /* Elle ne tient qu'a l'arret. En marche, elle glisse et tombe peu a peu
       — lentement : un trot ne secoue pas la fourrure, il la berce. */
    if (this.immobile > 1.5 && this.ebroue < 0) this.neige = Math.min(1, this.neige + dt / SECONDES_POUR_COUVRIR);
    else if (c.vitesse > 0.5) this.neige = Math.max(0, this.neige - dt / 150);

    const u = c.materiau?.userData?.neige;
    // Jamais un dos entierement blanc : c'est une couche, pas un manteau.
    if (u) u.value = Math.min(this.neige, 0.85);
  }

  /* --- 3. L'EBROUEMENT --------------------------------------------------------- */
  _majEbrouement(dt, temps, c) {
    if (this.ebroue < 0) {
      this._prochainEssai -= dt;
      /* Ni pendant qu'il gratte, ni pendant qu'il regarde quelque chose, ni
         pendant qu'une apparition le retient : il est alors cense la
         regarder, et un ebrouement lui volerait la scene. Le journal de la
         balade l'a montre se secouant devant Spider-Man et sous Gargantua. */
      const libre = c.grattage <= 0 && this.k < 0.2 && !c.retenu;
      if (libre && this.immobile > ATTENTE_AVANT_EBROUE && this.neige > NEIGE_POUR_EBROUE
          && this._prochainEssai <= 0) {
        /* Pas a heure fixe : un essai par seconde, une chance sur trois.
           Sans ce hasard, il s'ebrouerait a la meme seconde de chaque halte
           et le procede se verrait des la deuxieme. */
        this._prochainEssai = 1;
        if (Math.random() < 0.34) {
          this.ebroue = 0;
          this._emission = 0;
          this.evenements.push({ type: 'ebrouement' });
        }
      }
    }

    let cible = 0;
    if (this.ebroue >= 0) {
      this.ebroue += dt;
      const u = this.ebroue / DUREE_EBROUE;
      if (u >= 1) {
        this.ebroue = -1;
        this.immobile = 0;       // il ne recommence pas aussitot
      } else {
        /* Le torse : un battement a quatre hertz, qui s'ebranle apres la
           tete et s'eteint le dernier. Dix centiemes de radian, soit six
           degres de part et d'autre : de loin, c'est tout le corps qui
           tremble ; de pres, on voit les pattes plier en alternance. */
        const e = smoothstep(0.12, 0.32, u) * (1 - smoothstep(0.62, 1.0, u));
        cible = Math.sin(this.ebroue * Math.PI * 2 * HZ_EBROUE) * 0.10 * e;

        // La neige quitte le dos pendant qu'il se secoue.
        this.neige = Math.max(0, this.neige - dt * this.neige * 3.2 * e - dt * 0.05);
        this._projeter(dt, u, e, c);
      }
    }
    /* Le roulis suit sa consigne par un ressort raide plutot que d'y etre
       colle : un torse a de la masse, le battement doit s'arrondir. */
    const w = 38;
    const a = w * w * (cible - this.roulis) - 2 * w * this._roulisV;
    this._roulisV += a * Math.min(dt, 1 / 60);
    this.roulis += this._roulisV * Math.min(dt, 1 / 60);
    if (!(Math.abs(this.roulis) < 1)) { this.roulis = 0; this._roulisV = 0; }
  }

  /* Des bouffees de neige, projetees de part et d'autre de l'echine au
     rythme du battement. Deux points par emission, pris le long du dos. */
  _projeter(dt, u, e, c) {
    if (u < 0.14 || u > 0.9 || this.neige < 0.02) return;
    this._emission -= dt;
    if (this._emission > 0) return;
    this._emission = 0.055;
    const r = c.racine;
    const cap = r.rotation.y;
    const sn = Math.sin(cap), cs = Math.cos(cap);
    // Le cote vers lequel le torse part a cet instant : la neige est jetee
    // dans le sens du mouvement, comme l'eau d'un chien mouille.
    const cote = Math.sign(this._roulisV) || 1;
    for (let i = 0; i < 2; i++) {
      const long = -0.55 + Math.random() * 1.15;     // de la croupe au garrot
      const lat = (Math.random() - 0.5) * 0.22;
      const x = r.position.x + sn * long + cs * lat;
      const z = r.position.z + cs * long - sn * lat;
      const y = r.position.y + c.hauteurGarrot + 0.08 + Math.random() * 0.06;
      /* Poudre.poser chasse la neige a l'OPPOSE de la direction donnee : on
         lui passe donc l'inverse du cote vise. Le cote du corps, en monde,
         est (cos cap, -sin cap). */
      this.evenements.push({
        type: 'neige', x, y, z,
        dx: -cs * cote, dz: sn * cote,
        force: 0.45 + 0.45 * e * Math.min(1, this.neige * 2.5),
      });
    }
  }

  /* --- 4. LE FLAIRAGE -------------------------------------------------------- */
  _majFlairage(dt, c) {
    const g = c.grattage;
    if (g <= 0) {
      this.flaire = damp(this.flaire, 0, 6, dt);
      // Le geste fini, la patte REVIENT : la remettre a zero d'un coup la
      // teleportait de sept centimetres (mesure : build/rig.mjs).
      this.frappe = damp(this.frappe, 0, 9, dt);
      if (this.frappe > 0.01) this._frappeT += dt;
      else { this.frappe = 0; this._frappeT = 0; }
      return;
    }
    /* Il flaire tant qu'il avance encore ou tant que le premier tiers du
       geste n'est pas ecoule ; il ne frappe qu'une fois arrete. */
    const arrete = c.vitesse < 0.25;
    const peutFrapper = arrete && g > 0.36;
    this.flaire = damp(this.flaire, peutFrapper ? 0 : smoothstep(0.02, 0.14, g), 7, dt);
    // La patte s'engage et se desengage en douceur : elle ne se teleporte pas
    // a la fin du geste.
    this.frappe = damp(this.frappe, peutFrapper ? 1 - smoothstep(0.88, 1.0, g) : 0, 9, dt);
    if (this.frappe > 0.01) this._frappeT += dt;
  }

  /* Le coup de sabot, pour la patte avant droite : de combien elle avance et
     monte, et si elle touche le sol. Deux coups et demi par seconde. */
  coupDeSabot() {
    return Math.sin(this._frappeT * Math.PI * 2 * 1.25 - Math.PI / 2);
  }
}
