/* LE PREMIER PLAN.

   Le plan promettait un « vol entre les troncs ». Il n'y en avait pas.

   La foret garde un couloir de douze metres autour du chemin — a raison :
   un sapin de vingt metres etale ses branches jusque dans l'objectif et
   barre l'image d'une masse noire. Mais la consequence, c'est que RIEN ne
   passait pres de l'objectif. Le fouillis au sol (rochers, souches) est trop
   bas : la camera vole a trois metres, il defile sous elle, hors du cadre.
   L'oeil ne recevait donc aucun repere de vitesse, et un travelling sans
   premier plan ressemble a un glissement sur rail — exactement le contraire
   d'un vol.

   Ce fichier ajoute la couche manquante, en contournant le probleme plutot
   qu'en levant la regle des douze metres :

   · LES FUTS. Des troncs nus, hauts et TRES etroits, plantes a sept ou dix
     metres de l'axe. Sans houppier, ils ne peuvent pas boucher l'image : ils
     la rayent, une fraction de seconde, et cette raie est justement le signal
     de vitesse qui manquait. Ils ont l'ecorce claire du bouleau, qui accroche
     la lune et les detache du fond sombre.

   · LES BRANCHES BASSES. Beaucoup plus rares, elles avancent AU-DESSUS du
     chemin, a quatre metres du sol, chargees de neige. La camera passe
     dessous. C'est le plan de drone par excellence, et il ne coute que
     quelques dizaines de triangles.

   Tout est instancie et suit le vent commun. La parallaxe fait le reste :
   un objet a trois metres de l'objectif se deplace vingt fois plus vite dans
   le cadre qu'un arbre a soixante metres. C'est cette difference, et elle
   seule, qui donne la profondeur.
*/

import * as THREE from 'three';
import { rng } from '../core/noise.js';
import { appliquerVent } from './treeGeometry.js';

/* Un fut de bouleau : un cylindre legerement conique, un peu cintre, avec
   deux ou trois moignons de branches mortes vers le haut.

   Il est normalise a un metre — la matrice d'instance lui donne sa taille —
   et son epaisseur est volontairement independante de sa hauteur, sinon un
   fut de dix-huit metres deviendrait un pilier. */
function geoFut(rand) {
  const parties = [];

  /* Le diametre est le parametre critique, et la premiere version l'avait
     rate : trop fin, un fut ne se lit plus comme un arbre mais comme un mat
     d'antenne — un trait sombre, parfaitement rectiligne, d'un pixel de
     large, qui raye l'image sans jamais lui donner de matiere. Un bouleau
     adulte fait vingt-cinq a quarante centimetres au pied ; c'est cette
     epaisseur-la qu'il faut, et une conicite douce, pas un cornet. */
  const seg = 9;
  const tronc = new THREE.CylinderGeometry(0.020, 0.028, 1.0, seg, 6, true);
  /* Un cintrage doux. Un tronc parfaitement droit se lit comme un poteau ;
     une legere courbure suffit a le rendre vivant, et elle est bien visible
     quand il defile vite au premier plan. */
  const p = tronc.attributes.position;
  const pencheX = (rand() - 0.5) * 0.10;
  const pencheZ = (rand() - 0.5) * 0.10;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) + 0.5;
    const k = y * y;                      // le pied reste plante, la cime derive
    p.setX(i, p.getX(i) + pencheX * k);
    p.setZ(i, p.getZ(i) + pencheZ * k);
  }
  tronc.translate(0, 0.5, 0);
  parties.push(tronc);

  /* Moignons : de courtes branches mortes, orientees au hasard, dans le
     tiers superieur. Elles cassent la verticale sans rien masquer. */
  const nb = 2 + ((rand() * 3) | 0);
  for (let i = 0; i < nb; i++) {
    const y = 0.62 + rand() * 0.33;
    const a = rand() * Math.PI * 2;
    const L = 0.06 + rand() * 0.10;
    const b = new THREE.CylinderGeometry(0.004, 0.010, L, 4, 1, true);
    b.translate(0, L / 2, 0);
    // On la couche vers l'exterieur, legerement relevee.
    b.rotateX(Math.PI / 2 - (0.25 + rand() * 0.5));
    b.rotateY(a);
    b.translate(pencheX * y * y, y, pencheZ * y * y);
    parties.push(b);
  }

  return fusionner(parties);
}

