/* Les cabanes.

   Il en faut TRES peu — trois sur tout le parcours — et c'est justement leur
   rarete qui les rend precieuses. Une fenetre allumee apercue entre deux
   troncs, loin du chemin, en dit plus sur la solitude de la foret que
   n'importe quel effet : elle prouve qu'il y a un ailleurs, et que quelqu'un
   y attend.

   Elles ne sont donc jamais sur le passage. Elles se devinent a vingt ou
   trente metres, a demi mangees par la brume, et la lueur chaude de leurs
   fenetres tranche sur le bleu de la neige. C'est le seul point chaud du
   paysage avant la clairiere finale.

   Construction volontairement sobre : des volumes simples, une toiture
   enneigee, deux carreaux emissifs et un filet de fumee. Vues d'aussi loin,
   plus de detail ne se verrait pas.
*/

import * as THREE from 'three';
import { rng } from '../core/noise.js';

/* Halo doux pour la lueur des fenetres. */
function halo() {
  const n = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, n, n);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function construireCabane(rand, palier, texHalo) {
  const g = new THREE.Group();

  const L = 3.6 + rand() * 1.4;          // largeur
  const P = 3.0 + rand() * 1.0;          // profondeur
  const H = 2.3 + rand() * 0.5;          // hauteur des murs

  const bois = new THREE.MeshStandardMaterial({ color: 0x2E2018, roughness: 0.95 });
  const boisClair = new THREE.MeshStandardMaterial({ color: 0x3C2A1E, roughness: 0.92 });
  const neige = new THREE.MeshStandardMaterial({ color: 0xE8F0F8, roughness: 0.80 });

  const murs = new THREE.Mesh(new THREE.BoxGeometry(L, H, P), bois);
  murs.position.y = H / 2;
  murs.castShadow = palier.ombres;
  murs.receiveShadow = palier.ombres;
  g.add(murs);

  /* Toit a deux pentes : un prisme couche. Le meme volume, legerement
     agrandi et remonte, porte la neige. */
  const pente = new THREE.CylinderGeometry(P * 0.72, P * 0.72, L * 1.12, 3, 1);
  const toit = new THREE.Mesh(pente, boisClair);
  toit.rotation.z = Math.PI / 2;
  toit.rotation.y = Math.PI / 2;
  toit.position.y = H + P * 0.30;
  toit.castShadow = palier.ombres;
  g.add(toit);

  const capot = new THREE.Mesh(
    new THREE.CylinderGeometry(P * 0.745, P * 0.745, L * 1.16, 3, 1), neige
  );
  capot.rotation.z = Math.PI / 2;
  capot.rotation.y = Math.PI / 2;
  capot.position.y = H + P * 0.31;
  capot.castShadow = palier.ombres;
  g.add(capot);

  /* Fenetres : deux carreaux emissifs sur la facade, plus un halo qui deborde
     sur la nuit. C'est le halo qui porte l'effet a distance, pas le carreau. */
  /* Bien au-dela du blanc : c'est ce qui fait passer la fenetre au-dessus du
     seuil du halo. La cible flottante du post-traitement l'accepte sans
     ecretage, et la courbe ACES la ramene ensuite dans les clous. */
  const chaud = new THREE.MeshBasicMaterial({ fog: true });
  chaud.color.setRGB(4.2, 2.4, 0.9);
  const matHalo = new THREE.SpriteMaterial({
    map: texHalo, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  });

  matHalo.color.setRGB(2.6, 1.5, 0.6);

  for (const cx of [-L * 0.24, L * 0.24]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.72), chaud);
    f.position.set(cx, H * 0.56, P / 2 + 0.012);
    g.add(f);

    const h = new THREE.Sprite(matHalo);
    h.scale.setScalar(2.6);
    h.position.set(cx, H * 0.56, P / 2 + 0.30);
    g.add(h);
  }

  /* Porte, purement pour la silhouette. */
  const porte = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x1C1310, roughness: 0.95 })
  );
  porte.position.set(0, 0.75, P / 2 + 0.014);
  g.add(porte);

  /* Cheminee et son filet de fumee. */
  const chem = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.9, 0.34), bois);
  chem.position.set(L * 0.28, H + P * 0.62, -P * 0.18);
  chem.castShadow = palier.ombres;
  g.add(chem);

  const N = palier.nom === 'bas' ? 14 : 26;
  const pos = new Float32Array(N * 3);
  const geoF = new THREE.BufferGeometry();
  geoF.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const fumee = new THREE.Points(geoF, new THREE.PointsMaterial({
    color: 0xB8C4CE, size: 0.42, transparent: true, opacity: 0.16,
    depthWrite: false, sizeAttenuation: true,
  }));
  fumee.frustumCulled = false;
  fumee.userData = {
    vie: Float32Array.from({ length: N }, () => rand()),
    N,
    base: new THREE.Vector3(L * 0.28, H + P * 0.62 + 0.5, -P * 0.18),
  };
  g.add(fumee);

  /* Un tas de neige au pied, qui pose la cabane sur le sol. */
  const tas = new THREE.Mesh(
    new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), neige
  );
  tas.scale.set(L * 0.72, 0.30, P * 0.72);
  tas.position.y = 0.02;
  g.add(tas);

  return { groupe: g, fumee };
}

