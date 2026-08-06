/* Une halte, du debut a la fin.

   Elle enchaine six moments, et c'est cet enchainement qui doit rester fluide
   pour que la balade ne redevienne jamais une suite d'ecrans :

     approche  le cerf ralentit, la camera se rapproche et descend
     fouille   il gratte la neige ; le grondement commence sous le sol
     percee    le paquet creve la croute dans une gerbe de poudreuse
     attente   il flotte, eclaire la neige, et attend qu'on le touche
     ouverture le couvercle bascule, la lumiere sort, la carte se forme
     reprise   le cerf repart, la camera reprend sa hauteur

   Aucun de ces moments n'est un ecran : la camera bouge pendant tous.
*/

import * as THREE from 'three';
import { creerCadeau } from './giftMesh.js';
import { Emergence } from './emergence.js';
import { clamp, smoothstep, damp } from '../core/noise.js';

export const PHASES = {
  ROUTE: 'route',
  APPROCHE: 'approche',
  FOUILLE: 'fouille',
  PERCEE: 'percee',
  ATTENTE: 'attente',
  OUVERTURE: 'ouverture',
  LECTURE: 'lecture',
  REPRISE: 'reprise',
};

export class Halte {
  constructor(scene, palier, relief) {
    this.scene = scene;
    this.palier = palier;
    this.relief = relief;

    this.emergence = new Emergence(palier);
    scene.add(this.emergence.groupe);

    this.groupeCadeau = new THREE.Group();
    scene.add(this.groupeCadeau);

    this.cadeau = null;
    this.station = null;
    this.centre = new THREE.Vector3();
    this.t = 0;
    this.ouvert = 0;
  }

  /* Prepare la halte : place le paquet a cote du chemin, du cote ou la
     camera le verra le mieux. */
  preparer(station, chemin, s, cote) {
    this.nettoyer();
    this.station = station;
    const g = station.scene?.gift;
    if (!g) return false;

    const p = chemin.point(s, new THREE.Vector3());
    const c = chemin.cote(s, new THREE.Vector3());
    // Legerement decale : le paquet ne doit pas etre pile dans l'axe, sinon
    // le cerf le masque au moment ou il sort.
    p.addScaledVector(c, cote * (2.6 + g.size * 0.8));
    p.y = this.relief.hauteur(p.x, p.z);
    this.centre.copy(p);

    this.cadeau = creerCadeau(g, this.palier);
    this.groupeCadeau.add(this.cadeau.groupe);
    this.cadeau.groupe.position.copy(p);
    this.cadeau.groupe.rotation.y = Math.atan2(-c.x, -c.z) + 0.4;

    this.enfoui = station.scene.buried !== false;
    if (this.enfoui) {
      this.emergence.poser(p, g.size);
      this.cadeau.groupe.position.y = p.y - g.size * 0.85;
    } else {
      // Deja sorti : celui-la etait posé la, offert.
      this.emergence.cacher();
      this.cadeau.groupe.position.y = p.y;
    }

    this.t = 0;
    this.ouvert = 0;
    return true;
  }

  nettoyer() {
    if (this.cadeau) {
      this.groupeCadeau.remove(this.cadeau.groupe);
      this.cadeau.groupe.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
      this.cadeau = null;
    }
    this.emergence.cacher();
  }

  /* Point que la camera vise et sur lequel s'accroche la carte. */
  ancre(cible = new THREE.Vector3()) {
    if (!this.cadeau) return cible.copy(this.centre);
    return cible.set(
      this.cadeau.groupe.position.x,
      this.cadeau.groupe.position.y + this.cadeau.centreY,
      this.cadeau.groupe.position.z
    );
  }

  /* `avance` : progression de la sequence d'emergence, entre 0 et 1. */
  majEmergence(dt, avance, temps) {
    if (!this.cadeau) return;
    if (this.enfoui) {
      const h = this.emergence.maj(dt, avance, temps);
      this.cadeau.groupe.position.y = this.centre.y + h * this.cadeau.taille;
    } else {
      this.cadeau.groupe.position.y = this.centre.y
        + (Math.sin(temps * 1.25) * 0.5 + 0.5) * 0.055 * this.cadeau.taille;
    }

    // Rotation tres lente : le paquet vit sans jamais tourner comme un objet
    // de catalogue.
    this.cadeau.groupe.rotation.y += dt * 0.055;

    // La lueur enfermee monte avec l'emergence.
    const l = smoothstep(0.45, 0.9, avance);
    this.cadeau.matLueur.opacity = l * 0.18;
  }

  /* Ouverture : le couvercle bascule, la neige glisse, la lumiere sort. */
  majOuverture(dt, temps) {
    if (!this.cadeau) return;
    this.ouvert = Math.min(1, this.ouvert + dt * 0.85);
    const o = smoothstep(0, 1, this.ouvert);
    const c = this.cadeau;

    c.couvercle.position.y = c.hauteur + o * c.taille * 0.62;
    c.couvercle.rotation.z = -o * 0.42;
    c.couvercle.rotation.x = o * 0.16;

    // La calotte de neige glisse et tombe.
    c.calotte.position.x = -o * c.taille * 0.55;
    c.calotte.position.y = c.taille * 0.19 - o * o * c.taille * 1.5;
    c.calotte.rotation.z = -o * 1.1;
    c.calotte.material.opacity = 1 - smoothstep(0.45, 0.95, o);
    c.calotte.material.transparent = true;

    c.matLueur.opacity = 0.18 + o * 0.42;
    c.lueur.scale.setScalar(1 + o * 0.7);
  }

  /* Intensite de la lumiere chaude que le paquet projette sur la neige. */
  eclat() {
    if (!this.cadeau) return 0;
    return (0.18 + this.ouvert * 1.5) * this.cadeau.taille * 3.4;
  }
}
