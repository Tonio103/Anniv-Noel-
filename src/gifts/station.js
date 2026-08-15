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

  /* L'OUVERTURE, EN QUATRE TEMPS.

     Elle se faisait en un seul geste : tout — le noeud, le couvercle, la
     neige, la lumiere — partait ensemble et lineairement, en un peu plus
     d'une seconde. Un paquet qu'on ouvre ne fait jamais ca. Ce qui rend
     l'instant, c'est l'ORDRE des choses et les temps morts entre elles.

       0,00 → 0,22   LE NOEUD SE DEFAIT. Rien d'autre ne bouge. Les boucles
                     s'affaissent et glissent sur le cote — le ruban lache
                     avant que quoi que ce soit ne s'ouvre, c'est le premier
                     signe que ca va s'ouvrir.
       0,15 → 0,55   LE COUVERCLE SE SOULEVE, d'abord tout droit sur quelques
                     centimetres — le temps que la neige decroche — puis il
                     bascule. La calotte glisse et tombe pendant ce temps.
       0,30 → 0,70   LA LUMIERE SORT, et c'est elle qui fait l'evenement. Elle
                     part d'un coup, deborde largement, puis retombe a son
                     niveau de croisiere : c'est ce depassement, et lui seul,
                     qui donne l'impression que quelque chose etait ENFERME.
       0,55 → 1,00   LE COUVERCLE RETOMBE, s'immobilise de travers a cote de
                     la boite. Un couvercle qui reste suspendu en l'air pour
                     toujours est le detail qui trahit une animation.

     Et la boite ELLE-MEME reagit : un leger enfoncement quand le couvercle
     se souleve, un rebond quand il tombe. Sans cette reaction, on regarde
     deux objets independants au lieu d'un seul qui s'ouvre. */
  majOuverture(dt, temps) {
    if (!this.cadeau) return;
    // Un peu plus lent qu'avant : il y a maintenant quelque chose a suivre.
    this.ouvert = Math.min(1, this.ouvert + dt * 0.62);
    const t = this.ouvert;
    const c = this.cadeau;

    /* --- 1. le noeud se defait --------------------------------------- */
    const denoue = smoothstep(0.0, 0.22, t);
    if (c.noeud) {
      // Les boucles s'affaissent, puis l'ensemble glisse et tombe.
      c.noeud.scale.set(1 + denoue * 0.30, 1 - denoue * 0.72, 1 + denoue * 0.18);
      c.noeud.rotation.z = denoue * 0.9;
      c.noeud.position.x = -denoue * c.taille * 0.34;
      c.noeud.position.y = c.hauteur * 0 + (1 - denoue) * 0.0
        - smoothstep(0.16, 0.5, t) * c.taille * 1.3;
    }

    /* --- 2. le couvercle : d'abord droit, puis il bascule -------------- */
    const leve = smoothstep(0.15, 0.36, t);       // decollement vertical
    const bascule = smoothstep(0.30, 0.62, t);    // rotation
    const chute = smoothstep(0.58, 1.0, t);       // il retombe au sol

    c.couvercle.position.y = c.hauteur
      + leve * c.taille * 0.34
      - chute * c.taille * (0.34 + 0.72);
    c.couvercle.position.x = -(bascule * 0.42 + chute * 0.55) * c.taille;
    c.couvercle.position.z = chute * c.taille * 0.20;
    // Il tourne surtout en tombant : un couvercle bascule quand il lache.
    c.couvercle.rotation.z = -(bascule * 0.55 + chute * 1.45);
    c.couvercle.rotation.x = bascule * 0.12 + chute * 0.35;

    /* --- 3. la calotte de neige decroche et tombe ---------------------- */
    const glisse = smoothstep(0.18, 0.46, t);
    c.calotte.position.x = -glisse * c.taille * 0.62;
    c.calotte.position.y = c.taille * 0.19 - glisse * glisse * c.taille * 2.0;
    c.calotte.rotation.z = -glisse * 1.4;
    c.calotte.material.transparent = true;
    c.calotte.material.opacity = 1 - smoothstep(0.34, 0.62, t);

    /* --- 4. la lumiere sort, deborde, puis se pose --------------------- */
    const sort = smoothstep(0.28, 0.52, t);
    // Depassement : elle monte au-dela de sa valeur finale puis redescend.
    const eclat = sort * (1 + Math.sin(clamp((t - 0.30) / 0.34, 0, 1) * Math.PI) * 1.15);
    c.matLueur.opacity = 0.16 + eclat * 0.46;
    c.lueur.scale.setScalar(c.taille * 3.4 * (1 + eclat * 1.05));
    // Elle monte un peu en sortant, comme quelque chose qui s'echappe.
    c.lueur.position.y = c.hauteur * 0.6 + sort * c.taille * 0.35;

    /* --- la boite reagit ---------------------------------------------- */
    const enfonce = Math.sin(clamp((t - 0.15) / 0.25, 0, 1) * Math.PI) * 0.035;
    const rebond = Math.sin(clamp((t - 0.62) / 0.28, 0, 1) * Math.PI) * 0.05;
    c.caisse.scale.set(1 + enfonce - rebond * 0.5, 1 - enfonce + rebond, 1 + enfonce - rebond * 0.5);

    void temps;
  }

  /* Intensite de la lumiere chaude que le paquet projette sur la neige. */
  /* LA LUEUR DU PAQUET DOIT ETRE UNE FLAQUE, PAS UN FILTRE.

     Reglee a 3,4 sur une portee de vingt-six metres, elle teintait toute la
     neige visible de la couleur du cadeau : l'image entiere virait au rose ou
     au vert selon la halte, et on ne lisait plus une lumiere posee sur le sol
     mais un calque de couleur par-dessus la photo. Un objet qui eclaire doit
     se trahir par un HALO LOCAL et un degrade rapide — c'est le degrade qui
     dit d'ou vient la lumiere.

     CORRECTION : en la divisant par deux j'avais jete ce qui faisait son
     charme. La lueur elle-meme etait belle et devait rester forte ; c'est sa
     PORTEE qui etait fautive. Vingt-six metres, avec une decroissance molle,
     etendaient la teinte jusqu'au fond du cadre. On lui rend donc toute son
     intensite, et on garde la portee resserree avec une decroissance plus
     franche (voir lighting.js) : la neige s'embrase au pied du paquet, et
     redevient bleue quelques metres plus loin. Fort ET local. */
  /* UNE SOURCE PONCTUELLE N'EXISTE PAS.

     La lueur du paquet est une PointLight de decroissance quadratique. A
     intensite 7 — ce que donnait le gros paquet une fois ouvert — l'energie
     recue a trente centimetres est cent fois celle recue a trois metres : le
     couvercle, le ruban et la neige juste dessous partaient dans le blanc pur
     pendant que la clairiere restait normale. Ce n'est pas un exces de force,
     c'est un exces de CONCENTRATION : une vraie source a une taille, donc son
     eclairement plafonne au lieu de diverger.

     On garde donc la meme portee visible en baissant le pic et en elargissant
     le rayon d'action. La clairiere recoit autant qu'avant ; ce qui disparait
     est uniquement la zone saturee autour de la boite, qui ne montrait rien
     puisqu'elle etait blanche. */
  eclat() {
    if (!this.cadeau) return 0;
    return (0.20 + this.ouvert * 1.6) * this.cadeau.taille * 1.95;
  }
}
