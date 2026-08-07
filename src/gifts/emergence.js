/* Le deterrement.

   C'est le moment que l'experience doit reussir. Le decoupage suit ce qui se
   passerait vraiment si quelque chose remontait sous la neige :

   1. RIEN NE BOUGE, puis la neige FREMIT. Un monticule se souleve a peine et
      vibre. Le son passe sous la terre avant que l'image ne montre quoi que
      ce soit — l'attente fait tout le travail.
   2. LA CROUTE CEDE. Le monticule se fend, des paquets de neige glissent, une
      gerbe de poudreuse part vers le haut.
   3. LE PAQUET EMERGE, lentement, en repoussant la neige. Il porte encore sa
      calotte.
   4. IL SE POSE et respire — une leviation de quelques centimetres, juste
      assez pour qu'on sente qu'il n'est pas ordinaire.

   Le sol etant une geometrie figee, on ne peut pas y creuser un vrai trou :
   le monticule et l'anneau de neige retournee masquent le raccord, et le
   paquet part d'assez bas pour qu'on ne voie jamais son dessous.
*/

import * as THREE from 'three';
import { clamp, smoothstep, lerp, rng } from '../core/noise.js';

const NB_ECLATS = 160;

/* LE CARACTERE D'UN DETERREMENT.

   Six paquets sortaient de la neige exactement de la meme facon : meme
   fremissement, meme instant de percee, meme gerbe, meme rebond. Le premier
   emerveille, le deuxieme plait, le troisieme annonce le quatrieme — et a ce
   moment-la l'experience est redevenue un diaporama, ce que tout le reste du
   programme s'acharne a eviter.

   Chaque halte tire donc son propre temperament d'une graine stable (son
   rang), ce qui garde le rendu reproductible tout en rendant les six
   sequences distinctes. Cinq axes, choisis parce qu'ils s'entendent DES LA
   PREMIERE SECONDE et sans qu'on ait a comparer :

   · le RETARD avant que la neige ne bouge — l'attente n'est jamais la meme ;
   · la VIGUEUR de la percee, de la poussee timide au jaillissement ;
   · la VRILLE : le paquet tourne en montant, dans un sens ou dans l'autre ;
   · le DEVERS : il sort de travers et se redresse en se posant ;
   · la FAUSSE ALERTE, la plus efficace : la neige se souleve, retombe... et
     c'est seulement apres que ca perce. Reservee a une minorite de haltes —
     systematique, elle deviendrait a son tour le motif. */
function caractere(graine) {
  const r = rng(graine * 7919 + 13);
  const vigueur = 0.68 + r() * 0.85;
  return {
    retard: r() * 0.09,
    vigueur,
    // La percee est d'autant plus tardive que la poussee est faible.
    percee: 0.40 - vigueur * 0.09,
    vrille: (r() < 0.5 ? -1 : 1) * (0.35 + r() * 1.30),
    devers: (r() - 0.5) * 0.30,
    fausseAlerte: r() < 0.36,
  };
}

export class Emergence {
  constructor(palier) {
    this.palier = palier;
    this.groupe = new THREE.Group();

    /* --- le monticule ------------------------------------------------------ */
    const geo = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
    // Bosseler la coupole : une demi-sphere lisse ne ressemble a rien.
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = 1 + Math.sin(x * 5.1) * 0.09 + Math.cos(z * 4.3) * 0.08 + Math.sin((x + z) * 7.7) * 0.05;
      p.setXYZ(i, x * n, y * n * 0.62, z * n);
    }
    geo.computeVertexNormals();

    this.matMonticule = new THREE.MeshStandardMaterial({
      color: 0xE9F1F9, roughness: 0.85, metalness: 0,
      transparent: true, opacity: 1,
    });
    this.monticule = new THREE.Mesh(geo, this.matMonticule);
    this.monticule.castShadow = palier.ombres;
    this.monticule.receiveShadow = palier.ombres;
    this.groupe.add(this.monticule);

