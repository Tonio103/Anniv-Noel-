/* Ce qui habite les clairieres.

   Deux promesses du plan restaient en souffrance, et ce sont justement les
   deux endroits ou la balade s'arrete le plus longtemps.

   LES LANTERNES. La clairiere du Black Friday parle de dates : cinq reperes
   entre le 19 novembre et le 25 decembre. Les planter dans la neige comme
   des jalons donne au texte un ancrage dans le decor — on lit une carte
   posee au sol, pas un tableau. Elles sont alignees sur la traversee de la
   clairiere, de la plus lointaine a la plus proche, dans l'ordre du
   calendrier : la derniere, celle de Noel, est celle qu'on frole.

   LE SAPIN DE LA FIN. Dans la derniere clairiere, un grand conifere porte
   des lumieres. C'est le seul objet franchement chaleureux de toute la
   balade, et il n'arrive qu'apres l'avoir meritee.

   Toutes les sources sont poussees BIEN AU-DELA DU BLANC. Sans cela elles
   ne franchissent pas le seuil du halo et restent des points colores plats ;
   au-dela, elles rayonnent vraiment sur la nuit.
*/

import * as THREE from 'three';
import { rng } from '../core/noise.js';

function halo() {
  const n = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, n, n);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Une lanterne sur son piquet : un montant sombre, une cage claire, un halo.
   C'est le halo qui porte l'effet a distance, la cage n'est qu'un point. */
function lanterne(texHalo, matBois, hauteur) {
  const g = new THREE.Group();

  const piquet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.05, hauteur, 6), matBois
  );
  piquet.position.y = hauteur / 2;
  g.add(piquet);

  const matVerre = new THREE.MeshBasicMaterial({ fog: true });
  // Juste au-dessus du seuil du halo : plus haut, la lanterne devient une
  // tache blanche qui mange la clairiere.
  matVerre.color.setRGB(3.2, 1.9, 0.7);
  const cage = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.24, 0.17), matVerre);
  cage.position.y = hauteur + 0.10;
  g.add(cage);

  const chapeau = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.10, 5), matBois);
  chapeau.position.y = hauteur + 0.27;
  g.add(chapeau);

  const matHalo = new THREE.SpriteMaterial({
    map: texHalo, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  });
  matHalo.color.setRGB(1.8, 1.05, 0.42);
  const h = new THREE.Sprite(matHalo);
  h.scale.setScalar(1.15);
  h.position.y = hauteur + 0.10;
  g.add(h);

  return g;
}

/* Le sapin de la derniere clairiere : la meme silhouette que la foret, mais
   constellee de points chauds. */
function sapinDeFete(modele, matFeuillage, matNeige, texHalo, rand, palier) {
  const g = new THREE.Group();
  const H = 7.5;

  const f = new THREE.Mesh(modele.feuillage, matFeuillage);
  f.scale.set(H * 0.95, H, H * 0.95);
  f.castShadow = palier.ombres;
  g.add(f);
  const n = new THREE.Mesh(modele.neige, matNeige);
  n.scale.copy(f.scale);
  g.add(n);

  /* Les lumieres suivent une helice, du bas vers la cime : c'est ainsi
     qu'on les accroche vraiment, et ca evite l'anneau regulier. */
  const matHalo = new THREE.SpriteMaterial({
    map: texHalo, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  });
  const teintes = [[4.5, 2.2, 0.8], [4.0, 1.0, 0.9], [1.6, 3.6, 1.6], [4.4, 3.6, 1.2]];
  const nb = palier.nom === 'bas' ? 26 : 52;
  for (let i = 0; i < nb; i++) {
    const t = i / nb;
    const y = 0.14 + t * 0.80;
    const r = (1 - t) * 0.29 * H + 0.05;
    const a = t * Math.PI * 9 + rand() * 0.5;
    const m = matHalo.clone();
    const c = teintes[(rand() * teintes.length) | 0];
    m.color.setRGB(c[0], c[1], c[2]);
    const s = new THREE.Sprite(m);
    s.scale.setScalar(0.5 + rand() * 0.25);
    s.position.set(Math.cos(a) * r, y * H, Math.sin(a) * r);
    g.add(s);
  }

  return g;
}

export class Clairieres {
  constructor(scene, chemin, relief, palier, stations, modeleSapin, matFeuillage, matNeige) {
    this.groupe = new THREE.Group();
    this.groupe.name = 'clairieres';
    const rand = rng(2026);
    const texHalo = halo();

    const matBois = new THREE.MeshStandardMaterial({ color: 0x241A12, roughness: 0.95 });
    const p = new THREE.Vector3();
    const c = new THREE.Vector3();
    const tan = new THREE.Vector3();

    for (let i = 0; i < stations.length; i++) {
      const st = stations[i];
      const s = chemin.haltes[i].s;
      chemin.point(s, p);
      chemin.cote(s, c);
      chemin.tangente(s, tan);

      if (st.scene?.lanterns) {
        /* Cinq jalons, alignes le long de la traversee et decales du chemin
           pour qu'on passe a cote plutot qu'au travers. */
        for (let k = 0; k < 5; k++) {
          const le = (k - 2) * 7.5;
          const x = p.x + tan.x * le + c.x * 4.6;
          const z = p.z + tan.z * le + c.z * 4.6;
          const l = lanterne(texHalo, matBois, 1.5 + rand() * 0.5);
          l.position.set(x, relief.hauteur(x, z) - 0.06, z);
          l.rotation.y = rand() * 0.6;
          this.groupe.add(l);
        }
      }

      if (st.scene?.tree && modeleSapin) {
        /* Devant, dans l'axe de marche plutot que sur le cote : c'est le
           dernier objet de la balade, il doit etre dans le champ quand on
           arrive, pas derriere l'epaule. */
        const x = p.x + tan.x * 16 + c.x * 6;
        const z = p.z + tan.z * 16 + c.z * 6;
        const arbre = sapinDeFete(modeleSapin, matFeuillage, matNeige, texHalo, rand, palier);
        arbre.position.set(x, relief.hauteur(x, z) - 0.2, z);
        this.groupe.add(arbre);
      }
    }

    scene.add(this.groupe);
    this.nb = this.groupe.children.length;
  }
}
