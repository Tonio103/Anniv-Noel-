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

/* Un entier stable a partir de l'identifiant d'une halte. Il sert de graine
   au temperament du deterrement : deux visites de la meme halte donnent donc
   exactement la meme sequence, et deux haltes differentes n'en partagent
   aucune. */
function hacher(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100000;
}

export const PHASES = {
  ROUTE: 'route',
  APPROCHE: 'approche',
  FOUILLE: 'fouille',
  PERCEE: 'percee',
  ATTENTE: 'attente',
  OUVERTURE: 'ouverture',
  LECTURE: 'lecture',
  REPRISE: 'reprise',
  FIN: 'fin',
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

    const p = chemin.point(s, new THREE.Vector3());
    const c = chemin.cote(s, new THREE.Vector3());
    // Legerement decale : le paquet ne doit pas etre pile dans l'axe, sinon
    // le cerf le masque au moment ou il sort.
    p.addScaledVector(c, cote * (2.6 + (g ? g.size : 1) * 0.8));
    p.y = this.relief.hauteur(p.x, p.z);
    this.centre.copy(p);

    /* Les clairieres n'ont rien a deterrer. On garde quand meme un centre a
       jour : sans lui, la camera et l'invite viseraient le paquet de la
       halte precedente, reste en arriere sur le chemin. */
    if (!g) { this.enfoui = false; this.t = 0; this.ouvert = 0; return false; }

    this.cadeau = creerCadeau(g, this.palier);
    this.groupeCadeau.add(this.cadeau.groupe);
    this.cadeau.groupe.position.copy(p);
    /* L'orientation est desormais composee de trois termes distincts — le cap
       de depart, la derive lente, la vrille de sortie. Les cumuler dans le
       meme `rotation.y +=` rendait la vrille impossible : on ne peut pas
       ajouter un angle absolu a une valeur qu'on incremente par ailleurs. */
    this.rotBase = Math.atan2(-c.x, -c.z) + 0.4;
    this.rotLente = 0;
    this.cadeau.groupe.rotation.y = this.rotBase;

    this.enfoui = station.scene.buried !== false;
    if (this.enfoui) {
      // La graine fixe le temperament de ce deterrement : le rang de la halte
      // suffit, et il garantit que la meme halte se rejoue a l'identique.
      this.emergence.poser(p, g.size, station.id ? hacher(station.id) : 0);
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
    // de catalogue. On y ajoute la vrille propre a cette halte, et le devers
    // avec lequel il est sorti de la neige avant de se redresser.
    this.rotLente += dt * 0.055;
    this.cadeau.groupe.rotation.y = this.rotBase + this.rotLente
      + (this.enfoui ? this.emergence.vrille : 0);
    if (this.enfoui) {
      this.cadeau.groupe.rotation.z = this.emergence.devers;
      this.cadeau.groupe.rotation.x = this.emergence.devers * 0.55;
    }

    // La lueur enfermee monte avec l'emergence.
    const l = smoothstep(0.45, 0.9, avance);
    if (this.ouvert <= 0) this.cadeau.matLueur.opacity = l * 0.16;
  }

  /* Ouverture : le couvercle bascule, la neige glisse, la lumiere sort. */
  majOuverture(dt, temps) {
    if (!this.cadeau) return;
    this.ouvert = Math.min(1, this.ouvert + dt * 0.85);
    const o = smoothstep(0, 1, this.ouvert);
    const c = this.cadeau;

    // Peu de levee, beaucoup de bascule : c'est ce qui se lit comme un
    // couvercle qu'on souleve. Trop haut, il devient une seconde boite.
    c.couvercle.position.y = c.hauteur + o * c.taille * 0.20;
    c.couvercle.position.x = -o * c.taille * 0.30;
    c.couvercle.rotation.z = -o * 0.85;
    c.couvercle.rotation.x = o * 0.10;

    // La calotte de neige glisse et tombe.
    c.calotte.position.x = -o * c.taille * 0.55;
    c.calotte.position.y = c.taille * 0.19 - o * o * c.taille * 1.5;
    c.calotte.rotation.z = -o * 1.1;
    c.calotte.material.opacity = 1 - smoothstep(0.45, 0.95, o);
    c.calotte.material.transparent = true;

    c.matLueur.opacity = 0.16 + o * 0.40;
    c.lueur.scale.setScalar(c.taille * 3.4 * (1 + o * 0.55));
  }

  /* Intensite de la lumiere chaude que le paquet projette sur la neige. */
  /* LA LUEUR DU PAQUET DOIT ETRE UNE FLAQUE, PAS UN FILTRE.

     Reglee a 3,4 sur une portee de vingt-six metres, elle teintait toute la
     neige visible de la couleur du cadeau : l'image entiere virait au rose ou
     au vert selon la halte, et on ne lisait plus une lumiere posee sur le sol
     mais un calque de couleur par-dessus la photo. Un objet qui eclaire doit
     se trahir par un HALO LOCAL et un degrade rapide — c'est le degrade qui
     dit d'ou vient la lumiere.

     On divise donc l'intensite par deux et on resserre la portee (voir
     lighting.js) : la neige s'allume franchement au pied du paquet et
     redevient bleue a quelques metres. */
  eclat() {
    if (!this.cadeau) return 0;
    return (0.14 + this.ouvert * 1.1) * this.cadeau.taille * 1.7;
  }
}
