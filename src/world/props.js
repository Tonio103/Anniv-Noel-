/* Ce qui traine au sol.

   La neige etait impeccable et parfaitement vide, et c'est precisement ce qui
   la trahissait : une vraie foret est encombree. Des rochers affleurent, des
   souches restent d'anciennes coupes, des troncs pourrissent en travers, des
   buissons secs percent la croute. Sans eux, le sol est une nappe et l'oeil
   n'a aucun repere d'echelle entre le cerf et les arbres.

   Quatre familles, toutes instanciees et semees par rejet le long du chemin,
   avec les memes regles que la foret : jamais dans le couloir de marche,
   jamais dans une clairiere, densite croissante a mesure qu'on s'enfonce.

   Chaque objet pose au sol porte sa propre NEIGE, en geometrie separee et
   blanche. C'est ce qui les integre au paysage : un rocher gris pose sur de
   la neige a l'air d'un decor rapporte ; le meme rocher coiffe de blanc
   appartient a l'hiver.
*/

import * as THREE from 'three';
import { rng } from '../core/noise.js';

/* Bruite une geometrie : deplace chaque sommet le long de sa normale. C'est
   ce qui distingue un rocher d'un ballon a facettes. */
function bosseler(geo, rand, force) {
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const k = 1 + (rand() - 0.5) * force;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return geo;
}

/* --------------------------------------------------------------------------
   Les geometries de base. Une seule de chaque : c'est la matrice d'instance
   qui les varie en taille, en aplatissement et en orientation.
   -------------------------------------------------------------------------- */
function geoRocher(rand, detail) {
  const g = new THREE.IcosahedronGeometry(0.5, detail);
  bosseler(g, rand, 0.55);
  // Aplati : un rocher affleurant est plus large que haut.
  g.scale(1, 0.62, 1);
  return g;
}

/* Calotte de neige d'un rocher : LA MEME FORME, gonflee, dont on ne garde que
   le dessus.

   « La meme » est ici une condition, pas une commodite. La calotte etait
   regeneree a partir d'un icosaedre neuf, bosselee par un autre tirage
   aleatoire et six pour cent plus grosse. Or les bosses vont jusqu'a vingt
   pour cent : deux surfaces bosselees independamment s'entrecroisent, et le
   rocher ressortait a travers sa propre neige presque partout. Resultat, des
   cailloux nus sur un tapis blanc — le defaut exact que le commentaire d'en
   tete promet d'eviter.

   En partant de la geometrie deja bosselee et en la dilatant, la calotte
   ENVELOPPE le rocher par construction, quel que soit le tirage. */
function geoNeigeRocher(base) {
  const g = base.clone();
  g.scale(1.16, 1.16, 1.16);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    // Tout ce qui est sous l'equateur est ramene au niveau du bord : il ne
    // reste qu'une coiffe posee dessus.
    if (p.getY(i) < 0.04) p.setY(i, 0.04);
  }
  g.computeVertexNormals();
  return g;
}

function geoSouche(rand) {
  const g = new THREE.CylinderGeometry(0.34, 0.44, 1, 9, 1, false);
  bosseler(g, rand, 0.16);
  g.translate(0, 0.5, 0);
  return g;
}

/* Le chapeau de neige d'une souche.

   Les souches etaient la seule famille declaree sans neige (`neige: null`), et
   c'est justement celle qui en porte le plus dans la nature : une section de
   coupe est horizontale, large et rugueuse, donc elle retient tout ce qui
   tombe. Sans ce disque blanc, on lisait des tambours sombres poses sur la
   neige — les taches noires du bas de cadre venaient en bonne partie de la.

   Un galet aplati, deborde d'un centimetre ou deux, et legerement bombe : la
   neige ne se pose pas a plat, elle s'amoncelle au milieu. */
