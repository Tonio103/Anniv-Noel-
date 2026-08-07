/* Le rendu : contexte WebGL, espace colorimetrique, exposition, ombres.

   Chaine physique de bout en bout — les couleurs saisies dans le code sont
   en sRGB, les calculs se font en lineaire, et le passage a l'ecran se fait
   par ACES. C'est ce qui evite le rendu delave typique du WebGL laisse par
   defaut, et ce qui permet a la neige de rester blanche sans "cramer". */

import * as THREE from 'three';

export function creerRendu(canvas, palier) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: palier.nom !== 'bas',
    powerPreference: 'high-performance',
    stencil: false,
    depth: true,
    alpha: false,
  });

  renderer.setPixelRatio(palier.dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;

  renderer.shadowMap.enabled = palier.ombres;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = true;

  return renderer;
}

/* Redimensionnement. On passe par la taille CSS reelle plutot que par
   innerWidth : sur mobile la barre d'URL change la hauteur en continu, et
   le canvas doit suivre sans etirer l'image. */
/* `lirePalier` est une FONCTION, pas un objet.

   C'est la correction d'un bug franc : la version precedente capturait
   l'objet `palier` dans la fermeture. Quand la vigie constatait que ca ramait
   et retrogradait, elle fabriquait un NOUVEL objet palier et rappelait
   `ajuster()` — qui relisait sagement l'ancien. La densite de pixels ne
   bougeait donc jamais d'un iota.

   Autrement dit, le seul levier qui compte vraiment pour la fluidite etait
   precisement celui que la degradation automatique ne touchait pas. On passe
   une fonction pour que la valeur soit relue a chaque fois, au lieu d'etre
   figee au premier appel. */
export function brancherResize(renderer, camera, composer, lirePalier) {
  let dernier = 0;

  function ajuster() {
    const palier = typeof lirePalier === 'function' ? lirePalier() : lirePalier;
    const c = renderer.domElement;
    const l = c.clientWidth || window.innerWidth;
    const h = c.clientHeight || window.innerHeight;

    renderer.setPixelRatio(palier.dpr);
    renderer.setSize(l, h, false);

    camera.aspect = l / h;
    // Un telephone en portrait voit tres peu de largeur : on elargit le champ
    // pour ne pas donner l'impression de regarder par un tube. Le drone
    // multiplie sa focale par ce facteur au lieu d'imposer la sienne.
    camera.userData.fovEchelle = camera.aspect < 0.72 ? 1.18
                               : camera.aspect < 1.0 ? 1.08 : 1.0;
    /* Degre de « portraitude », de 0 a 1. Le drone s'en sert pour se
       rapprocher et viser plus bas : en portrait, un cadrage regle pour le
       paysage laisse le sujet minuscule en haut de l'image et remplit toute
       la moitie basse de sol vide. C'est ce qu'on voyait sur telephone. */
    camera.userData.portrait = Math.max(0, Math.min(1, (0.95 - camera.aspect) / 0.35));
    camera.updateProjectionMatrix();

    if (composer) composer.setSize(l, h, palier.dpr);
  }

  window.addEventListener('resize', () => {
    const t = performance.now();
    dernier = t;
    setTimeout(() => { if (dernier === t) ajuster(); }, 120);
  });
  window.addEventListener('orientationchange', () => setTimeout(ajuster, 260));

  ajuster();
  return ajuster;
}

/* Test d'accessibilite du WebGL, appele avant toute construction : si ca
   echoue, on affiche la version lisible du contenu plutot qu'un ecran noir. */
export function webglDisponible() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return null;
    return gl;
  } catch {
    return null;
  }
}
