/* Le relief enneige.

   Le sol est construit une fois pour toutes, avec les hauteurs calculees sur
   le processeur et cuites dans la geometrie. C'est volontaire : une grille
   qui suivrait la camera en echantillonnant une carte de hauteurs "nage"
   toujours un peu, et sur de la neige lisse ce glissement se voit. Ici la
   surface est parfaitement stable, et le calcul de hauteur cote JavaScript
   (pour poser les sabots du cerf et les cadeaux) est exactement celui de la
   geometrie affichee — pas d'objets qui flottent ou s'enfoncent.

   Le sol est decoupe en tuiles pour que l'elimination par le champ de vision
   fasse son travail : seules trois ou quatre tuiles sont dessinees a la fois.
*/

import * as THREE from 'three';
import { makeNoise2D, makeFbm, smoothstep, clamp } from '../core/noise.js';
import { creerNeige } from './snowMaterial.js';

export class Relief {
  constructor(chemin, palier, clairieres = []) {
    this.chemin = chemin;
    this.palier = palier;
    this.clairieres = clairieres;

    const bruit = makeNoise2D(1337);
    this._fbmLarge = makeFbm(bruit, { octaves: 4, gain: 0.52 });
    this._fbmMoyen = makeFbm(makeNoise2D(4242), { octaves: 3, gain: 0.5 });
    this._fbmFin = makeFbm(makeNoise2D(909), { octaves: 2, gain: 0.5 });

    /* Marge laterale : au-dela, le brouillard a tout mange de toute facon. */
    this.emprise = chemin.emprise(190);

    /* Hauteur du terrain le long du chemin, echantillonnee une fois.
       Elle sert a aplanir doucement le couloir de marche : le cerf ne doit
       pas escalader une butte, et la camera ne doit pas rentrer dedans. */
    this._echant = [];
    const N = 520;
    const p = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      const s = (i / N) * chemin.longueur;
      chemin.point(s, p);
      this._echant.push({ x: p.x, z: p.z, h: this._brut(p.x, p.z) });
    }
    this._zDebut = this._echant[0].z;
    this._zFin = this._echant[N].z;