function geoNeigeSouche(rand) {
  const g = new THREE.SphereGeometry(0.47, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
  bosseler(g, rand, 0.14);
  g.scale(1, 0.34, 1);
  g.translate(0, 0.97, 0);
  return g;
}

/* Tronc couche. FERME AUX DEUX BOUTS : il etait ouvert, et un tube ouvert vu
   par l'extremite n'est pas un tronc, c'est un trou. Quand le hasard orientait
   le tronc vers la camera, on regardait droit dans le vide — la face interne
   opposee etant elle-meme eliminee par le tri des faces arriere, il ne restait
   qu'un morceau de paroi, cette forme plate et anguleuse posee sur la neige
   qu'on ne pouvait rattacher a rien. Un tronc scie a deux sections ; elles ne
   coutent que douze triangles et elles rendent l'objet lisible. */
function geoTronc(rand) {
  const g = new THREE.CylinderGeometry(0.26, 0.33, 1, 8, 1, false);
  bosseler(g, rand, 0.14);
  g.rotateZ(Math.PI / 2);        // couche
  return g;
}

/* Neige accumulee sur un tronc couche : une demi-gouttiere posee dessus.

   ELLE ETAIT SUR LE FLANC. Le demi-cylindre couvre la moitie +X du modele ;
   apres rotateZ(+90°) cette moitie passe bien sur le dessus, ou elle doit
   rester. Le rotateX(-90°) qui suivait la faisait basculer vers -Z, c'est-a-
   dire contre le cote du tronc, la ou elle est invisible depuis le dessus. Les
   troncs couches n'avaient donc jamais de neige, alors que la geometrie
   existait et etait bien dessinee.

   Le bosselage est aussi divise par deux : comme pour les rochers, la
   gouttiere doit rester A L'EXTERIEUR du tronc, et deux bruits independants
   sur des rayons voisins se traversent. */
function geoNeigeTronc(rand) {
  /* Juste assez large pour couvrir sans deborder, et un peu moins d'un
     demi-tour : a PI pile, la gouttiere descendait jusqu'a l'equateur du
     tronc et, etant plus grosse que lui, elle depassait sur les cotes — le
     tronc disparaissait dans un fourreau blanc, comme un tapis roule. La
     neige doit se poser SUR le dos du tronc et s'arreter avant les flancs.
     Raccourcie aussi de six pour cent, pour que les deux bouts scies
     ressortent de dessous. */
  const g = new THREE.CylinderGeometry(0.285, 0.355, 0.94, 8, 1, true,
                                       Math.PI * 0.10, Math.PI * 0.80);
  bosseler(g, rand, 0.07);
  g.rotateZ(Math.PI / 2);
  return g;
}

/* Buisson sec : quelques brindilles divergentes. On ne cherche pas le detail,
   seulement une silhouette griffue qui accroche la lumiere rasante. */
/* Buisson sec.

   IL RESSEMBLAIT A UNE ARAIGNEE. Sept brindilles epaisses partant TOUTES du
   meme point, reparties a intervalles reguliers autour du cercle et montant
   droit : ce n'est pas un buisson, c'est un cric. La regularite se voyait
   immediatement, et le depart unique donnait ce corps central compact d'ou
   sortaient des pattes.

   Un vrai buisson sec part de plusieurs souches voisines, ses tiges se
   courbent en s'elevant, et leurs longueurs n'ont rien de commun. Chaque
   brindille est donc tracee en trois segments qui s'inclinent
   progressivement, depuis une base dispersee. Elles sont aussi deux fois plus
   fines : a vingt metres, une brindille de deux centimetres et demi est un
   trait noir, alors qu'a un centimetre elle se fond en gris. */
function geoBuisson(rand) {
  const pos = [], nor = [];
  const nb = 13;
  for (let i = 0; i < nb; i++) {
    // Base dispersee : plusieurs departs, pas un moyeu unique.
    const ab = rand() * Math.PI * 2;
    const rb = Math.sqrt(rand()) * 0.16;
    const bx = Math.cos(ab) * rb, bz = Math.sin(ab) * rb;

    const a = rand() * Math.PI * 2;
    const h = 0.34 + rand() * 0.72;
    const ep = 0.006 + rand() * 0.007;
    // La tige s'ecarte de plus en plus de la verticale en montant.
    const ouvre = 0.20 + rand() * 0.55;

    const SEG = 3;
    for (const perp of [[1, 0], [0, 1]]) {
      const ox = perp[0] * ep, oz = perp[1] * ep;
      let px = bx, py = 0, pz = bz;
      for (let s = 0; s < SEG; s++) {
        const t0 = s / SEG, t1 = (s + 1) / SEG;
        const et = ep * (1 - t1 * 0.7);          // la tige s'affine vers le haut
        const nx = bx + Math.cos(a) * ouvre * h * t1 * t1;
        const ny = h * t1;
        const nz = bz + Math.sin(a) * ouvre * h * t1 * t1;
        const e0 = ep * (1 - t0 * 0.7);
        const q = [
          [px - perp[0] * e0, py, pz - perp[1] * e0],
          [px + perp[0] * e0, py, pz + perp[1] * e0],
          [nx + perp[0] * et, ny, nz + perp[1] * et],
          [nx - perp[0] * et, ny, nz - perp[1] * et],
        ];
        for (const [i0, i1, i2] of [[0, 1, 2], [0, 2, 3]]) {
          for (const k of [i0, i1, i2]) {
            pos.push(q[k][0], q[k][1], q[k][2]);
            // Normale vers le haut : une brindille n'a pas de face, elle
            // accroche la lumiere du ciel comme du feuillage.
            nor.push(0, 1, 0);
          }
        }
        px = nx; py = ny; pz = nz;
        void ox; void oz;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.computeBoundingSphere();
  return g;
}

/* ========================================================================== */
export class Fouillis {
  constructor(chemin, relief, palier, clairieres) {
    this.groupe = new THREE.Group();
    this.groupe.name = 'fouillis';
    this.palier = palier;

    const rand = rng(31415);
    const detail = palier.nom === 'bas' ? 0 : 1;

    /* TOUT EST ENTOURE DE NEIGE, DONC RIEN N'EST AUSSI SOMBRE QU'ON CROIT.

       Ces albedos avaient ete choisis comme on choisit une couleur de bois ou
       de pierre en plein jour : 0x2A2018, c'est du brou de noix. Pose au
       milieu d'un champ qui renvoie quatre-vingts pour cent de la lumiere, et
       sous une lune faible, il ne reste rien — les souches et les buissons
       sortaient en decoupes noires, comme des griffonnages a l'encre sur la
       neige. Le rebond du sol (voir sky.js) rattrape une partie du probleme,
       mais pas si la matiere elle-meme ne renvoie presque rien.

       Les valeurs sont donc nettement plus claires que la couleur « vraie »
       de l'objet. Ce n'est pas une triche : ce qu'on regarde, ce n'est jamais
       l'albedo, c'est ce qui en sort. */
    const matRoche = new THREE.MeshStandardMaterial({
      color: 0x6C717A, roughness: 0.95, metalness: 0, flatShading: true,
    });
    const matBois = new THREE.MeshStandardMaterial({
      color: 0x53412F, roughness: 0.96, metalness: 0,
    });
    const matBrindille = new THREE.MeshStandardMaterial({
      color: 0x6B5840, roughness: 0.95, metalness: 0,
      side: THREE.DoubleSide,
    });
    const matNeige = new THREE.MeshStandardMaterial({
      color: 0xE6EEF8, roughness: 0.78, metalness: 0, flatShading: true,
    });

    /* Budget : le fouillis doit rester un assaisonnement. Trop d'objets et
       on ne voit plus la neige, qui est pourtant le sujet. */
    /* LE SOL ETAIT VIDE. Deux cent quatre-vingts objets repartis sur plus de
       sept cents metres de couloir, c'est un objet tous les deux metres et
       demi de parcours — donc rien du tout dans un cadre donne. Le fouillis
       etait pense comme un assaisonnement ; il faut qu'il devienne un
       sous-bois. On triple, et on autorise ces objets bien plus pres du
       passage : ce sont eux qui donnent au sol son echelle et qui empechent
       la neige d'etre une nappe. */
    /* Le palier bas n'avait que 320 objets sur sept cents metres de couloir.
       C'est un objet tous les deux metres, donc rien du tout dans un cadre —
       et c'est le palier que voit un telephone, c'est-a-dire le seul qui
       compte. En portrait, la moitie basse de l'ecran est du sol : si rien
       n'y traine, on regarde un drap. On le remonte franchement ; ce sont de
       petits objets instancies, ils coutent surtout des appels de dessin,
       deja groupes par famille. */
    const budget = palier.nom === 'bas' ? 760 : palier.nom === 'moyen' ? 1000 : 1400;

    const semis = this._semer(rand, chemin, relief, clairieres, budget);

    const geoRoc = geoRocher(rand, detail);
    const familles = [
      { clef: 'rocher', geo: geoRoc, mat: matRoche,
        neige: geoNeigeRocher(geoRoc) },
      { clef: 'souche', geo: geoSouche(rand), mat: matBois,
        neige: geoNeigeSouche(rand) },
      { clef: 'tronc', geo: geoTronc(rand), mat: matBois,
        neige: geoNeigeTronc(rand) },
      { clef: 'buisson', geo: geoBuisson(rand), mat: matBrindille, neige: null },
    ];

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const ech = new THREE.Vector3();
    const teinte = new THREE.Color();

    this.nb = 0;
    for (const f of familles) {
      const liste = semis.filter((o) => o.type === f.clef);
      if (!liste.length) continue;
      this.nb += liste.length;

      const mesh = new THREE.InstancedMesh(f.geo, f.mat, liste.length);
      const coiffe = f.neige
        ? new THREE.InstancedMesh(f.neige, matNeige, liste.length) : null;

      for (let i = 0; i < liste.length; i++) {
        const o = liste[i];
        e.set(o.penche, o.rot, o.roule);
        q.setFromEuler(e);
        v.set(o.x, o.y, o.z);
        ech.set(o.sx, o.sy, o.sz);
        m.compose(v, q, ech);
        mesh.setMatrixAt(i, m);
        if (coiffe) coiffe.setMatrixAt(i, m);

        /* Variation de teinte : sans elle, tous les rochers sont freres.

           UNE COULEUR D'INSTANCE MULTIPLIE, ELLE NE REMPLACE PAS. Celle-ci
           etait construite comme une couleur de pierre — teinte froide,
           clarte 0,24 a 0,40 — alors qu'elle vient s'appliquer PAR-DESSUS le
           gris du materiau. Le produit tombait a un demi pour cent de
           reflectance : rochers, souches et buissons se posaient sur la neige
           en decoupes parfaitement noires, comme des trous perces dans le sol.
           C'etait la chose la plus laide du cadre, et elle venait d'une
           multiplication passee pour un remplacement.

           Le multiplicateur tourne donc autour de 1, et ne fait plus que ce
           qu'on lui demandait : eviter que deux rochers voisins soient
           identiques. Il est ecrit en RGB lineaire — setRGB travaille
           directement dans l'espace de travail — pour qu'on lise la valeur
           neutre a l'oeil dans le code. */
        const k = 0.80 + o.t * 0.40;
        teinte.setRGB(k * 0.97, k, k * 1.06);
        mesh.setColorAt(i, teinte);
      }

      for (const im of [mesh, coiffe]) {
        if (!im) continue;
        im.instanceMatrix.needsUpdate = true;
        im.castShadow = palier.ombres;
        im.receiveShadow = palier.ombres;
        im.computeBoundingSphere();
        this.groupe.add(im);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  _semer(rand, chemin, relief, clairieres, budget) {
    const em = relief.emprise;
    const out = [];
    let essais = 0;

    while (out.length < budget && essais < budget * 40) {
      essais++;
      const x = em.xmin + rand() * (em.xmax - em.xmin);
      const z = em.zmin + rand() * (em.zmax - em.zmin);

      const pr = chemin.proximite(x, z);
      // On ne peuple que ce qui sera reellement vu.
      if (pr.d > 70) continue;
      // Le couloir reste degage, mais moins large que pour les arbres : un
      // rocher au bord du passage est justement ce qu'on veut voir defiler.
      /* On les laisse venir jusqu'au bord du passage. Un caillou ou une
         touffe a un metre du chemin ne gene personne — le cerf marche au
         milieu — et c'est precisement la, au premier plan, qu'ils comptent. */
      if (pr.d < 1.6) continue;

      let dansClairiere = false;
      for (const c of clairieres) {
        if (Math.hypot(x - c.x, z - c.z) < c.r * 0.85) { dansClairiere = true; break; }
      }
      if (dansClairiere) continue;

      const avancee = pr.s / chemin.longueur;
      if (rand() > 0.35 + avancee * 0.5) continue;

      const y = relief.hauteur(x, z);
      const r = rand();
      let type, sx, sy, sz, penche = 0, roule = 0;

      if (r < 0.46) {
        /* Rocher : enfonce dans la neige, donc on le descend d'une bonne
           part de sa hauteur. Un rocher pose dessus flotte. */
        type = 'rocher';
        const t = 0.6 + rand() * 2.4;
        sx = t * (0.8 + rand() * 0.5); sy = t * (0.5 + rand() * 0.4); sz = t * (0.8 + rand() * 0.5);
        penche = (rand() - 0.5) * 0.3;
        roule = (rand() - 0.5) * 0.3;
      } else if (r < 0.64) {
        type = 'souche';
        const t = 0.45 + rand() * 0.55;
        sx = t; sz = t; sy = t * (0.5 + rand() * 0.9);
        penche = (rand() - 0.5) * 0.16;
      } else if (r < 0.80) {
        type = 'tronc';
        const lg = 2.4 + rand() * 4.5;
        sx = lg; sy = 0.5 + rand() * 0.45; sz = 0.5 + rand() * 0.45;
        roule = (rand() - 0.5) * 0.25;
      } else {
        type = 'buisson';
        const t = 0.6 + rand() * 1.1;
        sx = t; sy = t * (0.7 + rand() * 0.7); sz = t;
      }

      out.push({
        type, x, z, sx, sy, sz, penche, roule,
        rot: rand() * Math.PI * 2,
        t: rand(),
        // Enfoncement : chaque famille s'assoit differemment dans la neige.
        y: y - (type === 'rocher' ? sy * 0.42
              : type === 'tronc' ? sz * 0.30
              : type === 'souche' ? 0.10 : 0.06),
      });
    }
    return out;
  }
}
