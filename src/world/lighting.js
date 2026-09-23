/* Lumiere.

   Trois sources seulement, mais placees avec soin :

   1. une directionnelle rasante — le soleil couchant puis la lune. C'est
      elle qui donne les longues ombres bleues sur la neige et le liseré
      lumineux sur le dos du cerf ;
   2. une hemispherique — le ciel eclaire par le haut en bleu froid, la
      neige renvoie par le bas. C'est ce rebond qui empeche les ombres
      d'etre noires et qui rend la neige credible ;
   3. une lueur chaude ponctuelle, deplacee sur le cadeau en cours, qui
      rechauffe la scene au moment ou il s'ouvre.

   L'ombre suit la camera : une seule cascade suffit puisque le brouillard
   masque tout au-dela de 140 unites. */

import * as THREE from 'three';

export class Lumieres {
  constructor(scene, palier) {
    this.palier = palier;

    /* --- la directionnelle --- */
    this.soleil = new THREE.DirectionalLight(0xFFD2A0, 1.75);
    this.soleil.position.set(-42, 32, -78);
    this.dir = this.soleil.position.clone().normalize();

    if (palier.ombres) {
      this.soleil.castShadow = true;
      const s = this.soleil.shadow;
      s.mapSize.set(palier.ombreTaille, palier.ombreTaille);
      s.camera.near = 1;
      s.camera.far = 220;
      const r = 58;                 // rayon couvert par la carte d'ombre
      s.camera.left = -r; s.camera.right = r;
      s.camera.top = r; s.camera.bottom = -r;
      s.bias = -0.0016;
      s.normalBias = 0.42;          // evite l'acne sur la neige bombee
      /* LE RAYON DE FLOU SE MESURE EN TEXELS, PAS EN METRES.
         A rayon fixe, une carte deux fois plus fine (2048 contre 1024)
         couvre le meme disque de 58 m avec des texels deux fois plus
         petits : le bord de l'ombre devient deux fois plus dur, alors que
         le palier haut est cense etre le PLUS soigne, pas le plus dur.
         On met donc le rayon a l'echelle de la resolution pour garder la
         meme largeur de flou en metres sur tous les paliers — gratuit,
         puisque le noyau reste a cinq echantillons quel que soit le rayon. */
      s.radius = 3.2 * (palier.ombreTaille / 1024);
      /* SANS CETTE LIGNE, AUCUN DES SIX REGLAGES CI-DESSUS N'EXISTE.

         C'est le piege classique des cameras de three.js, et il ne dit
         jamais rien : `left`, `right`, `top`, `bottom`, `near` et `far` ne
         sont que des CHAMPS. Ce qui sert au rendu, c'est la matrice de
         projection, et elle n'est recalculee que sur demande.
         `LightShadow.updateMatrices()`, appele a chaque image par le
         moteur, ne la recalcule PAS : il replace la camera et compose la
         matrice d'ombre a partir de la projection existante.

         La projection restait donc celle par defaut de
         `DirectionalLightShadow` — une boite de DIX METRES DE COTE, au lieu
         des cent seize voulus. Dans une foret de sapins de vingt metres
         semes sur soixante, autant dire que rien d'utile n'entrait dans la
         carte : elle etait correctement dimensionnee, correctement remplie,
         correctement lue, et vide de tout ce qui comptait.

         Le defaut etait invisible a la lecture du code (les six lignes ont
         l'air de fonctionner) et invisible a l'oeil (on ne remarque pas
         une ombre absente, on trouve juste que « ca fait synthetique »).
         Il a fallu le mesurer : basculer `shadow.intensity` de 1 a 0 ne
         changeait pas un pixel, a six endroits du parcours. */
      s.camera.updateProjectionMatrix();
    }
    scene.add(this.soleil);
    scene.add(this.soleil.target);

    /* --- le rebond ciel / neige --- */
    this.hemi = new THREE.HemisphereLight(0x7A9CBC, 0x2E4258, 0.78);
    scene.add(this.hemi);

    /* --- la lueur du cadeau --- */
        /* Portee resserree et decroissance plus franche : une lueur de cadeau
       qui porte a vingt-six metres eclaire la clairiere entiere et cesse
       d'etre une source pour devenir une ambiance. */
    /* Portee elargie et decroissance ramenee au carre exact : c'est ce
       couple qui etale la lumiere au lieu de la concentrer sur la boite.
       Voir Halte.eclat() pour le raisonnement complet. */
    this.lueur = new THREE.PointLight(0xFFC98A, 0, 24, 2.0);
    this.lueur.castShadow = false;
    scene.add(this.lueur);

    this._c = new THREE.Color();
  }

  /* Reprend les teintes calculees par le ciel, pour que lumiere et
     atmosphere ne divergent jamais. */
  accorder(ambiance) {
    this.soleil.color.set(ambiance.soleil);
    this.soleil.intensity = ambiance.force;
    this.hemi.color.set(ambiance.ciel);
    this.hemi.groundColor.set(ambiance.sol);
    this.hemi.intensity = ambiance.ambiant;
  }

  /* La carte d'ombre est petite : on la recentre devant la camera, la ou
     on regarde, plutot que sur la camera elle-meme. */
  maj(camera, regard) {
    const p = regard || camera.position;
    this.soleil.target.position.set(p.x, 0, p.z);
    this.soleil.position.set(
      p.x + this.dir.x * 90,
      this.dir.y * 90 + 26,
      p.z + this.dir.z * 90
    );
    this.soleil.target.updateMatrixWorld();
  }

  /* Allume la lueur chaude sur un cadeau. */
  poserLueur(position, couleur, intensite) {
    if (position) this.lueur.position.copy(position);
    if (couleur !== undefined) this.lueur.color.set(couleur);
    this.lueur.intensity = intensite;
  }
}
