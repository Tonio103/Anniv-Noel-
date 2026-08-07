/* La camera — un drone qui suit le cerf.

   C'est elle qui porte la promesse de toute l'experience : un seul plan, du
   debut a la fin, sans coupe ni fondu. Tout ce qui suit sert a ce que ce
   plan unique ne soit jamais ennuyeux ni mecanique.

   Quatre principes :

   · RETARD ELASTIQUE. La camera ne colle pas au cerf, elle le rattrape.
     Un amortissement de type ressort, plus mou horizontalement que
     verticalement, fait qu'elle prend du retard dans les virages puis
     revient — exactement ce que fait un pilote qui suit un animal.

   · DERIVE LENTE. La position laterale et la hauteur oscillent sur des
     periodes longues et premieres entre elles, si bien que le cadrage ne se
     repete jamais a l'identique.

   · MAIN LEVEE. Un bruit continu de faible amplitude sur la position et sur
     la visee. Sans lui, l'image est trop propre et trahit la machine ;
     avec, on croit a un appareil tenu en l'air.

   · INCLINAISON EN VIRAGE. Le drone s'incline vers l'interieur quand il
     derive lateralement. C'est le detail qui fait "engin volant" plutot que
     "camera sur rail".
*/

import * as THREE from 'three';
import { makeNoise2D } from '../core/noise.js';
import { damp, clamp, lerp, smoothstep } from '../core/noise.js';

export class Drone {
  constructor(camera, chemin, relief, palier) {
    this.camera = camera;
    this.chemin = chemin;
    this.relief = relief;
    this.palier = palier;

    this.bruit = makeNoise2D(5150);

    /* Cadrage de croisiere : derriere, un peu au-dessus, legerement de cote. */
    this.recul = 7.6;
    this.hauteur = 2.9;
    this.lateral = 1.6;

    this.reculCible = this.recul;
    this.hauteurCible = this.hauteur;
    this.lateralCible = this.lateral;

    this.pos = new THREE.Vector3();
    this.vise = new THREE.Vector3();
    this.roulis = 0;
    this.fov = 58;
    this.fovCible = 58;

    this._precPos = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
    this._cibleVisee = new THREE.Vector3();
    this._cote = new THREE.Vector3();
    this._tan = new THREE.Vector3();
    this._interet = null;
    this._forceInteret = 0;
    this._premiere = true;

    this.orbite = 0;
    this.orbiteVitesse = 0;
    this.descente = 0;
    this.descenteCible = 0;
  }

  /* Un point a regarder en plus du cerf — typiquement le cadeau qui sort de
     la neige. La force fait basculer le cadrage de l'un a l'autre. */
  regarder(point, force) {
    this._interet = point;
    this._forceInteret = force;
  }

  /* Cadrages memorises, choisis selon le moment de la balade. */
  cadrer(nom) {
    const c = {
      // En route : assez loin pour voir le cerf en entier et les troncs defiler.
      route:   { recul: 7.8, hauteur: 3.0, lateral: 1.7, fov: 58, biais: 0, bas: 0 },
      // A l'approche d'une halte : on se rapproche et on descend.
      approche:{ recul: 6.0, hauteur: 2.3, lateral: 2.6, fov: 55, biais: 0, bas: 0 },
      // Le cadeau sort : on passe sur le cote, presque au ras de la neige.
      halte:   { recul: 4.6, hauteur: 1.7, lateral: 3.4, fov: 52, biais: 0, bas: 0 },
      // Lecture : on s'ecarte pour laisser la place a la carte.
      lecture: { recul: 6.4, hauteur: 2.4, lateral: 3.9, fov: 54, biais: 0, bas: 0 },
      /* Depart et final : plan large. Le cerf est volontairement decale et
         place bas dans le cadre — au seuil, le titre occupe tout le centre,
         et un sujet centre finit cache derriere. Le decalage sert aussi la
         composition partout ailleurs. */
      /* Au seuil, le titre occupe tout le centre de l'ecran. Il ne suffit
         PAS d'ecarter la camera pour degager le cerf : elle pivote pour le
         garder dans l'axe, et il revient au milieu. C'est la VISEE qu'il faut
         decaler — on regarde a cote et au-dessus de lui, ce qui le repousse
         vers le bas et sur un cote du cadre. */
      large:   { recul: 12.5, hauteur: 4.8, lateral: 3.0, fov: 62, biais: 3.4, bas: 2.2 },
    }[nom];
    if (!c) return;
    this.reculCible = c.recul;
    this.hauteurCible = c.hauteur;
    this.lateralCible = c.lateral;
    this.fovCible = c.fov;
    this.biaisCible = c.biais || 0;
    this.basCible = c.bas || 0;
  }