/* Une branche qui avance au-dessus du chemin, et la neige qui la charge.

   La branche part de l'origine et s'etire vers +X en flechissant sous le
   poids : c'est ce flechissement qui fait qu'on la lit comme chargee. La
   neige est une gouttiere posee sur le dessus, decalee d'un cheveu pour ne
   pas se battre avec elle en profondeur. */
function geoBrancheBasse(rand, avecNeige) {
  const parties = [];
  const L = 1.0;
  const pas = 8;
  const fleche = 0.16 + rand() * 0.12;

  const courbe = [];
  for (let i = 0; i <= pas; i++) {
    const t = i / pas;
    courbe.push(new THREE.Vector3(t * L, -fleche * t * t, Math.sin(t * 2.1) * 0.06));
  }
  const chemin = new THREE.CatmullRomCurve3(courbe);
  const tube = new THREE.TubeGeometry(chemin, pas * 2, 0.026, 5, false);
  // La branche s'affine : on retrecit le rayon en fonction de l'abscisse.
  const tp = tube.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i);
    const t = Math.min(1, Math.max(0, x / L));
    const c = chemin.getPoint(t);
    const k = 1 - t * 0.72;
    tp.setY(i, c.y + (tp.getY(i) - c.y) * k);
    tp.setZ(i, c.z + (tp.getZ(i) - c.z) * k);
  }
  tube.computeVertexNormals();
  parties.push(tube);

  /* Quelques ramilles pendantes : sans elles la branche est un tuyau. */
  const nb = 3 + ((rand() * 3) | 0);
  for (let i = 0; i < nb; i++) {
    const t = 0.25 + rand() * 0.65;
    const c = chemin.getPoint(t);
    const l = 0.10 + rand() * 0.16;
    const r = new THREE.CylinderGeometry(0.0018, 0.0055, l, 4, 1, true);
    r.translate(0, -l / 2, 0);
    r.rotateZ((rand() - 0.5) * 0.7);
    r.rotateX((rand() - 0.5) * 0.7);
    r.translate(c.x, c.y, c.z);
    parties.push(r);
  }

  if (!avecNeige) return fusionner(parties);

  /* La neige : une demi-gouttiere posee sur le dessus, interrompue par
     endroits — une couche continue ferait ruban de plastique. */
  const neige = [];
  let t = 0.04;
  while (t < 0.93) {
    const long = 0.10 + rand() * 0.18;
    const a = chemin.getPoint(t);
    const b = chemin.getPoint(Math.min(0.98, t + long));
    const ep = 0.030 * (1 - t * 0.55);
    const cyl = new THREE.CylinderGeometry(ep, ep, a.distanceTo(b), 6, 1, false, 0, Math.PI);
    cyl.rotateZ(-Math.PI / 2);
    cyl.translate((a.x + b.x) / 2, (a.y + b.y) / 2 + 0.010, (a.z + b.z) / 2);
    neige.push(cyl);
    t += long + 0.05 + rand() * 0.12;
  }
  return { bois: fusionner(parties), neige: fusionner(neige) };
}

/* Concatene des geometries en une seule, sans dependre d'un utilitaire
   externe : on ne garde que position et normale, c'est tout ce que le
   materiau consomme ici. */
function fusionner(geos) {
  let n = 0;
  for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    const gp = g.attributes.position.array;
    const gn = g.attributes.normal.array;
    const idx = g.index ? g.index.array : null;
    if (idx) {
      // Deplie l'index : plus simple que de recalculer les decalages.
      for (let i = 0; i < idx.length; i++) {
        const k = idx[i] * 3;
        pos[o] = gp[k]; pos[o + 1] = gp[k + 1]; pos[o + 2] = gp[k + 2];
        nor[o] = gn[k]; nor[o + 1] = gn[k + 1]; nor[o + 2] = gn[k + 2];
        o += 3;
      }
    } else {
      pos.set(gp, o); nor.set(gn, o); o += gp.length;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, o), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, o), 3));
  g.computeBoundingSphere();
  return g;
}

