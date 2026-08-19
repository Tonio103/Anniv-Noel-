import * as THREE from 'three';
import { smoothstep } from '../../core/noise.js';
import {
  construireCorps, nouvelleInstance, appliquerPose, regarderVers,
} from '../humanoide.js';

/* ==========================================================================
   MUGIWARA — UN CLIN D'OEIL A ONE PIECE, PAS AU CINEMA CETTE FOIS.

   Antoine : « je veux one piece » — et, dans le meme message, que TOUTES
   les apparitions donnent l'impression que la camera reagit a ce qui
   bouge. Le geste le plus reconnaissable de la serie est aussi celui qui
   s'y prete le mieux : le poing qui s'etire jusqu'a nous, comme si le
   personnage frappait a travers l'ecran. Le bras n'est pas un OS qu'on
   etire — deformer un bras skinne a ce point le tordrait affreusement —
   c'est un ELASTIQUE a part, un cylindre redimensionne et oriente chaque
   image pour joindre l'epaule a un poing qui vole vers la camera.
   ========================================================================== */
const ROUGE_VESTE = new THREE.Color(0xB0271E);
const BLEU_SHORT = new THREE.Color(0x28345A);
const PEAU_LUFFY = new THREE.Color(0xE0A876);
const SANDALE_LUFFY = new THREE.Color(0x4A3320);

function teinteLuffy(x, y, z, c, os) {
  if (os === 'piedD' || os === 'piedG') { c.copy(SANDALE_LUFFY); return; }
  if (os === 'cuisseD' || os === 'cuisseG') { c.copy(BLEU_SHORT); return; }
  if (os === 'colonne' || os === 'poitrine') { c.copy(ROUGE_VESTE); return; }
  c.copy(PEAU_LUFFY);
  void x; void y; void z;
}

function chapeauPaille() {
  const g = new THREE.Group();
  const paille = new THREE.MeshStandardMaterial({ color: 0xE3C468, roughness: 0.88 });
  const bandeau = new THREE.MeshStandardMaterial({ color: 0xA8222A, roughness: 0.6 });
  const bord = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 6, 16), paille);
  bord.rotation.x = Math.PI / 2;
  g.add(bord);
  const calotte = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.20, 10, 1, true), paille);
  calotte.position.y = 0.10;
  g.add(calotte);
  const ruban = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.045, 10), bandeau);
  ruban.position.y = 0.015;
  g.add(ruban);
  return g;
}

const _elDir = new THREE.Vector3();
const _elUp = new THREE.Vector3(0, 1, 0);

/* Le bras : un cylindre tendu entre l'epaule et le poing, redimensionne et
   oriente chaque image — jamais un os anime, toujours une piece a part. */
function busteElastique(couleur) {
  const geoTube = new THREE.CylinderGeometry(0.075, 0.11, 1, 7, 1, true);
  geoTube.translate(0, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.72 });
  const tube = new THREE.Mesh(geoTube, mat);
  tube.visible = false;
  const poing = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), mat);
  poing.visible = false;
  const g = new THREE.Group();
  g.add(tube, poing);
  g.userData = { tube, poing };
  return g;
}

function tendreElastique(el, origine, cible) {
  const { tube, poing } = el.userData;
  _elDir.copy(cible).sub(origine);
  const dist = _elDir.length();
  if (dist < 0.03) { tube.visible = false; poing.visible = false; return; }
  _elDir.multiplyScalar(1 / dist);
  tube.visible = true; poing.visible = true;
  tube.position.copy(origine);
  tube.scale.set(1, dist, 1);
  tube.quaternion.setFromUnitVectors(_elUp, _elDir);
  poing.position.copy(cible);
}

let _corpsLuffy = null;

export function mugiwara(palier) {
  const g = new THREE.Group();
  if (!_corpsLuffy) {
    _corpsLuffy = construireCorps(palier, {
      teinter: teinteLuffy,
      gabarit: { carrure: 0.92, masse: 0.90 },
      pas: palier.nom === 'bas' ? 0.032 : palier.nom === 'moyen' ? 0.024 : 0.020,
    });
  }
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.80, metalness: 0.0,
    emissive: new THREE.Color(0x0A0806), emissiveIntensity: 1,
  });
  const perso = nouvelleInstance(_corpsLuffy, mat, { ombres: palier.ombres });
  g.add(perso);
  const os = perso.userData.os;

  // Plante, jambes ecartees, le bras gauche recule pour l'appel du coup —
  // le droit reste libre, c'est l'elastique qui en tient lieu.
  appliquerPose(os, {
    cuisseD: [-0.18, 0, 0.14], molletD: [0.10, 0, 0],
    cuisseG: [-0.18, 0, -0.14], molletG: [0.10, 0, 0],
    brasG: [-0.35, 0.10, -0.55], avantG: [-0.65, 0, 0],
    colonne: [0.06, 0.08, 0], poitrine: [0.04, 0.05, 0],
  });

  const chapeau = chapeauPaille();
  chapeau.position.set(0, 0.30, 0.02);
  os.tete.add(chapeau);

  const elastique = busteElastique(PEAU_LUFFY.getHex());
  g.add(elastique);
  const origine = new THREE.Vector3();
  const cible = new THREE.Vector3();

  g.userData.jouer = (u, t, camera) => {
    const vis = smoothstep(0, 0.10, u) * smoothstep(1, 0.88, u);
    g.visible = vis > 0.01;
    if (!g.visible) return;

    regarderVers(perso, os, camera, smoothstep(0.04, 0.14, u) * 0.7);

    /* L'ELAN — le poing recule et se crispe — puis LE TIR, qui l'envoie
       loin devant, jusqu'a nous, avant de le laisser revenir. */
    const arme = smoothstep(0.14, 0.32, u) * smoothstep(0.56, 0.42, u);
    const lance = smoothstep(0.42, 0.54, u) * smoothstep(0.88, 0.64, u);
    os.brasD.rotation.set(-0.10 - arme * 0.85, 0.05, 0.12);
    os.avantD.rotation.set(0.08 + arme * 0.5, 0, 0);

    origine.set(0.36, 1.32, -0.08);
    const portee = lance * 6.4;
    cible.set(
      0.36 + Math.sin(t * 11) * 0.05 * lance,
      1.32 + Math.sin(lance * Math.PI) * 0.5,
      -0.08 - portee
    );
    tendreElastique(elastique, origine, cible);
  };
  return g;
}
