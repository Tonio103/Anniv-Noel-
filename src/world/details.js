/* Les petits riens qui font que la foret est vivante.

   Une foret parfaitement immobile, meme bien eclairee, reste un decor. Ce qui
   la fait exister, ce sont des evenements RARES et IRREGULIERS : une feuille
   morte qui descend en tournoyant, un paquet de neige qui lache d'une branche
   et se defait en poudre, une bouffee de poudreuse soulevee par une rafale.

   Deux regles guident tout ce module :

   · RIEN NE DOIT ETRE PERIODIQUE. Un evenement qui revient toutes les quatre
     secondes se remarque immediatement et fait retomber la scene au rang de
     boucle. Les delais sont donc tires au hasard dans une large fourchette.
   · TOUT SE PASSE PRES DE LA CAMERA. Ces details ne se lisent qu'a courte
     distance ; les semer partout coute cher et ne se voit pas.

   Le budget est volontairement minuscule : quelques dizaines de quads et de
   points. C'est la rarete qui fait l'effet, pas la quantite.
*/

import * as THREE from 'three';
import { grainRond } from '../core/dot.js';
import { rng } from '../core/noise.js';

/* ==========================================================================
   FEUILLES MORTES

   Un hetre ou un chene garde ses feuilles seches une bonne partie de l'hiver,
   et les lache une a une. Il en faut TRES peu — trois ou quatre visibles a la
   fois — sinon on bascule dans l'automne et l'ambiance de Noel se perd.
   ========================================================================== */