    this.groupe = new THREE.Group();
    this.groupe.name = 'relief';
    this._construire();
  }

  /* --- relief avant aplanissement ---------------------------------------- */
  _brut(x, z) {
    let h = this._fbmLarge(x * 0.0042, z * 0.0042) * 7.2;      // grandes ondulations
    h += this._fbmMoyen(x * 0.017, z * 0.017) * 1.75;          // congeres
    h += this._fbmFin(x * 0.062, z * 0.062) * 0.34;            // grain
    return h;
  }

  /* --- hauteur finale, celle qui fait foi partout ------------------------ */
  hauteur(x, z) {
    let h = this._brut(x, z);

    // Aplanissement du couloir : on ramene vers la hauteur du chemin.
    const pr = this._prochePoint(x, z);
    if (pr.d < 46) {
      const k = smoothstep(46, 9, pr.d);          // 1 au centre, 0 au bord
      h = h + (pr.h - h) * k * 0.88;
      // Legere depression : le passage repete a tasse la neige.
      h -= smoothstep(14, 0, pr.d) * 0.32;
    }

    // Clairieres : on aplanit franchement pour degager la vue.
    for (const c of this.clairieres) {
      const d = Math.hypot(x - c.x, z - c.z);
      if (d < c.r * 1.5) {
        const k = smoothstep(c.r * 1.5, c.r * 0.45, d);
        h = h + (c.h - h) * k * 0.94;
      }
    }
    return h;
  }

  /* Echantillon de chemin le plus proche. La courbe descend regulierement en
     z, donc une estimation par z suivie d'une recherche locale suffit. */
  _prochePoint(x, z) {
    const e = this._echant;
    const n = e.length;
    let i0 = Math.round(((this._zDebut - z) / (this._zDebut - this._zFin)) * (n - 1));
    i0 = clamp(i0, 0, n - 1);

    let best = Infinity, bh = 0;
    const marge = 30;
    const a = Math.max(0, i0 - marge), b = Math.min(n, i0 + marge);
    for (let i = a; i < b; i++) {
      const d = (e[i].x - x) ** 2 + (e[i].z - z) ** 2;
      if (d < best) { best = d; bh = e[i].h; }
    }
    return { d: Math.sqrt(best), h: bh };
  }

  /* Normale analytique, par differences finies sur la fonction de hauteur.
     Comme elle vient de la meme fonction que les sommets, les tuiles se
     raccordent sans fissure ni cassure d'eclairage. */
  normale(x, z, cible = new THREE.Vector3()) {
    const e = 0.75;
    const hx = this.hauteur(x + e, z) - this.hauteur(x - e, z);
    const hz = this.hauteur(x, z + e) - this.hauteur(x, z - e);
    return cible.set(-hx, 2 * e, -hz).normalize();
  }

  _construire() {
    const em = this.emprise;
    const largeur = em.xmax - em.xmin;
    const profondeur = em.zmax - em.zmin;

    /* Taille de maille : le compromis entre finesse des congeres et nombre
       de sommets. Le relief fin est de toute facon ajoute par le shader. */
    const maille = this.palier.nom === 'bas' ? 2.9
                 : this.palier.nom === 'moyen' ? 2.1 : 1.7;

    /* DES TUILES PLUS PETITES, POUR QUE LE CULLING SERVE A QUELQUE CHOSE.

       Elles faisaient cent-dix-huit metres de cote. A cette taille, une tuile
       dont le centre est a deux cents metres a son coin le plus proche a cent
       dix-sept : on est donc oblige de garder un rayon large, et le culling
       ne retire presque rien. En les ramenant a une soixantaine de metres, le
       meme rayon ne conserve plus que le voisinage immediat — quatre fois
       moins de triangles de terrain, sans changer d'un pixel ce qu'on voit,
       puisque le rayon de securite, lui, n'a pas bouge.

       Le cout est un nombre d'appels de dessin un peu plus eleve. C'est le
       bon echange : un appel de dessin coute quelques microsecondes, cent
       mille triangles de plus coutent bien davantage sur un telephone. */
    const tuilesX = Math.max(2, Math.round(largeur / 62));
    const tuilesZ = Math.max(2, Math.round(profondeur / 62));
    const tw = largeur / tuilesX;
    const th = profondeur / tuilesZ;
    const sx = Math.max(2, Math.round(tw / maille));
    const sz = Math.max(2, Math.round(th / maille));

    this.materiau = creerNeige(this.palier, {
      empreintes: null,
      emprise: em,
    });

    const n = new THREE.Vector3();
    let sommets = 0;

    for (let tz = 0; tz < tuilesZ; tz++) {
      for (let tx = 0; tx < tuilesX; tx++) {
        const x0 = em.xmin + tx * tw;
        const z0 = em.zmin + tz * th;

        const nb = (sx + 1) * (sz + 1);
        const pos = new Float32Array(nb * 3);
        const nor = new Float32Array(nb * 3);
        const uv = new Float32Array(nb * 2);
        let k = 0, k2 = 0;

        for (let j = 0; j <= sz; j++) {
          const z = z0 + (j / sz) * th;
          for (let i = 0; i <= sx; i++) {
            const x = x0 + (i / sx) * tw;
            const y = this.hauteur(x, z);
            pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
            this.normale(x, z, n);
            nor[k] = n.x; nor[k + 1] = n.y; nor[k + 2] = n.z;
            uv[k2] = x * 0.05; uv[k2 + 1] = z * 0.05;
            k += 3; k2 += 2;
          }
        }

        const idx = new Uint32Array(sx * sz * 6);
        let m = 0;
        for (let j = 0; j < sz; j++) {
          for (let i = 0; i < sx; i++) {
            const a = j * (sx + 1) + i;
            const b = a + 1;
            const c = a + sx + 1;
            const d = c + 1;
            idx[m++] = a; idx[m++] = c; idx[m++] = b;
            idx[m++] = b; idx[m++] = c; idx[m++] = d;
          }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        geo.setIndex(new THREE.BufferAttribute(idx, 1));
        geo.computeBoundingSphere();

        const tuile = new THREE.Mesh(geo, this.materiau);
        tuile.receiveShadow = this.palier.ombres;
        tuile.castShadow = false;
        tuile.matrixAutoUpdate = false;
        tuile.updateMatrix();
        this.groupe.add(tuile);
        sommets += nb;
      }
    }

    this.nbSommets = sommets;

    /* Au-dela de l'emprise : un disque plat a la couleur du brouillard, pour
       qu'on ne voie jamais le vide si la brume est fine. */
    const jupeGeo = new THREE.RingGeometry(
      Math.max(largeur, profondeur) * 0.42,
      Math.max(largeur, profondeur) * 1.4, 48, 1
    );
    jupeGeo.rotateX(-Math.PI / 2);
    this.jupe = new THREE.Mesh(
      jupeGeo,
      new THREE.MeshBasicMaterial({ color: 0x9FB6C8, fog: true, depthWrite: false })
    );
    this.jupe.position.y = -1.4;
    this.jupe.renderOrder = -900;
    this.groupe.add(this.jupe);
  }

  /* Branche la carte des traces. Sa fenetre se deplace avec le cerf, donc
     l'emprise ET la texture doivent etre rafraichies a chaque image : le
     rendu alterne entre deux cibles, et l'ancienne n'est plus valable. */
  brancherEmpreintes(emp) {
    const u = this.materiau.userData.uniforms;
    u.uEmpreintes.value = emp.texture;
    u.uAEmpreintes.value = 1;
    u.uEmpPas.value = 1.5 / emp.taille;
    this._emp = emp;
  }

  majEmpreintes() {
    if (!this._emp) return;
    const u = this.materiau.userData.uniforms;
    const e = this._emp.emprise();
    u.uEmpMin.value.set(e.xmin, e.zmin);
    u.uEmpTaille.value.set(e.xmax - e.xmin, e.zmax - e.zmin);
    u.uEmpreintes.value = this._emp.texture;
  }

  /* Fait suivre au disque de fond la position de la camera. */
  maj(camera, ambiance) {
    this.jupe.position.x = camera.position.x;
    this.jupe.position.z = camera.position.z;
    if (ambiance) this.jupe.material.color.set(ambiance.brouillard);

    /* LES TUILES LOINTAINES NE SONT PLUS DESSINEES.

       Le relief etait deja decoupe en tuiles de cent-dix-huit metres — mais
       toutes etaient envoyees a chaque image, sur toute la longueur du
       parcours. C'est le poste le plus lourd de la scene et personne ne le
       regardait : a lui seul il pesait environ la moitie des triangles, dont
       l'immense majorite derriere le brouillard.

       Le rayon est genereux — une tuile fait cent-dix-huit metres de cote,
       donc son centre peut etre loin alors qu'un de ses coins est sous nos
       pieds. Deux cents metres garantissent qu'on ne coupe jamais une tuile
       qu'on pourrait voir, tout en ecartant tout le reste du parcours.

       Le disque de brouillard qui suit la camera bouche l'horizon de toute
       facon : il n'y a aucun trou possible. */
    const p = camera.position;
    for (const t of this.groupe.children) {
      if (!t.geometry || !t.geometry.boundingSphere) continue;
      const c = t.geometry.boundingSphere.center;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      const vu = d < 200;
      if (t.visible !== vu) t.visible = vu;
    }
  }
}
