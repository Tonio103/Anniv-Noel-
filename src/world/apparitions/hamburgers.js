import * as THREE from 'three';
import { smoothstep } from '../../core/noise.js';

/* ==========================================================================
   LES HAMBURGERS QUI VOLENT

   Antoine : « je veux des hamburgers qui volent car j'aime la nourriture ».
   Rien a expliquer, rien a reconnaitre — juste une nuee qui tourbillonne
   devant le chemin. Plantee une fois pour toutes a un point fixe : voir la
   lune plus haut pour la raison exacte (jamais recalculee depuis la
   camera, jamais deux fois au meme endroit par accident). */
const matPainHB = new THREE.MeshStandardMaterial({ color: 0xD9A24B, roughness: 0.85 });
const matSteakHB = new THREE.MeshStandardMaterial({ color: 0x5A3420, roughness: 0.92 });
const matFromageHB = new THREE.MeshStandardMaterial({ color: 0xF0B93C, roughness: 0.45 });
const matSaladeHB = new THREE.MeshStandardMaterial({ color: 0x4C8A3A, roughness: 0.9 });

function hamburgerVolant(echelle) {
  const g = new THREE.Group();
  const bas = new THREE.Mesh(
    new THREE.SphereGeometry(0.30, 10, 6, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45),
    matPainHB);
  bas.position.y = -0.08;
  g.add(bas);
  const steak = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.10, 12), matSteakHB);
  steak.position.y = 0.02;
  g.add(steak);
  const salade = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 6, 14), matSaladeHB);
  salade.rotation.x = Math.PI / 2;
  salade.position.y = 0.09;
  g.add(salade);
  const fromage = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.03, 0.50), matFromageHB);
  fromage.position.y = 0.11;
  fromage.rotation.y = Math.PI / 4;
  g.add(fromage);
  const haut = new THREE.Mesh(
    new THREE.SphereGeometry(0.31, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62),
    matPainHB);
  haut.position.y = 0.16;
  g.add(haut);
  g.scale.setScalar(echelle);
  return g;
}

export function nueeHamburgers(chemin, palier) {
  const g = new THREE.Group();
  g.userData.suitCamera = true;

  const N = palier.nom === 'bas' ? 6 : 10;
  const burgers = [];
  for (let i = 0; i < N; i++) {
    const mesh = hamburgerVolant(1.8 + Math.random() * 1.1);
    g.add(mesh);
    burgers.push({
      mesh,
      ang: (i / N) * Math.PI * 2 + Math.random() * 0.6,
      rayon: 1.6 + Math.random() * 1.8,
      vAng: 0.35 + Math.random() * 0.55,
      hauteur: -0.8 + Math.random() * 2.2,
      dephasage: Math.random() * 10,
      spinX: (Math.random() - 0.5) * 2.4,
      spinZ: (Math.random() - 0.5) * 2.4,
    });
  }

  const p = new THREE.Vector3(), tan = new THREE.Vector3(), cote = new THREE.Vector3();
  let calcule = false;
  const posNuee = new THREE.Vector3();
  g.userData.reinit = () => { calcule = false; };

  g.userData.jouer = (u, t, camera, sAncre) => {
    const vis = smoothstep(0, 0.14, u) * smoothstep(1, 0.84, u);
    g.visible = vis > 0.01;
    if (!g.visible || !camera) return;

    if (!calcule) {
      chemin.point(sAncre, p);
      chemin.tangente(sAncre, tan);
      chemin.cote(sAncre, cote);
      posNuee.copy(p).addScaledVector(tan, 10).addScaledVector(cote, -6);
      posNuee.y = p.y + 4.4;
      calcule = true;
    }
    g.position.copy(posNuee);
    // Materialisation par l'echelle plutot que par l'opacite : les
    // materiaux sont partages entre toutes les instances (peu couteux),
    // et une opacite par-objet n'existe donc pas a ce niveau.
    g.scale.setScalar(Math.max(0.001, vis));

    for (const b of burgers) {
      const a = b.ang + t * b.vAng;
      b.mesh.position.set(
        Math.cos(a) * b.rayon,
        b.hauteur + Math.sin(t * 0.8 + b.dephasage) * 0.45,
        Math.sin(a) * b.rayon
      );
      b.mesh.rotation.x += 0.017 * b.spinX;
      b.mesh.rotation.z += 0.017 * b.spinZ;
    }
  };
  return g;
}
