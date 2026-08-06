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
const ALLURES = {
  pas:  { phases: { PG: 0.0, AG: 0.25, PD: 0.5, AD: 0.75 }, appui: 0.64, foulee: 1.35, hauteur: 0.13 },
  trot: { phases: { AG: 0.0, PD: 0.0, AD: 0.5, PG: 0.5 },   appui: 0.42, foulee: 2.25, hauteur: 0.26 },
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

    /* Position de repos de chaque sabot, dans le repere du corps. */
    for (const mb of this.membres) {
      // On vise le bas du canon : le sabot, rigide, ajoute sa propre hauteur.
      mb.repos = new THREE.Vector3(
        mb.attache.position.x * 1.02,
        -this.hauteurGarrot + 0.035,   // le sabot s'enfonce dans la poudreuse
        mb.attache.position.z + (mb.avant ? 0.02 : -0.02)
      );
      mb.sabotMonde = new THREE.Vector3();
      mb.sens = mb.avant ? -1 : 1;      // coude vers l'arriere, jarret vers l'avant
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

  maj(dt, temps) {
    /* --- vitesse : montee et descente en douceur ------------------------- */
    this.vitesse = damp(this.vitesse, this.vitesseCible, 2.6, dt);
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
    const cibleRegard = this.regard;
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

    this.queue.rotation.x = Math.sin(temps * 1.7) * 0.16 + 0.12;
    this.queue.rotation.z = Math.sin(temps * 2.3) * 0.10;

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
        arr[i * 3] = (Math.random() - 0.5) * 0.03;
        arr[i * 3 + 1] = (Math.random() - 0.5) * 0.03;
        arr[i * 3 + 2] = 0;
      }
      const v = vie[i];
      arr[i * 3] += (Math.random() - 0.5) * 0.006;
      arr[i * 3 + 1] += dt * 0.10;
      arr[i * 3 + 2] -= dt * (0.55 + v * 0.5);
    }
    p.geometry.attributes.position.needsUpdate = true;
    p.material.opacity = 0.20 * clamp(this.vitesse / 4 + 0.35, 0, 1);
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
