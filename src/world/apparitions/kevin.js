import * as THREE from 'three';
import { smoothstep, clamp } from '../../core/noise.js';
import {
  REPERES, construireCorps, nouvelleInstance, appliquerPose, regarderVers,
} from '../humanoide.js';

/* ==========================================================================
   8. SEUL A LA MAISON

   Antoine : « trois Spider-Man c'est trop, rajoute une reference a un
   autre film connu ». Le triangle de Spider-Man qui se pointent du doigt
   est retire (deux passages du personnage suffisent, et le troisieme
   citait surtout un mème) ; a sa place, la pose la plus reconnaissable du
   cinema familial de Noel — les deux mains plaquees sur les joues, la
   bouche grande ouverte. Un enfant seul, en pleine neige, qui hurle sans
   bruit : ca n'a besoin d'aucun visage pour se reconnaitre, seulement de
   ce geste-la.
   ========================================================================== */
const BEIGE_PULL = new THREE.Color(0xC9A876);
const PANTALON_SOMBRE = new THREE.Color(0x262B33);
const PEAU_CLAIRE = new THREE.Color(0xD8B48C);

function teinteKevin(x, y, z, c, os) {
  if (os === 'piedD' || os === 'piedG') { c.setHex(0x1B1E24); return; }
  const jambe = os === 'cuisseD' || os === 'cuisseG' || os === 'molletD' || os === 'molletG';
  if (jambe) { c.copy(PANTALON_SOMBRE); return; }
  if (os === 'tete') {
    /* Le bonnet, sur le dessus et l'arriere du crane ; le visage, dans
       l'ombre, en dessous — la meme logique de coupe par la normale que
       la chevelure de Kill Bill, ici sur un bonnet plutot qu'un carre. */
    if (y > REPERES.crane - 0.05 || (z > 0.01 && y > REPERES.menton)) { c.setHex(0xB23B3B); return; }
    c.copy(PEAU_CLAIRE);
    return;
  }
  c.copy(BEIGE_PULL);
  void x; void z;
}

/* LA POSE. Les deux bras montent haut et se replient fort — les mains
   viennent aux joues, les coudes ecartes — c'est exactement la silhouette
   de l'affiche, jusque dans l'asymetrie legere qui empeche une symetrie
   parfaite de se lire comme une pose de mannequin. */
const POSE_KEVIN = {
  brasD: [-2.00, 0.15, 0.22], avantD: [-1.85, 0, 0], mainD: [0, 0, 0.15],
  brasG: [-2.10, -0.12, -0.20], avantG: [-1.90, 0, 0], mainG: [0, 0, -0.15],
  cuisseD: [-0.04, 0, 0.05], molletD: [0.06, 0, 0],
  cuisseG: [0.04, 0, -0.05], molletG: [0.06, 0, 0],
  colonne: [-0.10, 0, 0], poitrine: [-0.16, 0, 0],
  cou: [0.10, 0, 0], tete: [0.18, 0, 0],
};

let _corpsKevin = null;

export function seulALaMaison(palier) {
  const g = new THREE.Group();
  if (!_corpsKevin) {
    _corpsKevin = construireCorps(palier, {
      teinter: teinteKevin,
      // Une charpente plus menue : c'est ce rapport, avant toute echelle,
      // qui fait lire un enfant plutot qu'un adulte reduit.
      gabarit: { carrure: 0.80, masse: 0.76 },
      pas: palier.nom === 'bas' ? 0.032 : palier.nom === 'moyen' ? 0.024 : 0.020,
    });
  }
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.78, metalness: 0.0,
    emissive: new THREE.Color(0x0A0806), emissiveIntensity: 1,
  });
  const perso = nouvelleInstance(_corpsKevin, mat, { ombres: palier.ombres });
  // Et une echelle plus petite encore, par-dessus le gabarit : a vingt
  // metres et de nuit, c'est elle qui achieve de le distinguer d'un adulte.
  perso.scale.setScalar(0.82);
  g.add(perso);

  const os = perso.userData.os;
  appliquerPose(os, POSE_KEVIN);

  g.userData.jouer = (u, t, camera) => {
    const vis = smoothstep(0, 0.10, u) * smoothstep(1, 0.88, u);
    g.visible = vis > 0.01;
    if (!g.visible) return;

    /* IL TREMBLE — de froid, de peur, ou des deux a la fois. Sans ce
       battement rapide et minuscule, la pose la plus celebre du cinema
       familial de Noel devient une statue de cire plantee dans la neige. */
    const tremble = Math.sin(t * 14) * 0.035 + Math.sin(t * 23 + 1.7) * 0.02;
    os.brasD.rotation.z += tremble;
    os.brasG.rotation.z -= tremble;
    os.tete.rotation.z += tremble * 0.6;

    // Il vous voit passer, et son hurlement silencieux se tourne vers vous.
    regarderVers(perso, os, camera, smoothstep(0.18, 0.34, u) * 0.85);
    void clamp;
  };
  return g;
}