  /* LE DRONE SE POSE.

     Tant que la camera suit, il n'y a pas de fin : le cerf a beau s'eloigner,
     il reste au centre du cadre et on attend la suite. Une fin, c'est le
     moment ou l'appareil RENONCE A SUIVRE et le laisse sortir du champ.

     On ne coupe pas tout pour autant : le flottement de main levee et la
     respiration de l'objectif continuent. Une image parfaitement immobile
     ferait croire a un plantage — c'est le contraire de l'effet cherche. */
  figer(pointVise, position) {
    if (this.fige) return;
    this.fige = true;
    /* On peut IMPOSER la position finale au lieu de garder celle qu'on avait.
       C'est indispensable : la camera de suivi se trouvait au hasard de sa
       derive au moment ou la fin se declenche, et se figer sur place l'a
       plantee en plein milieu de l'arc de bougies, qui remplissait alors
       l'ecran de piliers blancs. Une derniere image se compose, elle ne se
       constate pas. */
    this._posFigee = (position || this.pos).clone();
    this._viseFigee = (pointVise || this.vise).clone();
    // La camera y va en glissant, elle n'y saute pas.
    this._arrivee = 0;
  }

  liberer() {
    this.fige = false;
    this._premiere = true;
    this.orbite = 0;
    this.orbiteCible = 0;
    this.descente = 0;
    this.descenteCible = 0;
  }

  /* L'ARC DE HALTE.

     Une halte durait une quinzaine de secondes pendant lesquelles la camera
     ne faisait rien : elle prenait un cadrage et le tenait. Or c'est
     precisement le moment ou le visiteur lit, donc celui ou une image figee
     se remarque le plus — et une image figee sur laquelle du texte s'affiche,
     c'est la definition d'une diapositive.

     On lui donne donc un MOUVEMENT PROPRE : la camera contourne lentement le
     paquet pendant qu'il sort et pendant qu'on lit. C'est le geste de base du
     plan de drone, et il ne coute qu'un angle qui derive.

     La vitesse est volontairement basse — un dixieme de radian par seconde —
     parce qu'un arc rapide donne le tournis quand on lit en meme temps. On ne
     doit pas voir la camera bouger ; on doit seulement se rendre compte,
     apres coup, qu'on a change de point de vue. */
  arc(vitesse, descente = 0) {
    this.orbiteVitesse = vitesse;
    this.descenteCible = descente;
  }