    /* --- l'anneau de neige retournee, qui masque le raccord au sol --------- */
    const anneau = new THREE.RingGeometry(0.62, 1.55, 24, 1);
    anneau.rotateX(-Math.PI / 2);
    this.matAnneau = new THREE.MeshStandardMaterial({
      color: 0xDCE7F2, roughness: 0.9, transparent: true, opacity: 0,
      depthWrite: false,
    });
    this.anneau = new THREE.Mesh(anneau, this.matAnneau);
    this.anneau.position.y = 0.03;
    this.anneau.receiveShadow = palier.ombres;
    this.groupe.add(this.anneau);

    /* --- la gerbe de poudreuse -------------------------------------------- */
    const n = palier.nom === 'bas' ? 70 : NB_ECLATS;
    this.nbEclats = n;
    const pos = new Float32Array(n * 3);
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.matEclats = new THREE.PointsMaterial({
      color: 0xFFFFFF, size: 0.085, transparent: true, opacity: 0,
      depthWrite: false, sizeAttenuation: true,
    });
    this.eclats = new THREE.Points(g2, this.matEclats);
    this.eclats.frustumCulled = false;
    this.groupe.add(this.eclats);

    this.vitesses = new Float32Array(n * 3);
    this.vies = new Float32Array(n);
    this.actifEclats = false;

