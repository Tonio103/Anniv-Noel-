/* La foret.

   Les arbres sont semes le long du chemin, jamais uniformement : c'est
   l'irregularite qui fait la foret. Trois regles gouvernent le semis :

   · on degage un couloir de marche, sinon le cerf traverse les troncs ;
   · la densite augmente a mesure qu'on avance — la foret se referme
     litteralement derriere le visiteur, ce qui raconte l'enfoncement sans
     qu'aucun texte n'ait besoin de le dire ;
   · on garde quelques arbres tres proches du bord du chemin, qui passent en
     premier plan devant l'objectif. C'est ce qui donne le sentiment de vol
     entre les troncs plutot que de survol.

   Cote rendu, tout est instancie et decoupe en troncons le long du chemin :
   seuls les troncons proches sont dessines. */

import * as THREE from 'three';
import { rng } from '../core/noise.js';
import { genererSapin, appliquerVent, eclairerAiguilles } from './treeGeometry.js';

const TRONCONS = 14;

export class Foret {
  constructor(chemin, relief, palier, clairieres, uniformsVent) {
    this.chemin = chemin;
    this.relief = relief;
    this.palier = palier;

    const rand = rng(20261225);
    const modele = genererSapin(rand, palier.brancheDetail);
    // Expose : la clairiere finale reutilise la meme silhouette d'arbre.
    this.modele = modele;

    /* --- materiaux --------------------------------------------------------- */
    /* vertexColors : la geometrie porte une modulation clair/sombre par
       sommet, que la couleur d'instance vient teinter. Les deux se
       multiplient, donc la variation d'arbre a arbre est conservee. */
    this.matFeuillage = new THREE.MeshStandardMaterial({
      color: 0x44654E, roughness: 0.92, metalness: 0, flatShading: true,
      vertexColors: true,
    });
    this.matNeige = new THREE.MeshStandardMaterial({
      color: 0xE4EEF8, roughness: 0.74, metalness: 0, flatShading: true,
      vertexColors: true,
    });
    this.matTronc = new THREE.MeshStandardMaterial({
      color: 0x2B2119, roughness: 0.96, metalness: 0,
    });

    appliquerVent(this.matFeuillage, { amplitude: 1.0, uniforms: uniformsVent });
    appliquerVent(this.matNeige, { amplitude: 0.9, uniforms: uniformsVent });
    appliquerVent(this.matTronc, { amplitude: 0.25, uniforms: uniformsVent });

    /* L'eclairage des aiguilles vient PAR-DESSUS celui du vent : les deux
       s'enchainent sur le meme onBeforeCompile, dans cet ordre. Le feuillage
       transmet pleinement ; la neige posee dessus est opaque, elle ne recoit
       donc que la part de ciel. */
    eclairerAiguilles(this.matFeuillage, { uniforms: uniformsVent, transmission: 1 });
    eclairerAiguilles(this.matNeige, { uniforms: uniformsVent, transmission: 0.15 });

    /* --- semis ------------------------------------------------------------- */
    const arbres = this._semer(rand, clairieres);

    /* --- repartition en troncons ------------------------------------------- */
    this.groupe = new THREE.Group();
    this.groupe.name = 'foret';
    this.troncons = [];

    const parTroncon = Array.from({ length: TRONCONS }, () => []);
    for (const a of arbres) {
      const i = Math.min(TRONCONS - 1, Math.floor((a.s / chemin.longueur) * TRONCONS));
      parTroncon[i].push(a);
    }

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const ech = new THREE.Vector3();
    const teinte = new THREE.Color();

    for (let i = 0; i < TRONCONS; i++) {
      const liste = parTroncon[i];
      if (!liste.length) { this.troncons.push(null); continue; }

      const feuillage = new THREE.InstancedMesh(modele.feuillage, this.matFeuillage, liste.length);
      const neige = new THREE.InstancedMesh(modele.neige, this.matNeige, liste.length);
      const tronc = new THREE.InstancedMesh(modele.tronc, this.matTronc, liste.length);

      for (let k = 0; k < liste.length; k++) {
        const a = liste[k];
        // Une inclinaison de quelques degres : aucun arbre n'est parfaitement droit.
        e.set(a.pencheX, a.rot, a.pencheZ);
        q.setFromEuler(e);
        v.set(a.x, a.y, a.z);
        ech.set(a.h * a.large, a.h, a.h * a.large);
        m.compose(v, q, ech);
        feuillage.setMatrixAt(k, m);
        neige.setMatrixAt(k, m);
        tronc.setMatrixAt(k, m);

        // Variation de teinte : sans elle, la foret parait peinte au rouleau.
        // Releve pour compenser la modulation par sommet, de moyenne < 1.
        teinte.setHSL(0.34 + a.teinte * 0.06, 0.22 + a.teinte * 0.16, 0.40 + a.teinte * 0.18);
        feuillage.setColorAt(k, teinte);
      }

      for (const im of [feuillage, neige, tronc]) {
        im.instanceMatrix.needsUpdate = true;
        im.castShadow = palier.ombres;
        im.receiveShadow = palier.ombres && palier.nom === 'haut';
        im.computeBoundingSphere();
        im.matrixAutoUpdate = false;
        this.groupe.add(im);
      }
      if (feuillage.instanceColor) feuillage.instanceColor.needsUpdate = true;

      const centre = chemin.point(((i + 0.5) / TRONCONS) * chemin.longueur, new THREE.Vector3());
      this.troncons.push({ meshes: [feuillage, neige, tronc], centre, index: i });
    }

    this.nbArbres = arbres.length;
  }