class Feuilles {
  constructor(scene, palier) {
    this.n = palier.nom === 'bas' ? 10 : 20;
    const rand = rng(4711);

    /* Un quad minuscule, legerement plie pour qu'il ne disparaisse jamais
       completement quand il se presente de profil. */
    const geo = new THREE.PlaneGeometry(0.11, 0.16, 1, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.abs(p.getX(i)) * 0.35);
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF, roughness: 0.88, metalness: 0,
      side: THREE.DoubleSide, vertexColors: false,
    });

    this.mesh = new THREE.InstancedMesh(geo, mat, this.n);
    this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.n * 3), 3);
    this.mesh.castShadow = false;
    scene.add(this.mesh);

    const teintes = [0x8A5A2B, 0x6E4520, 0xA8763C, 0x7A4E28, 0x94622F];
    this.etat = [];
    const c = new THREE.Color();
    for (let i = 0; i < this.n; i++) {
      this.etat.push({
        p: new THREE.Vector3(), v: new THREE.Vector3(),
        axe: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
        ang: rand() * 6.28, vit: 0.8 + rand() * 2.4,
        vie: rand() * 14, duree: 9 + rand() * 12,
      });
      c.setHex(teintes[(rand() * teintes.length) | 0]);
      this.mesh.setColorAt(i, c);
    }
    this.mesh.instanceColor.needsUpdate = true;

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Vector3(1, 1, 1);
    this.rand = rand;
  }

  _semer(e, camera, relief) {
    const a = this.rand() * Math.PI * 2;
    const r = 7 + this.rand() * 22;
    const x = camera.position.x + Math.cos(a) * r;
    const z = camera.position.z + Math.sin(a) * r;
    const sol = relief.hauteur(x, z);
    e.p.set(x, sol + 7 + this.rand() * 9, z);
    e.v.set((this.rand() - 0.5) * 0.5, -(0.35 + this.rand() * 0.30), (this.rand() - 0.5) * 0.5);
    e.vie = 0;
    e.duree = 9 + this.rand() * 12;
  }

  maj(dt, temps, camera, relief) {
    for (let i = 0; i < this.n; i++) {
      const e = this.etat[i];
      e.vie += dt;
      if (e.vie > e.duree || e.p.y < relief.hauteur(e.p.x, e.p.z) - 0.1) {
        this._semer(e, camera, relief);
      }

      /* Une feuille ne tombe pas droit : elle plane, glisse sur le cote,
         se retourne et repart. On l'obtient avec une derive sinusoidale
         dephasee sur chaque axe. */
      const ph = i * 1.7;
      e.p.x += (e.v.x + Math.sin(temps * 0.9 + ph) * 0.55) * dt;
      e.p.z += (e.v.z + Math.cos(temps * 0.75 + ph * 1.3) * 0.50) * dt;
      e.p.y += e.v.y * dt;
      e.ang += e.vit * dt;

      this._q.setFromAxisAngle(e.axe, e.ang);
      this._m.compose(e.p, this._q, this._e);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/* ==========================================================================
   PAQUETS DE NEIGE QUI LACHENT DES BRANCHES

   Le son de ce petit evenement existait deja dans l'ambiance ; il lui
   manquait son image. Une branche chargee cede, la neige tombe en bloc puis
   se defait en poudre — c'est le passage du bloc a la poudre qui rend la
   chose credible, donc les grains ralentissent et s'etalent en descendant.
   ========================================================================== */
class PaquetsDeNeige {
  constructor(scene, palier) {
    this.parBouffee = palier.nom === 'bas' ? 16 : 30;
    this.bouffees = palier.nom === 'bas' ? 2 : 4;
    this.n = this.parBouffee * this.bouffees;

    const pos = new Float32Array(this.n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.PointsMaterial({
    map: grainRond(), alphaTest: 0.02,
      color: 0xF2F8FF, size: 0.09, transparent: true, opacity: 0.85,
      depthWrite: false, sizeAttenuation: true,
    });
    this.pts = new THREE.Points(geo, this.mat);
    this.pts.frustumCulled = false;
    this.pts.renderOrder = 9;
    scene.add(this.pts);

    this.vit = new Float32Array(this.n * 3);
    this.vie = new Float32Array(this.n);
    this.prochaine = 3 + Math.random() * 6;
    this.suivante = 0;
    // Hors champ tant qu'aucune bouffee n'est active.
    for (let i = 0; i < this.n; i++) pos[i * 3 + 1] = -999;
  }

  declencher(camera, relief) {
    const a = Math.random() * Math.PI * 2;
    const r = 9 + Math.random() * 20;
    const x = camera.position.x + Math.cos(a) * r;
    const z = camera.position.z + Math.sin(a) * r;
    const y = relief.hauteur(x, z) + 8 + Math.random() * 8;

    const base = (this.suivante % this.bouffees) * this.parBouffee;
    this.suivante++;
    const pos = this.pts.geometry.attributes.position.array;
    for (let k = 0; k < this.parBouffee; k++) {
      const i = base + k;
      pos[i * 3] = x + (Math.random() - 0.5) * 0.5;
      pos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.35;
      pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.5;
      this.vit[i * 3] = (Math.random() - 0.5) * 0.5;
      this.vit[i * 3 + 1] = -0.6 - Math.random() * 0.8;
      this.vit[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
      this.vie[i] = 2.2 + Math.random() * 1.8;
    }
    this.pts.geometry.attributes.position.needsUpdate = true;
  }

  maj(dt, camera, relief) {
    this.prochaine -= dt;
    if (this.prochaine <= 0) {
      this.prochaine = 4 + Math.random() * 11;   // jamais periodique
      this.declencher(camera, relief);
    }

    const pos = this.pts.geometry.attributes.position.array;
    for (let i = 0; i < this.n; i++) {
      if (this.vie[i] <= 0) continue;
      this.vie[i] -= dt;
      // La masse se defait : elle accelere puis freine en s'eparpillant.
      this.vit[i * 3 + 1] -= 2.4 * dt;
      this.vit[i * 3] *= 1 - 0.9 * dt;
      this.vit[i * 3 + 2] *= 1 - 0.9 * dt;
      pos[i * 3] += this.vit[i * 3] * dt;
      pos[i * 3 + 1] += this.vit[i * 3 + 1] * dt;
      pos[i * 3 + 2] += this.vit[i * 3 + 2] * dt;
      if (this.vie[i] <= 0) pos[i * 3 + 1] = -999;
    }
    this.pts.geometry.attributes.position.needsUpdate = true;
  }
}

/* ==========================================================================
   BOUFFEES DE POUDREUSE AU SOL

   Une rafale souleve la neige fraiche et la fait courir au ras du sol. Tres
   peu couteux, et c'est ce qui donne du vent a l'image alors que le
   balancement des arbres, lui, se voit surtout de loin.
   ========================================================================== */
class Poudreuse {
  constructor(scene, palier) {
    this.n = palier.nom === 'bas' ? 90 : 200;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.n * 3), 3));
    this.mat = new THREE.PointsMaterial({
    map: grainRond(), alphaTest: 0.02,
      color: 0xEAF4FF, size: 0.055, transparent: true, opacity: 0.5,
      depthWrite: false, sizeAttenuation: true,
    });
    this.pts = new THREE.Points(geo, this.mat);
    this.pts.frustumCulled = false;
    scene.add(this.pts);
    this.vie = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) this.vie[i] = Math.random() * 3;
  }

  maj(dt, temps, camera, relief) {
    const pos = this.pts.geometry.attributes.position.array;
    for (let i = 0; i < this.n; i++) {
      this.vie[i] -= dt;
      if (this.vie[i] <= 0) {
        const a = Math.random() * Math.PI * 2;
        const r = 3 + Math.random() * 26;
        const x = camera.position.x + Math.cos(a) * r;
        const z = camera.position.z + Math.sin(a) * r;
        pos[i * 3] = x;
        pos[i * 3 + 1] = relief.hauteur(x, z) + 0.02 + Math.random() * 0.10;
        pos[i * 3 + 2] = z;
        this.vie[i] = 1.4 + Math.random() * 2.6;
      } else {
        // Elle court au ras du sol, dans le sens du vent, et retombe.
        pos[i * 3] += (0.9 + Math.sin(temps * 0.7 + i) * 0.4) * dt;
        pos[i * 3 + 2] += 0.35 * dt;
        pos[i * 3 + 1] += (0.16 - (2.6 - this.vie[i]) * 0.12) * dt;
      }
    }
    this.pts.geometry.attributes.position.needsUpdate = true;
  }
}