    this.groupe.visible = false;
  }

  /* Place la scene d'emergence a un endroit du monde. `graine` fixe le
     temperament de CE deterrement-la. */
  poser(position, taille, graine = 0) {
    this.groupe.position.copy(position);
    this.taille = taille;
    this.car = caractere(graine);
    this.vrille = 0;
    this.devers = 0;
    const r = taille * 1.5;
    this.monticule.scale.set(r, r * 0.55, r);
    this.anneau.scale.set(taille * 1.15, 1, taille * 1.15);
    this.groupe.visible = true;
    this.matMonticule.opacity = 1;
    this.matAnneau.opacity = 0;
    this.matEclats.opacity = 0;
    this.actifEclats = false;
    this._jaillieA = -1;
  }

  cacher() { this.groupe.visible = false; }

  /* Declenche la gerbe : les grains partent vers le haut et l'exterieur. */
  jaillir(force = 1) {
    const n = this.nbEclats;
    const pos = this.eclats.geometry.attributes.position.array;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * this.taille * 0.9;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = this.taille * 0.3 + Math.random() * 0.1;
      pos[i * 3 + 2] = Math.sin(a) * r;

      const vh = (0.9 + Math.random() * 2.3) * force;
      const vl = (0.5 + Math.random() * 1.5) * force;
      this.vitesses[i * 3] = Math.cos(a) * vl;
      this.vitesses[i * 3 + 1] = vh;
      this.vitesses[i * 3 + 2] = Math.sin(a) * vl;
      this.vies[i] = 0.55 + Math.random() * 0.85;
    }
    this.eclats.geometry.attributes.position.needsUpdate = true;
    this.matEclats.opacity = 0.92;
    this.actifEclats = true;
  }

  /* `t` va de 0 a 1 sur toute la sequence. Renvoie la hauteur a laquelle
     doit se trouver le paquet, exprimee en fraction de sa propre taille. */
  maj(dt, t0, temps) {
    const car = this.car || caractere(0);

    /* Le retard decale toute la sequence sans la raccourcir : on reetale ce
       qui reste sur l'intervalle restant, sinon la fin serait tronquee. */
    const t = clamp((t0 - car.retard) / (1 - car.retard), 0, 1);
    const P = car.percee;

    /* --- 1. fremissement ---------------------------------------------------
       Sur les haltes a fausse alerte, il monte, RETOMBE PRESQUE A RIEN, puis
       repart : c'est ce creux au milieu qui fait sursauter, parce qu'on a
       deja relache son attention quand ca perce. */
    let frem = smoothstep(0.02, 0.16, t) * smoothstep(P + 0.02, P - 0.20, t);
    if (car.fausseAlerte) {
      const creux = 1 - Math.exp(-Math.pow((t - P * 0.52) / 0.055, 2));
      frem *= 0.24 + creux * 0.76;
    }
    const vib = Math.sin(temps * 46) * 0.5 + Math.sin(temps * 71) * 0.5;
    this.monticule.position.x = vib * 0.022 * frem * this.taille * car.vigueur;
    this.monticule.position.z = Math.cos(temps * 53) * 0.022 * frem * this.taille * car.vigueur;

    /* --- 2. le monticule se souleve puis s'affaisse ------------------------ */
    let gonfle = smoothstep(0, P - 0.10, t);
    if (car.fausseAlerte) {
      // Il redescend d'un tiers au moment du faux depart.
      gonfle *= 1 - 0.34 * Math.exp(-Math.pow((t - P * 0.58) / 0.075, 2));
    }
    const chute = smoothstep(P - 0.06, P + 0.22, t);
    const r = this.taille * 1.5;
    const eh = (0.55 + gonfle * 0.35 * car.vigueur) * (1 - chute * 0.92);
    const el = 1 + gonfle * 0.10;
    this.monticule.scale.set(r * el, r * eh, r * el);
    this.matMonticule.opacity = 1 - smoothstep(P + 0.02, P + 0.28, t);

    /* --- 3. l'anneau de neige remuee apparait ------------------------------ */
    this.matAnneau.opacity = smoothstep(P - 0.10, P + 0.15, t) * 0.85;

    /* --- gerbe, declenchee une seule fois au moment de la percee ----------- */
    if (this._jaillieA < 0 && t > P - 0.08) {
      this._jaillieA = t;
      this.jaillir(car.vigueur);
    }

    if (this.actifEclats) {
      const pos = this.eclats.geometry.attributes.position.array;
      let vivants = 0;
      for (let i = 0; i < this.nbEclats; i++) {
        if (this.vies[i] <= 0) continue;
        vivants++;
        this.vies[i] -= dt;
        this.vitesses[i * 3 + 1] -= 5.2 * dt;             // pesanteur
        this.vitesses[i * 3] *= 1 - 1.6 * dt;             // frottement de l'air
        this.vitesses[i * 3 + 2] *= 1 - 1.6 * dt;
        pos[i * 3] += this.vitesses[i * 3] * dt;
        pos[i * 3 + 1] += this.vitesses[i * 3 + 1] * dt;
        pos[i * 3 + 2] += this.vitesses[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] < 0.02) { pos[i * 3 + 1] = 0.02; this.vies[i] = 0; }
      }
      this.eclats.geometry.attributes.position.needsUpdate = true;
      this.matEclats.opacity *= 1 - 1.15 * dt;
      if (!vivants || this.matEclats.opacity < 0.02) this.actifEclats = false;
    }

    /* --- hauteur du paquet -------------------------------------------------
       Il part enfoui (sous le sol) et remonte avec un leger depassement, puis
       se stabilise en respirant. Le depassement suit la vigueur : un paquet
       qui jaillit monte plus haut que necessaire et redescend. */
    const monte = smoothstep(P - 0.12, P + 0.32, t);
    const rebond = Math.sin(clamp((t - (P + 0.22)) / 0.30, 0, 1) * Math.PI) * 0.10 * car.vigueur;
    const flotte = t > P + 0.32 ? (Math.sin(temps * 1.25) * 0.5 + 0.5) * 0.055 : 0;

    /* --- vrille et devers --------------------------------------------------
       Le paquet ne sort pas d'aplomb : il tourne en montant et penche, puis se
       redresse en se posant. Ce sont les deux variations les plus visibles a
       l'oeil nu, et elles ne coutent qu'une rotation. Elles sont lues par la
       halte, qui seule possede le groupe du cadeau. */
    const sortie = smoothstep(P - 0.12, P + 0.40, t);
    // La vrille est ACQUISE, pas rendue : le paquet a tourne, il reste tourne.
    // Un aller-retour se lirait comme une hesitation mecanique.
    this.vrille = car.vrille * sortie;
    this.devers = car.devers * (1 - smoothstep(P + 0.20, P + 0.55, t));

    return lerp(-0.85, 0.06, monte) + rebond + flotte;
  }
}