  maj(dt, temps, cerf) {
    if (this.fige) {
      const b1 = this.bruit(temps * 0.33, 0.0);
      const b2 = this.bruit(0.0, temps * 0.29);
      const b3 = this.bruit(temps * 0.21, 5.5);
      // Glissement vers la position finale : un saut se lirait comme une
      // coupe, et tout ce programme tient sur l'absence de coupe.
      this.pos.x = damp(this.pos.x, this._posFigee.x, 0.55, dt);
      this.pos.y = damp(this.pos.y, this._posFigee.y, 0.55, dt);
      this.pos.z = damp(this.pos.z, this._posFigee.z, 0.55, dt);
      this.camera.position.set(
        this.pos.x + b1 * 0.34,
        this.pos.y + b2 * 0.24,
        this.pos.z + b3 * 0.34
      );
      this.vise.lerp(this._viseFigee, 1 - Math.exp(-1.1 * dt));
      this.camera.lookAt(this.vise);
      this.roulis = damp(this.roulis, 0, 0.7, dt);
      this.camera.rotateZ(this.roulis);
      const fovFige = (this.fov + Math.sin(temps * 0.19) * 0.55)
                    * (this.camera.userData.fovEchelle || 1);
      if (Math.abs(this.camera.fov - fovFige) > 0.01) {
        this.camera.fov = fovFige;
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    /* --- glissement lent vers le cadrage demande -------------------------- */
    this.recul = damp(this.recul, this.reculCible, 0.9, dt);
    this.hauteur = damp(this.hauteur, this.hauteurCible, 0.9, dt);
    this.lateral = damp(this.lateral, this.lateralCible, 0.7, dt);
    this.fov = damp(this.fov, this.fovCible, 0.8, dt);
    this.biais = damp(this.biais || 0, this.biaisCible || 0, 0.9, dt);
    this.basCadre = damp(this.basCadre || 0, this.basCible || 0, 0.9, dt);

    /* --- derive lente : le cadrage ne se repete jamais -------------------- */
    const oscLat = Math.sin(temps * 0.117) * 1.9 + Math.sin(temps * 0.041) * 1.1;
    const oscHaut = Math.sin(temps * 0.083 + 1.7) * 0.42;
    const oscRecul = Math.sin(temps * 0.062 + 0.4) * 0.7;

    /* --- position visee, derriere le cerf --------------------------------- */
    const ancre = cerf.ancre(this._tmp);
    this.chemin.tangente(cerf.s, this._tan);
    this._cote.set(-this._tan.z, 0, this._tan.x);

    /* L'arc de halte : l'angle s'accumule tant qu'une vitesse est demandee,
       et il retombe a zero des qu'on repart. On le fait tourner dans le plan
       (tangente, cote) plutot qu'autour d'un axe monde, pour qu'il reste
       coherent quel que soit le cap du chemin. */
    this.orbite = (this.orbite || 0) + (this.orbiteVitesse || 0) * dt;
    if (!this.orbiteVitesse) this.orbite = damp(this.orbite, 0, 0.55, dt);
    this.descente = damp(this.descente || 0, this.descenteCible || 0, 0.8, dt);

    const ca = Math.cos(this.orbite), sa = Math.sin(this.orbite);
    const recul = this.recul + oscRecul;
    const late = this.lateral + oscLat;

    const cible = this._tmp2.copy(ancre);
    cible.addScaledVector(this._tan, -recul * ca - late * sa);
    cible.addScaledVector(this._cote, late * ca - recul * sa);
    cible.y += this.hauteur + oscHaut - this.descente;

    // Main levee : un flottement continu, ample mais tres lent.
    const n1 = this.bruit(temps * 0.33, 0.0);
    const n2 = this.bruit(0.0, temps * 0.29);
    const n3 = this.bruit(temps * 0.21, 5.5);
    cible.x += n1 * 0.42;
    cible.y += n2 * 0.30;
    cible.z += n3 * 0.42;

    // Jamais dans le sol, ni sous une bosse.
    const solIci = this.relief.hauteur(cible.x, cible.z);
    cible.y = Math.max(cible.y, solIci + 1.25);

    if (this._premiere) { this.pos.copy(cible); this._precPos.copy(cible); this._premiere = false; }

    this._precPos.copy(this.pos);
    // Plus mou a l'horizontale qu'a la verticale : le retard se voit dans les
    // virages, mais la hauteur reste tenue.
    this.pos.x = damp(this.pos.x, cible.x, 1.9, dt);
    this.pos.z = damp(this.pos.z, cible.z, 1.9, dt);
    this.pos.y = damp(this.pos.y, cible.y, 3.1, dt);

    this.camera.position.copy(this.pos);

    /* --- point vise -------------------------------------------------------
       On ne vise pas le cerf lui-meme mais legerement DEVANT lui : le regard
       precede l'animal, comme celui d'un pilote qui anticipe. */
    const avance = this.chemin.point(
      Math.min(cerf.s + 4.5 + cerf.vitesse * 0.55, this.chemin.longueur),
      this._cibleVisee
    );
    avance.y = this.relief.hauteur(avance.x, avance.z) + 1.15;
    // On melange avec le garrot pour que le cerf reste bien dans le cadre.
    avance.lerp(ancre, 0.55);

    // Bascule vers le cadeau quand il y en a un.
    if (this._interet && this._forceInteret > 0.001) {
      avance.lerp(this._interet, clamp(this._forceInteret, 0, 1));
    }

    /* Decalage de cadrage : viser a cote du sujet le repousse vers le bord
       oppose, viser au-dessus le fait descendre dans l'image. */
    if (this.biais || this.basCadre) {
      avance.addScaledVector(this._cote, this.biais);
      avance.y += this.basCadre;
    }

    avance.x += this.bruit(temps * 0.4, 9.1) * 0.20;
    avance.y += this.bruit(temps * 0.37, 2.3) * 0.14;

    this.vise.x = damp(this.vise.x || avance.x, avance.x, 3.4, dt);
    this.vise.y = damp(this.vise.y || avance.y, avance.y, 3.4, dt);
    this.vise.z = damp(this.vise.z || avance.z, avance.z, 3.4, dt);

    this.camera.lookAt(this.vise);

    /* --- inclinaison : le drone penche vers l'interieur du virage ---------
       On la deduit de la COURBURE DU CHEMIN, pas de la vitesse laterale de la
       camera : pendant un rattrapage, cette derniere s'emballe et couche
       l'image. La courbure, elle, est bornee par construction. */
    const av = this.chemin.tangente(Math.min(cerf.s + 9, this.chemin.longueur), this._tmp2);
    const courbure = av.x * this._cote.x + av.z * this._cote.z;
    const roulisCible = clamp(-courbure * 0.42, -0.055, 0.055) * clamp(cerf.vitesse / 5, 0, 1);
    this.roulis = damp(this.roulis, roulisCible, 1.6, dt);
    this.camera.rotateZ(clamp(this.roulis, -0.07, 0.07));

    /* --- respiration de l'objectif ---------------------------------------- */
    const fovVivant = (this.fov + Math.sin(temps * 0.19) * 0.55)
                    * (this.camera.userData.fovEchelle || 1);
    if (Math.abs(this.camera.fov - fovVivant) > 0.01) {
      this.camera.fov = fovVivant;
      this.camera.updateProjectionMatrix();
    }
  }

  /* Placement immediat, sans elasticite — pour le tout premier plan. */
  poser(cerf, temps = 0) {
    this._premiere = true;
    this.maj(1 / 60, temps, cerf);
    this.pos.copy(this.camera.position);
  }
}