export class PremierPlan {
  constructor(chemin, relief, palier, clairieres, uniformsVent, sapin) {
    this.groupe = new THREE.Group();
    this.groupe.name = 'premierPlan';
    this.chemin = chemin;
    this.troncons = [];
    this.branches = [];

    const rand = rng(778291);

    /* Ecorce claire : c'est elle qui fait le bouleau, et surtout c'est elle
       qui detache le fut sur la foret sombre quand il passe pres de
       l'objectif. Une ecorce brune s'y fondrait et l'effet serait perdu. */
    const matFut = new THREE.MeshStandardMaterial({
      color: 0xC9C6BC, roughness: 0.88, metalness: 0,
    });
    const matBois = new THREE.MeshStandardMaterial({
      color: 0x35291D, roughness: 0.95, metalness: 0,
    });
    const matNeige = new THREE.MeshStandardMaterial({
      color: 0xE8F0F9, roughness: 0.76, metalness: 0, flatShading: true,
    });

    /* Le vent, mais avec retenue. L'amplitude du shader est multipliee par la
       hauteur de l'instance ET par son echelle horizontale : sur des troncs
       de quinze metres, un reglage de sapin faisait fouetter les cimes de
       plusieurs metres. Un tronc de bouleau bouge de quelques dizaines de
       centimetres, pas plus — et vu de pres, l'exageration se remarque
       immediatement. */
    appliquerVent(matFut, { amplitude: 0.16, uniforms: uniformsVent });
    appliquerVent(matBois, { amplitude: 0.30, uniforms: uniformsVent });
    appliquerVent(matNeige, { amplitude: 0.30, uniforms: uniformsVent });

    const budget = palier.nom === 'bas' ? 46 : palier.nom === 'moyen' ? 96 : 150;

    this._semerFuts(rand, relief, clairieres, palier, matFut, budget);
    this._semerBranches(rand, relief, clairieres, palier, matBois, matNeige, sapin);

    this.nb = this.groupe.children.length;
  }

