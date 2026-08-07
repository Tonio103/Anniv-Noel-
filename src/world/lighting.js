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
      s.radius = 3.2;
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
