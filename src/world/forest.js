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

    /* DEUX NIVEAUX DE DETAIL.

       Le meme maillage servait a cinq metres et a cent-cinquante. Or au-dela
       d'une cinquantaine de metres un sapin ne fait plus qu'une trentaine de
       pixels de haut : ses quinze etages de branches et ses seize secteurs
       par etage se resolvent en une silhouette, et rien de plus. On peut donc
       le remplacer par une version a quatre secteurs et huit etages sans
       qu'aucune difference ne soit visible.

       Le gain est direct : c'est la majorite des arbres qui bascule, puisque
       la majorite est loin. C'est aussi la mesure la plus rentable de tout
       ce fichier, et elle etait absente.

       La graine est reinitialisee a la meme valeur pour que la silhouette
       grossiere reste celle du meme arbre : sinon la transition entre les
       deux niveaux se verrait comme un changement de forme. */
    const modeleLoin = genererSapin(rng(20261225), Math.max(3, palier.brancheDetail - 4));
    this.modeleLoin = modeleLoin;

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

    /* LES TROIS PIECES D'UN ARBRE BOUGENT ENSEMBLE.

       Elles avaient des amplitudes differentes — 1,0 / 0,9 / 0,25 — ce qui
       revient a demander au houppier de quitter son tronc. Un arbre plie d'un
       seul tenant : c'est la meme amplitude pour tout le monde, et c'est la
       raideur du bois, pas le reglage, qui fait que le tronc bouge moins que
       la cime (le facteur `prise`, qui croit avec la hauteur, s'en charge
       deja). */
    const VENT = 0.85;
    appliquerVent(this.matFeuillage, { amplitude: VENT, uniforms: uniformsVent });
    appliquerVent(this.matNeige, { amplitude: VENT, uniforms: uniformsVent });
    appliquerVent(this.matTronc, { amplitude: VENT, uniforms: uniformsVent });

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

      /* La version grossiere du meme tronçon. Les deux portent exactement les
         memes matrices d'instance ; seule change la geometrie, et on n'en
         affiche jamais qu'une des deux. */
      const feuillageLoin = new THREE.InstancedMesh(modeleLoin.feuillage, this.matFeuillage, liste.length);
      const neigeLoin = new THREE.InstancedMesh(modeleLoin.neige, this.matNeige, liste.length);

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
        feuillageLoin.setMatrixAt(k, m);
        neigeLoin.setMatrixAt(k, m);

        /* LE TRONC A SA PROPRE ECHELLE HORIZONTALE.

           Avec l'echelle uniforme du feuillage, son diametre suivait la
           hauteur : un metre trente pour un arbre de vingt-cinq metres. Un
           tronc ne grossit pas proportionnellement a la taille de l'arbre —
           il grossit beaucoup plus lentement. On le dimensionne donc a part,
           autour d'un arbre moyen, avec une variation faible : tous les
           troncs restent alors entre trente et soixante centimetres de
           diametre, ce qui est la fourchette d'un epicea adulte. */
        const epTronc = (11 + a.h * 0.28) * (0.85 + a.large * 0.2);
        m.compose(v, q, ech.set(epTronc, a.h, epTronc));
        tronc.setMatrixAt(k, m);

        // Variation de teinte : sans elle, la foret parait peinte au rouleau.
        // Releve pour compenser la modulation par sommet, de moyenne < 1.
        teinte.setHSL(0.34 + a.teinte * 0.06, 0.22 + a.teinte * 0.16, 0.40 + a.teinte * 0.18);
        feuillage.setColorAt(k, teinte);
        feuillageLoin.setColorAt(k, teinte);
      }

      for (const im of [feuillage, neige, tronc, feuillageLoin, neigeLoin]) {
        im.instanceMatrix.needsUpdate = true;
        im.castShadow = palier.ombres;
        im.receiveShadow = palier.ombres && palier.nom === 'haut';
        im.computeBoundingSphere();
        im.matrixAutoUpdate = false;
        this.groupe.add(im);
      }
      for (const im of [feuillage, feuillageLoin]) {
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
      }
      // La version grossiere ne porte jamais d'ombre : elle n'est utilisee
      // qu'au-dela de la portee de la carte d'ombre.
      for (const im of [feuillageLoin, neigeLoin]) im.castShadow = false;

      const centre = chemin.point(((i + 0.5) / TRONCONS) * chemin.longueur, new THREE.Vector3());
      this.troncons.push({
        pres: [feuillage, neige, tronc],
        loin: [feuillageLoin, neigeLoin],
        centre, index: i,
      });
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

      /* Le couloir de marche reste degage, avec un bord irregulier.

         MAIS IL ETAIT BEAUCOUP TROP LARGE. Douze a vingt metres de vide de
         chaque cote, c'est quarante metres de clairiere permanente : sur un
         telephone tenu en portrait, on ne voyait plus qu'une plaine blanche
         avec une frise d'arbres au loin. On ne s'enfoncait dans rien.

         La contrainte reste vraie — un sapin de vingt metres etale ses
         branches sur trois metres de rayon et viendrait barrer l'image. La
         reponse n'est donc pas d'approcher les gros, c'est de rapprocher les
         PETITS : la marge devient proportionnelle a la taille de l'arbre. Un
         grand reste au large, un jeune de huit metres vient a sept metres du
         bord du chemin. La lisiere se remplit de sous-bois et le couloir
         cesse d'etre une autoroute. */
      const hauteurVoulue = (11.5 + rand() * 13.5) * (0.86 + (pr.s / chemin.longueur) * 0.28);
      const bord = 5.0 + hauteurVoulue * 0.42 + rand() * 2.5;
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

      /* La hauteur retenue est celle qui a servi a calculer la marge : s'en
         ecarter ici ferait planter un grand arbre a la distance autorisee
         pour un petit, et il barrerait l'image — ce que toute la regle
         ci-dessus existe pour empecher. */
      const h = hauteurVoulue;

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
    /* PORTEE RAMENEE DE 250 A 150 METRES.

       Le brouillard est exponentiel, de densite ~0,011 : a cent-cinquante
       metres il ne laisse plus passer que huit pour cent de l'objet, et a
       deux-cent-cinquante, deux pour mille. On payait donc integralement des
       arbres rigoureusement invisibles — sur un tiers des tronçons.

       C'est le genre de reglage qui ne se voit pas a l'image et se voit
       beaucoup sur le budget : c'est exactement ce qu'on veut sacrifier en
       premier pour financer la definition. */
    const portee = 135;
    /* Bascule vers la version grossiere. Le seuil est genereux — les
       tronçons font une soixantaine de metres, donc un arbre du bord d'un
       tronçon « proche » peut deja etre a quatre-vingts metres. On prefere
       basculer un peu tard qu'un peu tot : une transition qu'on remarque
       coute plus cher, en credibilite, que les triangles qu'elle economise. */
    const seuilLoin = 50;
    const p = camera.position;
    for (const tr of this.troncons) {
      if (!tr) continue;
      const d = Math.hypot(tr.centre.x - p.x, tr.centre.z - p.z);
      const visible = d < portee;
      const detaille = visible && d < seuilLoin;

      if (tr.pres[0].visible !== detaille) {
        for (const m of tr.pres) m.visible = detaille;
      }
      // Le tronc reste dessine dans les deux cas : il est deja minuscule, et
      // sans lui les arbres lointains flottent au-dessus de la neige.
      if (tr.pres[2].visible !== visible) tr.pres[2].visible = visible;

      const grossier = visible && !detaille;
      if (tr.loin[0].visible !== grossier) {
        for (const m of tr.loin) m.visible = grossier;
      }

      /* Seuls les tronçons vraiment proches alimentent la carte d'ombre. Le
         rayon tombe a soixante metres : au-dela l'ombre portee d'un sapin
         couvre moins d'un pixel de la carte, et elle coute pourtant un
         second passage complet de sa geometrie. */
      if (detaille && this.palier.ombres) {
        const ombre = d < 60;
        if (tr.pres[0].castShadow !== ombre) {
          for (const m of tr.pres) m.castShadow = ombre;
        }
      }
    }
  }
}
