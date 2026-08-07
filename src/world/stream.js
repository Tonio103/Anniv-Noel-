/* LE RUISSEAU GELE.

   Le plan en prevoyait un ; il n'y en a jamais eu. Ce n'est pas un ornement :
   c'est le seul endroit de toute la balade ou la matiere du sol CHANGE. Sur
   un kilometre de neige, croiser une bande de glace noire — dure, reflechie,
   parcourue de fentes blanches — redonne d'un coup une echelle et une texture
   au terrain, parce qu'on a enfin quelque chose a quoi comparer la neige.

   Il traverse le chemin, jamais le long : on le FRANCHIT, on ne le suit pas.
   Le cerf passe dessus, la camera aussi, et pendant deux secondes le sol
   n'est plus le meme. C'est aussi, accessoirement, le seul moment ou le ciel
   se reflete quelque part.

   Techniquement il est plat et pose LEGEREMENT SOUS la neige : la neige le
   recouvre partout sauf dans le lit, qui a ete creuse par le relief. On evite
   ainsi toute decoupe a faire, et le raccord est fait par la geometrie du
   terrain elle-meme.
*/

import * as THREE from 'three';
import { rng } from '../core/noise.js';

/* Fentes et bulles prises dans la glace, dessinees une fois. C'est ce
   reseau de craquelures qui fait lire "gele" plutot que "flaque". */