/* ==========================================================================
   LES OISEAUX.

   Toute cette foret ne contenait qu'un seul etre vivant. Rien ne bougeait
   d'autre que le cerf, le vent et la neige — et c'est justement ce qui donne
   a un decor l'air d'un decor : la vie ne s'y produit qu'au centre du cadre,
   la ou on regarde.

   Le remede tient en peu de chose, mais il doit obeir a une regle stricte :
   ON NE DOIT JAMAIS LES VOIR ARRIVER. Un vol qui commence dans le champ se
   lit comme une apparition ; un vol qu'on decouvre deja commence, de loin, se
   lit comme quelque chose qui vivait la avant nous. Ils partent donc toujours
   hors du cadre, traversent, et sortent.

   Ce sont des silhouettes noires a deux triangles, sans aucun eclairage : de
   nuit, contre un ciel bleu, un oiseau lointain n'est rien d'autre. Le
   battement d'ailes est un simple pivot, mais irregulier — un battement
   metronomique se remarque immediatement, alors qu'un oiseau alterne
   battements et glissades.
   ========================================================================== */
class Oiseaux {
  constructor(scene, palier) {
    this.N = palier.nom === 'bas' ? 3 : 5;
    this.groupe = new THREE.Group();
    this.groupe.name = 'oiseaux';

    const mat = new THREE.MeshBasicMaterial({
      color: 0x0B131B, side: THREE.DoubleSide, fog: true,
      transparent: true, opacity: 0.92,
    });

    this.vols = [];
    for (let i = 0; i < this.N; i++) {
      const o = new THREE.Group();
      // Deux ailes, chacune un triangle, articulees sur l'axe du corps.
      for (const cote of [-1, 1]) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([
          0, 0, 0.10,
          0, 0, -0.10,
          cote * 0.46, 0, -0.02,
        ], 3));
        g.computeVertexNormals();
        const aile = new THREE.Mesh(g, mat);
        o.add(aile);
      }
      o.visible = false;
      this.groupe.add(o);
      this.vols.push({
        obj: o, actif: false, t: 0, duree: 1,
        depart: new THREE.Vector3(), arrivee: new THREE.Vector3(),
        phase: Math.random() * 6.28, cadence: 5 + Math.random() * 4,
      });
    }
    scene.add(this.groupe);

    // Le premier passage ne doit pas tomber des la premiere seconde.
    this.prochain = 14 + Math.random() * 26;
    this._v = new THREE.Vector3();
  }

  maj(dt, temps, camera, relief) {
    this.prochain -= dt;
    if (this.prochain <= 0) {
      this.prochain = 22 + Math.random() * 44;
      const libre = this.vols.find((v) => !v.actif);
      if (libre) this._lancer(libre, camera, relief);
    }

    for (const v of this.vols) {
      if (!v.actif) continue;
      v.t += dt / v.duree;
      if (v.t >= 1) { v.actif = false; v.obj.visible = false; continue; }

      const u = v.t;
      this._v.lerpVectors(v.depart, v.arrivee, u);
      // Une trajectoire d'oiseau monte et redescend un peu ; elle n'est
      // jamais une droite.
      this._v.y += Math.sin(u * Math.PI) * 5.5 + Math.sin(u * 9.3 + v.phase) * 0.7;
      v.obj.position.copy(this._v);

      // Il regarde ou il va.
      const dx = v.arrivee.x - v.depart.x, dz = v.arrivee.z - v.depart.z;
      v.obj.rotation.y = Math.atan2(dx, dz);

      /* Battement : des salves, puis une glissade ailes tendues. C'est
         l'alternance, pas le battement, qui fait l'oiseau. */
      const salve = Math.sin(temps * 0.9 + v.phase) > -0.25 ? 1 : 0.06;
      const bat = Math.sin(temps * v.cadence + v.phase) * 0.85 * salve;
      v.obj.children[0].rotation.z = bat;
      v.obj.children[1].rotation.z = -bat;
    }
  }

  _lancer(v, camera, relief) {
    /* Depart et arrivee hors du champ, de part et d'autre de la camera. On
       tire un axe de traversee au hasard et on place les deux bouts loin
       devant : l'oiseau est deja en vol quand il entre dans l'image. */
    const a = Math.random() * Math.PI * 2;
    const R = 95 + Math.random() * 45;
    const cx = camera.position.x, cz = camera.position.z;
    const sol = relief ? relief.hauteur(cx, cz) : 0;
    const h = sol + 16 + Math.random() * 20;

    v.depart.set(cx + Math.cos(a) * R, h, cz + Math.sin(a) * R);
    // Traversee non diametrale : un vol qui passe pile sur la camera est rare
    // et se remarque comme un effet.
    const b = a + Math.PI + (Math.random() - 0.5) * 1.5;
    v.arrivee.set(cx + Math.cos(b) * R, h - 2 + Math.random() * 4, cz + Math.sin(b) * R);

    v.duree = 9 + Math.random() * 7;
    v.t = 0;
    v.actif = true;
    v.obj.visible = true;
    const taille = 0.8 + Math.random() * 0.9;
    v.obj.scale.setScalar(taille);
  }
}

/* ========================================================================== */
export class Details {
  constructor(scene, palier) {
    this.feuilles = new Feuilles(scene, palier);
    this.paquets = new PaquetsDeNeige(scene, palier);
    this.poudreuse = new Poudreuse(scene, palier);
    this.oiseaux = new Oiseaux(scene, palier);
  }

  maj(dt, temps, camera, relief) {
    this.feuilles.maj(dt, temps, camera, relief);
    this.paquets.maj(dt, camera, relief);
    this.poudreuse.maj(dt, temps, camera, relief);
    this.oiseaux.maj(dt, temps, camera, relief);
  }
}