export class Cabanes {
  constructor(scene, chemin, relief, palier, clairieres) {
    this.liste = [];
    const rand = rng(90210);

    /* Trois emplacements seulement, repartis sur le parcours et toujours
       ecartes du chemin. Le dernier est plus proche : c'est celui qu'on
       apercoit en arrivant vers la clairiere finale. */
    const places = [
      { t: 0.22, cote: -1, ecart: 30 },
      { t: 0.55, cote: 1, ecart: 34 },
      { t: 0.86, cote: -1, ecart: 24 },
    ];

    const texHalo = halo();
    const p = new THREE.Vector3();
    const c = new THREE.Vector3();

    for (const pl of places) {
      const s = pl.t * chemin.longueur;
      chemin.point(s, p);
      chemin.cote(s, c);
      const x = p.x + c.x * pl.cote * pl.ecart;
      const z = p.z + c.z * pl.cote * pl.ecart;

      // Jamais dans une clairiere : elles doivent rester degagees.
      let bloque = false;
      for (const cl of clairieres) {
        if (Math.hypot(x - cl.x, z - cl.z) < cl.r + 8) bloque = true;
      }
      if (bloque) continue;

      const cab = construireCabane(rand, palier, texHalo);
      cab.groupe.position.set(x, relief.hauteur(x, z) - 0.15, z);
      // Elle regarde vers le chemin : la facade eclairee doit etre visible.
      cab.groupe.rotation.y = Math.atan2(p.x - x, p.z - z);
      scene.add(cab.groupe);
      this.liste.push(cab);
    }
  }

  maj(dt) {
    for (const cab of this.liste) {
      const f = cab.fumee;
      const { vie, N, base } = f.userData;
      const arr = f.geometry.attributes.position.array;
      for (let i = 0; i < N; i++) {
        vie[i] += dt * 0.13;
        if (vie[i] > 1) {
          vie[i] -= 1;
          arr[i * 3] = base.x + (Math.random() - 0.5) * 0.1;
          arr[i * 3 + 1] = base.y;
          arr[i * 3 + 2] = base.z + (Math.random() - 0.5) * 0.1;
        }
        const v = vie[i];
        // Elle monte, s'elargit et se couche dans le vent.
        arr[i * 3] += (0.35 + v * 0.8) * dt;
        arr[i * 3 + 1] += (0.85 - v * 0.35) * dt;
        arr[i * 3 + 2] += (Math.random() - 0.5) * 0.25 * dt;
      }
      f.geometry.attributes.position.needsUpdate = true;
    }
  }
}
