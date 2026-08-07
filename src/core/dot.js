/* Le grain rond, partage par tous les nuages de points.

   UN POINT SANS TEXTURE EST UN CARRE. C'est le comportement normal de
   `PointsMaterial` — sans `map`, chaque particule est un quad plein — mais
   personne ne veut jamais ca : la buee des naseaux, la gerbe de poudreuse,
   la fumee des cheminees et les feuilles qui tombent sortaient toutes en
   petits carres gris a aretes franches.

   Le defaut ne se voyait pas sur mon banc d'essai, parce qu'un carre de deux
   pixels ressemble a un grain. Sur un telephone, ou la densite d'ecran est
   deux a trois fois superieure, le meme carre en fait six ou huit et se lit
   pour ce qu'il est : un artefact. C'est exactement le genre de defaut qu'on
   ne peut pas trouver sans regarder l'appareil reel.

   La texture est fabriquee une seule fois et partagee : elle ne coute qu'un
   canevas de trente-deux pixels pour toute la scene. */

import * as THREE from 'three';

let cache = null;

export function grainRond() {
  if (cache) return cache;
  const n = 32;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.42, 'rgba(255,255,255,0.66)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, n, n);
  cache = new THREE.CanvasTexture(cv);
  cache.colorSpace = THREE.SRGBColorSpace;
  return cache;
}