function texGlace() {
  const n = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const c = cv.getContext('2d');
  c.fillStyle = '#0d1a24';
  c.fillRect(0, 0, n, n);

  const r = rng(9182);
  // Craquelures : des polylignes claires qui se ramifient.
  c.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    let x = r() * n, y = r() * n;
    let a = r() * Math.PI * 2;
    c.beginPath();
    c.moveTo(x, y);
    const seg = 3 + ((r() * 6) | 0);
    for (let k = 0; k < seg; k++) {
      a += (r() - 0.5) * 1.1;
      x += Math.cos(a) * (10 + r() * 34);
      y += Math.sin(a) * (10 + r() * 34);
      c.lineTo(x, y);
    }
    c.strokeStyle = `rgba(214,236,255,${0.10 + r() * 0.30})`;
    c.lineWidth = 0.6 + r() * 1.6;
    c.stroke();
  }
  // Bulles emprisonnees.
  for (let i = 0; i < 90; i++) {
    const x = r() * n, y = r() * n, rr = 0.6 + r() * 2.2;
    c.beginPath();
    c.arc(x, y, rr, 0, Math.PI * 2);
    c.fillStyle = `rgba(226,242,255,${0.08 + r() * 0.22})`;
    c.fill();
  }

  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Ruisseau {
  constructor(scene, chemin, relief, palier, clairieres) {
    this.groupe = new THREE.Group();
    this.groupe.name = 'ruisseau';
    this.passages = [];

    const rand = rng(5150);
    const tex = texGlace();

    /* La glace est LISSE et SOMBRE : c'est l'inverse exact de la neige, et
       c'est ce contraste qui porte tout l'effet. Une glace claire et mate
       passerait pour de la neige tassee et ne servirait a rien. */
    const mat = new THREE.MeshStandardMaterial({
      color: 0x22333F, roughness: 0.14, metalness: 0.05,
      map: tex, envMapIntensity: 1.6,
    });
    mat.map.repeat.set(0.35, 0.35);

    const p = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const cot = new THREE.Vector3();

    /* Deux traversees seulement, bien separees : un ruisseau qu'on croise
       trois fois cesse d'etre un evenement. */
    const L = chemin.longueur;
    for (const frac of [0.24, 0.68]) {
      const s = L * frac;
      chemin.point(s, p);
      chemin.tangente(s, tan);
      chemin.cote(s, cot);

      let dansClairiere = false;
      for (const cl of clairieres) {
        if (Math.hypot(p.x - cl.x, p.z - cl.z) < cl.r * 1.2) { dansClairiere = true; break; }
      }
      if (dansClairiere) continue;

      /* Le lit serpente : une bande droite se lirait comme une route. On
         construit un ruban le long de la perpendiculaire au chemin, en le
         faisant onduler et varier de largeur. */
      const N = 26;
      const pos = [], uv = [], idx = [];
      const demi = 46;
      let plusBas = Infinity;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const le = (u - 0.5) * 2 * demi;
        // Meandre, plus marque au milieu ou on le voit de pres.
        const derive = Math.sin(u * 6.1 + frac * 11) * 3.4 + Math.sin(u * 13.7) * 1.1;
        const larg = 1.5 + Math.sin(u * 4.3 + 1.2) * 0.55 + rand() * 0.3;

        const cx = p.x + cot.x * le + tan.x * derive;
        const cz = p.z + cot.z * le + tan.z * derive;
        const y = relief.hauteur(cx, cz);
        if (y < plusBas) plusBas = y;

        for (const cote of [-1, 1]) {
          pos.push(cx + tan.x * larg * cote, y, cz + tan.z * larg * cote);
          uv.push(u * 9, (cote + 1) * 0.5);
        }
      }
      // La surface de l'eau est PLATE : c'est ce qui la distingue du sol.
      for (let i = 0; i < pos.length; i += 3) pos[i + 1] = plusBas + 0.06;

      for (let i = 0; i < N; i++) {
        const a = i * 2, b = a + 1, c2 = a + 2, d = a + 3;
        idx.push(a, c2, b, b, c2, d);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      geo.computeBoundingSphere();

      const ruban = new THREE.Mesh(geo, mat);
      ruban.receiveShadow = false;
      ruban.castShadow = false;
      this.groupe.add(ruban);

      /* Des pierres au bord, la ou la neige ne tient pas sur la glace. Elles
         disent que le lit est creuse, ce qu'une bande posee a plat ne peut
         pas dire toute seule. */
      const matRoche = new THREE.MeshStandardMaterial({
        color: 0x4A4E55, roughness: 0.95, flatShading: true,
      });
      const geoRoche = new THREE.IcosahedronGeometry(1, 0);
      const nbP = palier.nom === 'bas' ? 10 : 20;
      const pierres = new THREE.InstancedMesh(geoRoche, matRoche, nbP);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const v = new THREE.Vector3();
      const ech = new THREE.Vector3();
      for (let k = 0; k < nbP; k++) {
        const u = rand();
        const le = (u - 0.5) * 2 * demi;
        const derive = Math.sin(u * 6.1 + frac * 11) * 3.4 + Math.sin(u * 13.7) * 1.1;
        const cote = rand() < 0.5 ? -1 : 1;
        const d = (1.5 + rand() * 1.1) * cote;
        const x = p.x + cot.x * le + tan.x * (derive + d);
        const z = p.z + cot.z * le + tan.z * (derive + d);
        const r0 = 0.16 + rand() * 0.26;
        e.set(rand() * 3, rand() * 3, rand() * 3);
        q.setFromEuler(e);
        v.set(x, relief.hauteur(x, z) - r0 * 0.35, z);
        ech.set(r0, r0 * (0.6 + rand() * 0.4), r0);
        m.compose(v, q, ech);
        pierres.setMatrixAt(k, m);
      }
      pierres.instanceMatrix.needsUpdate = true;
      pierres.castShadow = palier.ombres;
      this.groupe.add(pierres);

      this.passages.push({ s, y: plusBas });
    }

    scene.add(this.groupe);
    this.nb = this.passages.length;
  }

  /* Le cerf franchit-il la glace en ce moment ? Le son s'en sert : un sabot
     sur la glace ne crisse pas, il CLAQUE. */
  surGlace(s) {
    for (const p of this.passages) {
      if (Math.abs(s - p.s) < 2.4) return true;
    }
    return false;
  }
}
