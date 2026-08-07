/* Le chemin — la colonne vertebrale de toute la balade.

   Une seule courbe traverse la foret du debut a la fin. Le cerf la suit, la
   camera suit le cerf, les arbres sont semes autour d'elle et le relief est
   aplani sur son passage. Comme tout est derive de cette courbe, la balade
   reste un plan-sequence continu : il n'y a nulle part ou "couper".

   Le meandre reste volontairement doux (rayon de courbure superieur a
   200 unites). Un virage serre casserait le suivi du drone et ferait
   sortir le cerf du champ. */

import * as THREE from 'three';
import { rng } from '../core/noise.js';

export const ECART_HALTES = 92;   // distance approximative entre deux haltes

export class Chemin {
  constructor(nbHaltes, germe = 7) {
    const rand = rng(germe);

    /* Points d'ancrage : on s'enfonce vers les z negatifs en serpentant.
       L'amplitude grandit un peu, pour que la foret paraisse se refermer. */
    const ancres = [];
    for (let i = 0; i < nbHaltes; i++) {
      const z = -i * ECART_HALTES;
      const amp = 16 + i * 1.4;
      const x = Math.sin(i * 0.82) * amp + (rand() - 0.5) * 9;
      ancres.push(new THREE.Vector3(x, 0, z));
    }

    /* On prolonge aux deux bouts : la courbe demarre et finit proprement,
       et il reste du chemin apres la derniere halte pour que le cerf
       s'eloigne au lieu de disparaitre net. */
    const p0 = ancres[0], p1 = ancres[1];
    const av = p0.clone().sub(p1).normalize().multiplyScalar(58);
    ancres.unshift(p0.clone().add(av));

    const dn = ancres[ancres.length - 1], dv = ancres[ancres.length - 2];
    const ap = dn.clone().sub(dv).normalize().multiplyScalar(70);
    ancres.push(dn.clone().add(ap));

    this.courbe = new THREE.CatmullRomCurve3(ancres, false, 'centripetal', 0.5);
    this.longueur = this.courbe.getLength();

    /* Position de chaque halte, en distance parcourue depuis le depart. */
    this.haltes = [];
    for (let i = 0; i < nbHaltes; i++) {
      const p = ancres[i + 1];
      this.haltes.push({ index: i, s: this._sDuPoint(p), pos: p.clone() });
    }

    this._tmp = new THREE.Vector3();
    this._tan = new THREE.Vector3();
  }

  /* Retrouve la distance parcourue correspondant a un point d'ancrage.
     Recherche grossiere puis affinee — appele une dizaine de fois, au
     lancement uniquement. */
  _sDuPoint(p) {
    let meilleurS = 0, meilleurD = Infinity;
    const N = 900;
    for (let i = 0; i <= N; i++) {
      const s = (i / N) * this.longueur;
      const q = this.courbe.getPointAt(s / this.longueur, this._tmp);
      const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
      if (d < meilleurD) { meilleurD = d; meilleurS = s; }
    }
    return meilleurS;
  }

  /* Position sur le chemin a la distance s (en unites du monde). */
  point(s, cible = new THREE.Vector3()) {
    const t = THREE.MathUtils.clamp(s / this.longueur, 0, 1);
    return this.courbe.getPointAt(t, cible);
  }

  /* Direction de marche a la distance s, normalisee, dans le plan. */
  tangente(s, cible = new THREE.Vector3()) {
    const t = THREE.MathUtils.clamp(s / this.longueur, 0, 1);
    this.courbe.getTangentAt(t, cible);
    cible.y = 0;
    return cible.normalize();
  }

  /* Perpendiculaire horizontale — sert a semer les arbres de part et
     d'autre et a decaler la camera sur le cote. */
  cote(s, cible = new THREE.Vector3()) {
    this.tangente(s, cible);
    return cible.set(-cible.z, 0, cible.x);
  }

  /* Distance approximative d'un point au chemin, et abscisse la plus proche.
     Utilise au lancement pour aplanir le relief et pour ecarter les arbres
     du passage. La courbe etant globalement monotone en z, on part d'une
     estimation par z avant d'affiner. */
  proximite(x, z) {
    if (!this._echant) {
      const N = 640;
      this._echant = [];
      for (let i = 0; i <= N; i++) {
        const s = (i / N) * this.longueur;
        const p = this.point(s, new THREE.Vector3());
        this._echant.push({ s, x: p.x, z: p.z });
      }
      this._pasZ = this.longueur / N;
    }

    const e = this._echant;
    // estimation : les echantillons sont ordonnes et z decroit presque partout
    let i0 = Math.round(((e[0].z - z) / (e[0].z - e[e.length - 1].z)) * (e.length - 1));
    i0 = THREE.MathUtils.clamp(i0, 0, e.length - 1);

    let meilleurD = Infinity, meilleurS = 0;
    const marge = 26;
    for (let i = Math.max(0, i0 - marge); i < Math.min(e.length, i0 + marge); i++) {
      const d = (e[i].x - x) ** 2 + (e[i].z - z) ** 2;
      if (d < meilleurD) { meilleurD = d; meilleurS = e[i].s; }
    }
    return { d: Math.sqrt(meilleurD), s: meilleurS };
  }

  /* Boite englobante du couloir, avec une marge laterale. */
  emprise(marge) {
    let xmin = Infinity, xmax = -Infinity, zmin = Infinity, zmax = -Infinity;
    const N = 300;
    const p = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      this.point((i / N) * this.longueur, p);
      xmin = Math.min(xmin, p.x); xmax = Math.max(xmax, p.x);
      zmin = Math.min(zmin, p.z); zmax = Math.max(zmax, p.z);
    }
    return {
      xmin: xmin - marge, xmax: xmax + marge,
      zmin: zmin - marge, zmax: zmax + marge,
    };
  }
}