  /* --- les futs ------------------------------------------------------------
     Places par abscisse plutot que par tirage dans le plan : on veut une
     cadence le long du parcours, pas un nuage. L'intervalle est irregulier —
     regulier, il donnerait un effet de poteaux telegraphiques. */
  _semerFuts(rand, relief, clairieres, palier, mat, budget) {
    const L = this.chemin.longueur;
    const p = new THREE.Vector3();
    const c = new THREE.Vector3();
    const liste = [];

    /* On ne plante rien dans les cinquante-cinq premiers metres.

       Le plan d'ouverture est fixe et regarde le chemin dans cet intervalle
       precis. Un fut y tombait en plein milieu du cadre et rayait le titre de
       haut en bas — sur la seule image que toute la famille verra, et la
       seule qu'elle regardera plusieurs dizaines de secondes. Ailleurs un fut
       raye l'image un dixieme de seconde et c'est exactement ce qu'on lui
       demande ; ici il s'installe. */
    let s = 55;
    while (s < L - 12 && liste.length < budget) {
      s += 7 + rand() * 20;

      this.chemin.point(s, p);
      this.chemin.cote(s, c);

      // Un cote ou l'autre, et parfois les deux : c'est l'alternance qui fait
      // la traversee. Toujours le meme cote donnerait une haie.
      const cotes = rand() < 0.26 ? [1, -1] : [rand() < 0.5 ? 1 : -1];
      for (const signe of cotes) {
        /* La distance decide de tout. En deca de sept metres, la camera —
           qui derive jusqu'a cinq metres de l'axe — le traverserait. Au-dela
           de onze, il rejoint la foret et ne raye plus rien. */
        const d0 = signe * (7.0 + rand() * 4.2);

        /* EN BOUQUET, jamais seul. Un bouleau isole au milieu de la neige ne
           se lit pas comme un arbre mais comme un mat : il n'a ni houppier ni
           voisin pour dire ce qu'il est. Par deux ou trois, avec des hauteurs
           differentes, la meme geometrie devient tout de suite un bosquet.
           C'est de loin le reglage qui a le plus change l'aspect. */
        const nb = 1 + ((rand() * rand() * 3.2) | 0);
        for (let k = 0; k < nb; k++) {
          const d = d0 + (rand() - 0.5) * 2.4;
          const le = (rand() - 0.5) * 3.0;
          const x = p.x + c.x * d + (-c.z) * le;
          const z = p.z + c.z * d + (c.x) * le;

          let dansClairiere = false;
          for (const cl of clairieres) {
            if (Math.hypot(x - cl.x, z - cl.z) < cl.r * 1.05) { dansClairiere = true; break; }
          }
          if (dansClairiere) continue;

          liste.push({
            x, y: relief.hauteur(x, z) - 0.1, z, s,
            // Le plus grand du bouquet mene, les autres suivent plus bas.
            /* Plafonnes a treize metres. Plus haut, un fut sans houppier
               depasse la cime des sapins voisins et redevient un mat, meme
               correctement dimensionne : c'est la SILHOUETTE qui trahit, pas
               le diametre. */
            h: (k === 0 ? 9.5 + rand() * 3.5 : 6.0 + rand() * 4.0),
            large: 0.7 + rand() * 0.6,
            rot: rand() * Math.PI * 2,
          });
        }
      }
    }
    if (!liste.length) return;

    /* DECOUPAGE EN TRONCONS.

       Un fut est un objet de PREMIER PLAN : il n'a de sens que lorsqu'il
       passe pres de l'objectif. A quarante metres, sans houppier, il redevient
       exactement ce mat qu'on cherchait a eviter — et la premiere version en
       plantait sur tout le kilometre, si bien que l'horizon se hérissait de
       traits noirs.

       On les range donc par abscisse et on ne dessine que les troncons
       proches. Le brouillard fait le reste : rien n'apparait ni ne disparait
       de facon visible. */
    const geo = geoFut(rand);
    const parTroncon = new Map();
    for (const a of liste) {
      const k = Math.floor(a.s / 45);
      if (!parTroncon.has(k)) parTroncon.set(k, []);
      parTroncon.get(k).push(a);
    }

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const ech = new THREE.Vector3();
    this.troncons = [];

    for (const [k, groupe] of parTroncon) {
      const mesh = new THREE.InstancedMesh(geo, mat, groupe.length);
      for (let i = 0; i < groupe.length; i++) {
        const a = groupe[i];
        e.set((rand() - 0.5) * 0.05, a.rot, (rand() - 0.5) * 0.05);
        q.setFromEuler(e);
        v.set(a.x, a.y, a.z);
        /* L'epaisseur ne suit PAS la hauteur proportionnellement. Un facteur
           constant donnerait soit des baguettes en bas de gamme, soit des
           piliers en haut : elle ne varie donc qu'un peu avec la taille, ce
           qui maintient tous les futs entre vingt et cinquante-cinq
           centimetres de diametre — la fourchette d'un vrai bouleau. */
        const ep = (4.0 + a.h * 0.18) * a.large;
        ech.set(ep, a.h, ep);
        m.compose(v, q, ech);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = false;       // ils rayeraient la neige de bandes noires
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;    // ils sortent souvent du volume englobant
      mesh.visible = false;
      this.groupe.add(mesh);
      const centre = this.chemin.point((k + 0.5) * 45, new THREE.Vector3());
      this.troncons.push({ mesh, centre });
    }
    this.futs = this.troncons[0]?.mesh || null;
    this.nbFuts = liste.length;
  }

  /* Ne garde a l'ecran que ce qui sert vraiment de premier plan. */
  maj(camera) {
    const p = camera.position;
    for (const tr of this.troncons || []) {
      const d = Math.hypot(tr.centre.x - p.x, tr.centre.z - p.z);
      /* Cinquante-cinq metres : au-dela, un fut ne mesure plus que deux
         pixels de large et redevient le trait sombre qu'on voulait eviter.
         Le brouillard, deja a un tiers a cette distance, couvre l'apparition
         — et de toute facon deux pixels qui s'allument au bord du champ ne se
         remarquent pas en mouvement. */
      const vu = d < 55;
      if (tr.mesh.visible !== vu) tr.mesh.visible = vu;
    }
    for (const b of this.branches || []) {
      const d = Math.hypot(b.position.x - p.x, b.position.z - p.z);
      const vu = d < 95;
      if (b.visible !== vu) b.visible = vu;
    }
  }

  /* --- les branches basses -------------------------------------------------
     Rares par principe : passer sous une branche est un evenement. Une tous
     les quarante metres environ, jamais deux de suite du meme cote.

     La premiere version plantait un poteau nu et lui vissait une barre en
     travers : de loin, c'etait un poteau telegraphique, et rien n'evoquait
     moins une foret. La branche doit APPARTENIR A UN ARBRE. On plante donc
     un vrai conifere — la meme silhouette que toute la foret — et la branche
     en sort. Il est volontairement petit : un grand etalerait ses propres
     branches jusque dans l'objectif, ce que la regle des douze metres existe
     precisement pour empecher. */
  _semerBranches(rand, relief, clairieres, palier, matBois, matNeige, sapin) {
    const L = this.chemin.longueur;
    const p = new THREE.Vector3();
    const c = new THREE.Vector3();
    const tan = new THREE.Vector3();

    let s = 26;
    let dernier = 0;
    const bois = [];
    const neiges = [];

    while (s < L - 20) {
      s += 30 + rand() * 34;
      this.chemin.point(s, p);
      this.chemin.cote(s, c);
      this.chemin.tangente(s, tan);

      const signe = dernier === 1 ? -1 : dernier === -1 ? 1 : (rand() < 0.5 ? 1 : -1);
      dernier = signe;

      /* L'arbre porteur se tient a bonne distance ; c'est la LONGUEUR de la
         branche qui vient chercher le chemin, pas la position de l'arbre.
         C'est ce qui permet de garder son houppier hors du cadre. */
      const base = signe * (9.5 + rand() * 2.5);
      const x = p.x + c.x * base;
      const z = p.z + c.z * base;

      let dansClairiere = false;
      for (const cl of clairieres) {
        if (Math.hypot(x - cl.x, z - cl.z) < cl.r * 1.15) { dansClairiere = true; break; }
      }
      if (dansClairiere) continue;

      const sol = relief.hauteur(x, z);

      /* L'arbre porteur : un jeune conifere de sept a neuf metres. A cette
         taille son envergure ne depasse pas deux metres cinquante, donc il
         reste a sept metres de l'axe — hors d'atteinte de la camera, qui
         derive jusqu'a cinq. */
      if (sapin) {
        const hs = 7 + rand() * 2.2;
        const large = 0.78 + rand() * 0.18;
        for (const [geo, mat] of [[sapin.modele.feuillage, sapin.matFeuillage],
                                  [sapin.modele.neige, sapin.matNeige]]) {
          const o = new THREE.Mesh(geo, mat);
          o.position.set(x, sol - 0.15, z);
          o.scale.set(hs * large, hs, hs * large);
          o.rotation.y = rand() * Math.PI * 2;
          o.castShadow = false;
          o.visible = false;
          this.groupe.add(o);
          this.branches.push(o);
        }
      }

      /* Hauteur de la branche : la camera croise entre 2,3 et 3,5 m. On part
         a 4,6 m et la fleche fait descendre la pointe vers 3,6 m — assez bas
         pour qu'on la sente passer, assez haut pour qu'on passe. */
      const y = sol + 4.6 + rand() * 0.8;
      const L2 = 8.5 + rand() * 3.0;

      const g = geoBrancheBasse(rand, true);
      const angle = Math.atan2(-c.x * signe, -c.z * signe);

      const poser = (geo, cible) => {
        const o = new THREE.Mesh(geo, cible === bois ? matBois : matNeige);
        o.position.set(x, y, z);
        // La branche pointe vers +X une fois generee : on la fait viser le
        // chemin, avec un leger devers pour qu'elle ne soit pas horizontale.
        o.rotation.set(0, angle + Math.PI / 2, 0);
        o.scale.setScalar(L2);
        // Un devers franc plutot qu'un frisson : une branche rigoureusement
        // horizontale se lit comme une piece de charpente.
        o.rotateZ(-0.10 - rand() * 0.16);
        o.castShadow = false;
        o.frustumCulled = false;
        o.visible = false;
        cible.push(o);
        this.branches.push(o);
        this.groupe.add(o);
      };
      poser(g.bois, bois);
      poser(g.neige, neiges);
    }
  }
}
