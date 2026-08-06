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
import { clamp, smoothstep, lerp } from '../core/noise.js';

const NB_ECLATS = 160;

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

  /* Place la scene d'emergence a un endroit du monde. */
  poser(position, taille) {
    this.groupe.position.copy(position);
    this.taille = taille;
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
  maj(dt, t, temps) {
    /* --- 1. fremissement --------------------------------------------------- */
    const frem = smoothstep(0.02, 0.16, t) * smoothstep(0.42, 0.22, t);
    const vib = Math.sin(temps * 46) * 0.5 + Math.sin(temps * 71) * 0.5;
    this.monticule.position.x = vib * 0.022 * frem * this.taille;
    this.monticule.position.z = Math.cos(temps * 53) * 0.022 * frem * this.taille;

    /* --- 2. le monticule se souleve puis s'affaisse ------------------------ */
    const gonfle = smoothstep(0, 0.30, t);
    const chute = smoothstep(0.34, 0.62, t);
    const r = this.taille * 1.5;
    const eh = (0.55 + gonfle * 0.35) * (1 - chute * 0.92);
    this.monticule.scale.set(r * (1 + gonfle * 0.10), r * eh, r * (1 + gonfle * 0.10));
    this.matMonticule.opacity = 1 - smoothstep(0.42, 0.68, t);

    /* --- 3. l'anneau de neige remuee apparait ------------------------------ */
    this.matAnneau.opacity = smoothstep(0.30, 0.55, t) * 0.85;

    /* --- gerbe, declenchee une seule fois au moment de la percee ----------- */
    if (this._jaillieA < 0 && t > 0.32) { this._jaillieA = t; this.jaillir(1); }

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
       se stabilise en respirant. */
    const monte = smoothstep(0.28, 0.72, t);
    const rebond = Math.sin(clamp((t - 0.62) / 0.30, 0, 1) * Math.PI) * 0.10;
    const flotte = t > 0.72 ? (Math.sin(temps * 1.25) * 0.5 + 0.5) * 0.055 : 0;
    return lerp(-0.85, 0.06, monte) + rebond + flotte;
  }
}
