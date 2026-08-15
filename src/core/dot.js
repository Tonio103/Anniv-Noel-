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

/* POURQUOI UN DEGRADE A PALIERS FAIT TOUJOURS UN HALO « DECOUPE ».

   Un `createRadialGradient` interpole LINEAIREMENT entre ses arrets. Le profil
   radial obtenu est donc une ligne brisee : sa pente change d'un coup a chaque
   arret. L'oeil est bien plus sensible aux ruptures de pente qu'aux
   differences de niveau — c'est le principe des bandes de Mach — et il lit
   chacune de ces cassures comme un CONTOUR. Avec trois arrets, on dessine
   donc trois anneaux, et le halo a un bord meme si son alpha finit bien a
   zero. C'est exactement ce qu'Antoine decrit : des lumieres delimitees au
   lieu de lumieres diffusees.

   La seule facon d'y echapper est d'ecrire le profil PIXEL PAR PIXEL, avec
   une fonction dont toutes les derivees sont continues. On additionne donc
   deux termes :

   · un coeur gaussien, qui donne la source elle-meme ;
   · une trainee large en puissance, qui donne la diffusion dans l'air.

   Aucune des deux n'a de rupture, et leur somme s'annule proprement au bord.
   La lumiere n'a plus de contour du tout : elle se dilue. */
function peindreLueur(n, coeur, trainee, force) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const c = cv.getContext('2d');
  const img = c.createImageData(n, n);
  const d = img.data;
  const m = (n - 1) / 2;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const r = Math.hypot(x - m, y - m) / (n / 2);
      let a = 0;
      if (r < 1) {
        const gauss = Math.exp(-coeur * r * r);
        const large = Math.pow(1 - r, trainee);
        // La fenetre finale garantit un zero exact au bord, sans marche.
        a = (gauss * force + large * (1 - force)) * (1 - r * r) * (1 - r * r);
      }
      const i = (y * n + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = Math.round(Math.min(1, Math.max(0, a)) * 255);
    }
  }
  c.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let cache = null;

export function grainRond() {
  if (cache) return cache;
  // Un grain de neige : coeur assez net, trainee courte.
  cache = peindreLueur(48, 7.0, 2.2, 0.62);
  return cache;
}

let cacheLueur = null;

/* La lueur diffuse, partagee par toutes les sources : lanternes, bougies,
   boules du sapin, fenetres, lueur du paquet. Coeur doux et trainee TRES
   longue — c'est la trainee qui fait « lumiere dans l'air froid » plutot que
   « pastille lumineuse collee sur l'image ». */
export function lueurDiffuse() {
  if (cacheLueur) return cacheLueur;
  cacheLueur = peindreLueur(160, 3.2, 3.4, 0.38);
  return cacheLueur;
}

let cacheTache = null;

/* Tache radiale douce, pour une ombre de CONTACT — celle qui rattache un
   objet au sol independamment de la carte d'ombre reelle (portee, palier de
   qualite, angle du soleil). Partagee par le cerf et les sapins proches :
   memes causes, meme remede. Le profil tient sa valeur pleine plus longtemps
   qu'un degrade lineaire ne le ferait, pour rester visible sur ce qui depasse
   du volume qu'elle ancre — voir l'usage sur le cerf pour la mesure qui l'a
   etabli. */
export function tacheDouce() {
  if (cacheTache) return cacheTache;
  const n = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.42, 'rgba(255,255,255,0.88)');
  g.addColorStop(0.70, 'rgba(255,255,255,0.44)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, n, n);
  cacheTache = new THREE.CanvasTexture(cv);
  cacheTache.colorSpace = THREE.SRGBColorSpace;
  return cacheTache;
}