  _semer(rand, clairieres) {
    const { chemin, relief, palier } = this;
    const em = relief.emprise;
    const arbres = [];
    const vise = palier.arbres;

    let essais = 0;
    const maxEssais = vise * 26;

    while (arbres.length < vise && essais < maxEssais) {
      essais++;
      const x = em.xmin + rand() * (em.xmax - em.xmin);
      const z = em.zmin + rand() * (em.zmax - em.zmin);

      const pr = chemin.proximite(x, z);

      // Trop loin du chemin : invisible sous le brouillard, inutile a dessiner.
      if (pr.d > 165) continue;

      // Le couloir de marche reste degage, avec un bord irregulier.
      // La marge doit tenir compte de l'ENVERGURE des branches, pas seulement
      // du tronc : sinon un sapin de vingt metres etale ses branches jusque
      // dans l'objectif et vient barrer l'image d'une masse noire.
      const bord = 12 + rand() * 8;
      if (pr.d < bord) continue;

      // Clairieres : on n'y plante rien, et on adoucit la lisiere.
      let dansClairiere = false;
      for (const c of clairieres) {
        const d = Math.hypot(x - c.x, z - c.z);
        if (d < c.r * (0.82 + rand() * 0.3)) { dansClairiere = true; break; }
      }
      if (dansClairiere) continue;

      // La foret s'epaissit a mesure qu'on s'enfonce.
      const avancee = pr.s / chemin.longueur;
      const densite = 0.52 + avancee * 0.48;
      if (rand() > densite) continue;

      // Les arbres se rassemblent en bosquets plutot que de se repartir
      // regulierement : quelques trouees, quelques massifs.
      const grappe = 0.5 + 0.5 * Math.sin(x * 0.037 + z * 0.029) * Math.cos(z * 0.021 - x * 0.017);
      if (rand() > 0.44 + grappe * 0.72) continue;

      const y = relief.hauteur(x, z);

      // Un peu plus hauts au coeur de la foret, plus rabougris a la lisiere.
      const h = (11.5 + rand() * 13.5) * (0.86 + avancee * 0.28);

      arbres.push({
        x, y: y - 0.15, z, s: pr.s,
        h,
        large: 0.82 + rand() * 0.42,
        rot: rand() * Math.PI * 2,
        pencheX: (rand() - 0.5) * 0.06,
        pencheZ: (rand() - 0.5) * 0.06,
        teinte: rand(),
      });
    }
    return arbres;
  }

  /* Un troncon n'est dessine que s'il est a portee de vue. Le brouillard
     masque tout au-dela : inutile de payer pour ce qu'on ne voit pas. */
  maj(camera) {
    const portee = 250;
    const p = camera.position;
    for (const tr of this.troncons) {
      if (!tr) continue;
      const d = Math.hypot(tr.centre.x - p.x, tr.centre.z - p.z);
      const visible = d < portee;
      if (tr.meshes[0].visible !== visible) {
        for (const m of tr.meshes) m.visible = visible;
      }
      // Seuls les troncons vraiment proches alimentent la carte d'ombre.
      if (visible && this.palier.ombres) {
        const ombre = d < 95;
        if (tr.meshes[0].castShadow !== ombre) {
          for (const m of tr.meshes) m.castShadow = ombre;
        }
      }
    }
  }
}
