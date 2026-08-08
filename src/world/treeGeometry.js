/* Fabrication d'un sapin.

   Ce qui fait qu'un conifere est reconnaissable, ce n'est pas le detail des
   aiguilles — a vingt metres et dans la brume, personne ne les voit — c'est
   sa SILHOUETTE. Un cone lisse fait tout de suite "objet 3D" ; il faut que
   le bord soit dechiquete et que les etages se chevauchent irregulierement.

   On empile donc des etages de branches dont le rayon est bruite angle par
   angle, et on pose par-dessus des calottes de neige legerement plus petites.
   Trois geometries en sortent (tronc, feuillage, neige), chacune destinee a
   son propre rendu instancie : trois appels de dessin pour toute la foret.

   Le sapin est normalise — un metre de haut, base a l'origine — et c'est la
   matrice d'instance qui lui donne sa taille reelle. */

import * as THREE from 'three';

/* UNE BRANCHE A DU VOLUME, OU L'ARBRE EST EN CARTON.

   J'ai longtemps cru que le probleme etait la continuite des etages, et j'ai
   remplace la jupe pleine par un anneau de branches separees. C'etait
   necessaire — il faut des trous pour voir a travers — mais ce n'etait pas
   suffisant, et sur un telephone le resultat restait exactement ce qu'Antoine
   decrit : des triangles plats empiles.

   La raison est simple et je l'avais ecartee a tort : CHAQUE BRANCHE ETAIT UN
   QUADRILATERE PLAT. Une lame unique, contenue dans un plan. Vue de face elle
   remplit ; vue de chant elle disparait ; et comme toutes les lames d'un
   etage sont a peu pres horizontales, on les voit toutes de face en meme
   temps depuis le sol. L'oeil recoit une collection de plaques coplanaires —
   il en conclut du carton, et il a raison.

   Deux choses, ensemble, donnent le volume :

   1. DES LAMES CROISEES. Chaque branche porte maintenant deux lames sur la
      meme nervure : une a plat, une debout. Sous n'importe quel angle, l'une
      des deux se presente de face. C'est exactement ce qu'Antoine proposait,
      et c'est la solution standard pour du feuillage a bas cout.

   2. DES NORMALES DE COQUE. Meme croisees, deux lames eclairees par leur
      normale geometrique se lisent comme deux plaques : chacune a une teinte
      uniforme et la cassure entre elles se voit. On leur donne donc la
      normale qu'aurait la MASSE d'aiguilles a cet endroit — vers l'exterieur
      de l'arbre et vers le haut, arrondie sur la largeur de la lame. Les
      lames cessent alors d'exister individuellement : elles s'eclairent
      comme les faces d'un meme volume. C'est ce terme, plus encore que le
      croisement, qui fait disparaitre l'aspect decoupe.

   Le cout est d'a peu pres 1,7 fois plus de triangles pour le feuillage
   proche. La version lointaine, elle, garde une seule lame : a quarante
   metres un sapin fait trente pixels et le croisement ne se voit plus. */
function pousserBranche(pos, nor, col, o) {
  const {
    azimut, y0, rBase, longueur, chute, releve, demiLarge,
    segments, sombre, clair, croisee, neige, rand, plein = false,
  } = o;

  const ca = Math.cos(azimut), sa = Math.sin(azimut);
  // Repere local : le long de la branche, en travers, et la verticale.
  const tx = ca, tz = sa;              // direction radiale (horizontale)
  const ux = -sa, uz = ca;             // en travers, horizontale

  /* Nervure : la branche part du tronc, retombe, et sa pointe se releve.
     Ce redressement final est la signature de l'epicea. */
  const N = segments + 1;
  const px = [], py = [], pz = [], pw = [];
  for (let s = 0; s < N; s++) {
    const u = s / segments;
    const r = rBase + (longueur - rBase) * u;
    px.push(tx * r);
    py.push(y0 - chute * u * u + releve * u * u * u);
    pz.push(tz * r);
    /* Profil de largeur. De pres : etroit au depart, plein au milieu, pointe
       fermee — c'est le dessin d'une vraie branche.

       De loin (`plein`), la lame reste LARGE JUSQU'AU BOUT. Une branche qui
       s'effile en pointe donne une silhouette en etoile : le contour de
       l'arbre n'est plus fait que des pointes, et entre elles on voit le
       ciel. C'est exactement l'arete de poisson qu'on lisait au fond des
       plans. A cette distance on ne regarde plus une branche, on regarde une
       masse : il faut donc un eventail qui remplit, pas une aiguille. */
    pw.push(demiLarge * (plein
      ? 0.30 + 0.70 * Math.sin(Math.PI * (0.30 + 0.62 * u))
      : Math.sin(Math.PI * (0.13 + 0.87 * u))));
  }

  // Normale de coque : vers l'exterieur et vers le haut.
  const ox = tx * 0.62, oy = 0.78, oz = tz * 0.62;

  /* Une lame : ruban effile suivant la nervure, dont la largeur se developpe
     selon `ax`. `arrondi` incline la normale sur les bords, ce qui donne a la
     lame la rondeur d'une masse au lieu du plat d'une planche. */
  const lame = (axx, axy, axz, facteur, teinteBas, arrondi) => {
    for (let s = 0; s < segments; s++) {
      const u0 = s / segments, u1 = (s + 1) / segments;
      const w0 = pw[s] * facteur, w1 = pw[s + 1] * facteur;
      const k0 = sombre + (clair - sombre) * u0;
      const k1 = sombre + (clair - sombre) * u1;

      const S = [
        [px[s] - axx * w0, py[s] - axy * w0, pz[s] - axz * w0, -1, k0 * teinteBas],
        [px[s] + axx * w0, py[s] + axy * w0, pz[s] + axz * w0, +1, k0],
        [px[s + 1] + axx * w1, py[s + 1] + axy * w1, pz[s + 1] + axz * w1, +1, k1],
        [px[s + 1] - axx * w1, py[s + 1] - axy * w1, pz[s + 1] - axz * w1, -1, k1 * teinteBas],
      ];
      for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
        for (const i of [a, b, c]) {
          const v = S[i];
          pos.push(v[0], v[1], v[2]);
          let nx = ox + axx * v[3] * arrondi;
          let ny = oy + axy * v[3] * arrondi;
          let nz = oz + axz * v[3] * arrondi;
          const l = Math.hypot(nx, ny, nz) || 1;
          nor.push(nx / l, ny / l, nz / l);
          col.push(v[4], v[4], v[4]);
        }
      }
    }
  };

  // Lame a plat : la nappe d'aiguilles, celle qu'on voit d'en haut.
  lame(ux, 0, uz, 1, 1, 0.52);
  // Lame debout : celle qui existe encore quand la premiere est de chant.
  if (croisee) lame(0, 1, 0, 0.66, 0.72, 0.40);

  /* La neige tient sur le DESSUS de la branche, pas autour. Une seule lame,
     un peu plus courte et plus etroite, posee juste au-dessus de la nervure.
     Comme elle suit la meme nervure, elle ne peut plus former ces longues
     echardes blanches qui sortaient de l'arbre quand elle avait sa propre
     silhouette dechiquetee. */
  if (neige) {
    const { pos: nP, nor: nN, col: nC } = neige;
    /* ELLE NE COUVRE PAS TOUTE LA BRANCHE.

       Dessinee sur toute la nervure et aux trois quarts de la largeur, la
       neige reprenait exactement la forme de la branche : on obtenait une
       deuxieme serie de triangles, clairs, superposes aux premiers. D'ou ces
       eclats bleutes en plaques qui donnaient a l'arbre un air de verre
       brise.

       La neige tient en realite sur la PARTIE MEDIANE de la branche : elle
       glisse pres du tronc, ou la pente est forte, et tombe de la pointe, qui
       plie sous elle. On la reduit donc a un bourrelet etroit sur le tiers
       central, et elle se lit enfin comme une charge posee, pas comme une
       ecaille. */
    const uA = 0.30, uB = 0.86;
    const le = (u) => {
      const s = u * segments;
      const i = Math.min(segments - 1, Math.floor(s));
      const f = s - i;
      return [
        px[i] + (px[i + 1] - px[i]) * f,
        py[i] + (py[i + 1] - py[i]) * f,
        pz[i] + (pz[i + 1] - pz[i]) * f,
        (pw[i] + (pw[i + 1] - pw[i]) * f) * 0.42,
      ];
    };
    const PAS = 2;
    for (let s = 0; s < PAS; s++) {
      const u0 = uA + (uB - uA) * (s / PAS);
      const u1 = uA + (uB - uA) * ((s + 1) / PAS);
      const A = le(u0), B = le(u1);
      // Bourrelet : plein au milieu du troncon, effile aux deux bouts.
      const g0 = A[3] * Math.sin(Math.PI * (0.18 + 0.82 * (s / PAS)));
      const g1 = B[3] * Math.sin(Math.PI * (0.18 + 0.82 * ((s + 1) / PAS)));
      const h0 = g0 * 0.55 + 0.0012, h1 = g1 * 0.55 + 0.0012;
      const k0 = 0.86 + 0.14 * (s / PAS), k1 = 0.86 + 0.14 * ((s + 1) / PAS);
      const S = [
        [A[0] - ux * g0, A[1] + h0, A[2] - uz * g0, -1, k0],
        [A[0] + ux * g0, A[1] + h0, A[2] + uz * g0, +1, k0],
        [B[0] + ux * g1, B[1] + h1, B[2] + uz * g1, +1, k1],
        [B[0] - ux * g1, B[1] + h1, B[2] - uz * g1, -1, k1],
      ];
      for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
        for (const i of [a, b, c]) {
          const v = S[i];
          nP.push(v[0], v[1], v[2]);
          const nx = ux * v[3] * 0.42, ny = 1, nz = uz * v[3] * 0.42;
          const l = Math.hypot(nx, ny, nz);
          nN.push(nx / l, ny / l, nz / l);
          nC.push(v[4], v[4], v[4]);
        }
      }
    }
  }
  void rand;
}

/* Concatene des geometries indexees ou non en une seule, sans index. On ne
   garde que position et normale : le materiau du tronc ne consomme rien
   d'autre. */
function fusionnerGeos(geos) {
  let n = 0;
  for (const g of geos) n += g.index ? g.index.count : g.attributes.position.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    const gp = g.attributes.position.array;
    const gn = g.attributes.normal.array;
    const idx = g.index ? g.index.array : null;
    if (idx) {
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

function versGeometrie(pos, nor, col) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

/* `simple` : version pour le lointain. Les branches separees coutent trois
   triangles chacune au lieu d'un — c'est ce qui leur donne leur volume, et
   c'est aussi ce qui a fait passer la scene de 395 000 a 875 000 triangles
   quand je les ai introduites. Or ce volume ne sert a rien au-dela de
   cinquante metres : a cette distance un arbre fait trente pixels, on ne
   distingue plus une branche d'une autre, et seule la silhouette compte.

   La version simple retire donc le relevement de pointe (un triangle sur
   trois) et divise le nombre d'etages. Elle garde exactement la meme
   enveloppe, donc la bascule reste invisible. */
export function genererSapin(rand, detail = 6, simple = false, fond = false) {
  /* BEAUCOUP DE BRANCHES ETROITES, PAS QUELQUES-UNES LARGES.

     Avec sept branches par etage et une demi-largeur du quart de leur
     longueur, chaque branche couvrait un secteur de quarante degres : ce
     n'est plus une branche, c'est une fleche en papier. On voyait l'arbre
     comme un empilement de grands triangles — le defaut d'origine, deplace
     mais pas resolu.

     Une branche d'epicea est LONGUE ET FINE. En doublant leur nombre et en
     divisant leur largeur par deux, chacune redevient une branche, et c'est
     leur SUPERPOSITION qui fait la masse — ce qui est aussi la facon dont un
     vrai houppier se remplit. */
  /* LA VERSION LOINTAINE NE DOIT PAS PERDRE SON VOLUME.

     Elle avait neuf branches TRES LARGES sur sept etages, sans lame croisee :
     autrement dit sept disques quasi pleins empiles. C'est litteralement un
     empilement de triangles plats, et comme la bascule se faisait a
     vingt-sept metres, sur un telephone c'etait presque toute la foret.
     Antoine voyait donc des sapins en carton — pas par accident de rendu,
     mais parce que c'est exactement ce qu'on lui envoyait.

     Le bon compromis n'est pas d'elargir les lames jusqu'a fermer l'anneau
     (ce qui donne le disque), c'est de garder des branches FINES et le
     CROISEMENT — les deux choses qui font le volume — et d'economiser
     ailleurs : moins d'etages, moins de branches par etage, une seule section
     par nervure. Un sapin lointain coute alors trois fois plus qu'avant, mais
     il ressemble encore a un sapin, et on peut reculer la bascule assez loin
     pour que personne ne la voie. */
  /* « ILS SONT TOUS MAIGRES. » Oui, et le compte le dit sans ambiguite : au
     palier bas, un sapin PROCHE avait sept branches par etage sur dix etages,
     soit soixante-dix rameaux pour tout un arbre de vingt metres. Un vrai
     epicea en porte des centaines. Aucune finesse de lame ne rattrape ca : la
     masse d'un conifere ne vient pas de la taille de ses branches, elle vient
     de leur RECOUVREMENT. Sept branches ne se recouvrent nulle part, donc on
     voit le ciel entre elles partout, et l'arbre se lit comme une arete.

     Le nombre par etage double, et on ajoute des etages. C'est le seul levier
     qui produise de la densite ; elargir les lames, que j'avais essaye, ne
     fait que passer de « maigre » a « decoupe dans du carton ». */
  const parEtage = fond ? 6 : simple ? 11 : Math.max(13, Math.round(detail * 2.6));
  const couches = fond ? 5 : simple ? 8 : (detail >= 6 ? 16 : 14);
  // Segments le long de la nervure : c'est eux qui donnent sa courbure a la
  // branche. Au loin, une branche droite suffit largement.
  /* OU L'ON RECUPERE CE QUE LA DENSITE COUTE.

     Doubler le nombre de branches double le nombre de triangles ; il faut
     donc le reprendre ailleurs, et le bon endroit est la COURBURE de chaque
     branche. Deux sections par nervure servent a la faire retomber puis
     relever sa pointe — un detail reel, mais qui demande que la branche
     occupe plusieurs dizaines de pixels pour se voir.

     Sur le palier bas, ou l'arbre proche est deja a vingt metres et ou le
     budget est le plus serre, on passe donc a une section unique. On perd la
     courbe d'UNE branche et on gagne le double de branches — a cette
     distance, c'est un echange tres favorable, puisque c'est la masse qu'on
     lit et pas le dessin. Les paliers moyen et haut gardent les deux. */
  const segments = (simple || fond) ? 1 : (detail >= 6 ? 2 : 1);

  /* AU FOND, ON NE DESSINE PLUS DES BRANCHES : ON DESSINE DES JUPES.

     Ma premiere tentative gardait des branches, mais tres larges et tres peu
     nombreuses pour tenir le budget. Le resultat etait pire que ce qu'il
     remplacait : cinq etages de six eventails larges, cela ne fait pas un
     sapin, cela fait un TIPI — une carcasse triangulaire sur pattes. C'est ce
     qu'on voyait au fond de la clairiere.

     Le probleme est structurel : a budget tres serre, une silhouette faite de
     branches est forcement soit clairsemee (arete de poisson) soit grossiere
     (tipi). Il n'y a pas de reglage entre les deux.

     A cette distance, pourtant, on ne cherche plus une structure : on cherche
     un CONE ETAGE, sombre, au bord irregulier. Une pile de jupes coniques le
     donne exactement, pour deux triangles par secteur, et son contour est bon
     sous tous les angles puisqu'elle est de revolution. Le bruit sur le rayon
     de chaque secteur suffit a lui oter son aspect tourne au tour. */
  const pousserJupe = (pos, nor, col, { yHaut, yBas, rHaut, rBas, S, sombre, clair, rand }) => {
    const bruit = [];
    for (let i = 0; i <= S; i++) bruit.push(i === S ? 0 : (rand() - 0.5) * 0.30);
    bruit[S] = bruit[0];
    for (let i = 0; i < S; i++) {
      const a0 = (i / S) * Math.PI * 2, a1 = ((i + 1) / S) * Math.PI * 2;
      const k0 = 1 + bruit[i], k1 = 1 + bruit[i + 1];
      const P = [
        [Math.cos(a0) * rHaut * k0, yHaut, Math.sin(a0) * rHaut * k0, clair],
        [Math.cos(a1) * rHaut * k1, yHaut, Math.sin(a1) * rHaut * k1, clair],
        [Math.cos(a1) * rBas * k1, yBas, Math.sin(a1) * rBas * k1, sombre],
        [Math.cos(a0) * rBas * k0, yBas, Math.sin(a0) * rBas * k0, sombre],
      ];
      for (const [x, y, z] of [[0, 1, 2], [0, 2, 3]]) {
        for (const j of [x, y, z]) {
          const v = P[j];
          pos.push(v[0], v[1], v[2]);
          // Normale de coque : vers l'exterieur et vers le haut.
          const l = Math.hypot(v[0], v[2]) || 1;
          const nx = (v[0] / l) * 0.66, nz = (v[2] / l) * 0.66;
          const n = Math.hypot(nx, 0.75, nz);
          nor.push(nx / n, 0.75 / n, nz / n);
          col.push(v[3], v[3], v[3]);
        }
      }
    }
  };

  const fPos = [], fNor = [], fCol = [];
  const nPos = [], nNor = [], nCol = [];
  const bacNeige = { pos: nPos, nor: nNor, col: nCol };

  const basFeuillage = 0.10 + rand() * 0.05;

  /* Niveau de fond : une pile de jupes, et rien d'autre. On sort tout de
     suite — ni fleche, ni neige, ni branches. */
  if (fond) {
    const NJ = 7;
    const S = 7;
    const hautTotal = 1 - basFeuillage - 0.03;
    for (let i = 0; i < NJ; i++) {
      const t0 = i / NJ, t1 = (i + 1.55) / NJ;   // les jupes se chevauchent
      const profil = (u) => Math.pow(Math.max(0, 1 - u), 0.80) * 0.30 + 0.010;
      pousserJupe(fPos, fNor, fCol, {
        yHaut: basFeuillage + hautTotal * Math.min(1, t1),
        yBas: basFeuillage + hautTotal * t0,
        rHaut: profil(Math.min(1, t1)) * 0.30,
        rBas: profil(t0) * (0.92 + rand() * 0.16),
        S,
        sombre: 0.62 + t0 * 0.30,
        clair: 0.95 + t0 * 0.25,
        rand,
      });
    }
    const geo = (P, N, C) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      g.computeBoundingSphere();
      return g;
    };
    return {
      feuillage: geo(fPos, fNor, fCol),
      neige: geo([], [], []),
      tronc: geo([], [], []),
    };
  }

  /* Etages de branches, du plus large en bas au plus serre en haut. Ils se
     chevauchent largement : c'est le recouvrement qui remplit la masse. */
  for (let i = 0; i < couches; i++) {
    const t = i / (couches - 1);

    // Profil : le plus large se situe vers le quart bas, pas tout en bas —
    // les branches du pied sont mortes et courtes chez les vrais coniferes.
    /* LE BAS DE L'ARBRE ETAIT BRIDE A 55 % DE SA LARGEUR MAXIMALE.

       C'est botaniquement defendable — les branches basses d'un epicea de
       futaie meurent a l'ombre et raccourcissent — mais c'est le profil d'un
       arbre de foret dense, pas celui qu'on a en tete quand on dit « sapin ».
       Combine a une hauteur importante, il donnait des cones effiles montes
       sur un pied vide : maigres, exactement.

       La base remonte a 82 %. Le retrecissement existe toujours, il ne creuse
       simplement plus la silhouette la ou l'oeil cherche la masse. Et la
       largeur generale gagne un huitieme : a vingt metres de haut, cela fait
       un houppier de treize metres d'envergure au lieu de douze — la
       proportion d'un epicea qui a pousse au large. */
    const profil = Math.pow(1 - t, 0.72) * (0.82 + 0.18 * Math.min(1, t * 4.0));
    const largeur = profil * 0.34 + 0.014;

    const y0 = basFeuillage + t * (1 - basFeuillage - 0.06);
    const espace = (1 - basFeuillage - 0.06) / couches;

    /* Le depart angulaire tourne d'un etage a l'autre selon un angle qui ne
       divise pas le tour : sans cela les branches s'alignent verticalement et
       l'arbre se couvre de cannelures parfaitement regulieres. */
    const phase = i * 2.39996;

    for (let b = 0; b < parEtage; b++) {
      const azimut = phase + (b / parEtage) * Math.PI * 2
                   + (rand() - 0.5) * (Math.PI * 2 / parEtage) * 0.42;

      // Longueur propre a chaque branche : c'est elle qui dechire la silhouette.
      /* Longueur resserree autour du profil. A 0,62-1,28 fois la largeur
         theorique, une branche sur trois s'arretait bien avant le contour :
         la silhouette etait rongee de l'interieur et l'arbre paraissait
         etrique meme la ou il y avait de la matiere. Elles restent
         irregulieres — c'est ce qui dechire le bord — mais autour du profil
         et non en dessous. */
      const L = largeur * (0.80 + rand() * 0.42);
      // Elle retombe d'autant plus qu'elle est longue et basse dans l'arbre.
      const chute = espace * (0.95 + rand() * 0.9) + L * (0.34 - t * 0.18);

      pousserBranche(fPos, fNor, fCol, {
        azimut,
        y0: y0 + (rand() - 0.5) * espace * 0.7,
        rBase: largeur * 0.10 + 0.004,
        longueur: L,
        chute,
        releve: chute * (0.30 + rand() * 0.30),   // la pointe se redresse
        /* LA VERSION LOINTAINE FAIT L'INVERSE : PEU DE BRANCHES, TRES LARGES.

           Au loin, ce qui compte n'est plus la branche mais la MASSE. Avec
           les memes lames fines que de pres, mais six fois moins nombreuses,
           l'arbre lointain devenait une arete de poisson — des epines sur un
           mat, exactement ce qu'on voyait au fond des captures d'Antoine. En
           elargissant chaque lame jusqu'a ce que l'anneau se referme, la
           silhouette redevient pleine pour trois cents triangles, et la
           bascule a quarante metres cesse de se voir. */
        demiLarge: L * (fond ? 0.42 + rand() * 0.14
                      : simple ? 0.20 + rand() * 0.09 : 0.16 + rand() * 0.09),
        plein: fond,
        segments,
        croisee: !fond,
        // Les etages du bas sont enfouis sous ceux du dessus, donc plus sombres.
        sombre: (0.38 + t * 0.20) * (0.9 + rand() * 0.2),
        clair: (0.98 + t * 0.32) * (0.9 + rand() * 0.2),
        /* La neige est POSEE PAR PLAQUES et non partout : un conifere charge
           garde des branches nues, et c'est ce contraste qui fait lire la
           charge. Uniforme, elle repeignait l'arbre en blanc. */
        neige: (t < 0.94 && !fond && rand() < (simple ? 0.30 : 0.62)) ? bacNeige : null,
        rand,
      });
    }
  }

  /* LA FLECHE. Un epicea se termine par une pousse verticale etroite mais
     GARNIE. Elle etait faite de trois brins de deux centimetres, et le tronc
     montait derriere elle jusqu'au sommet : il restait donc un baton noir nu
     au-dessus du feuillage, sur six pour cent de la hauteur de l'arbre —
     presque un metre et demi sur un grand sujet. C'est ce piquet qu'on voyait
     depasser de chaque sapin.

     Elle est maintenant faite de plusieurs couronnes serrees qui montent en
     se refermant, et le tronc s'arrete dessous (voir le profil plus bas). */
  {
    const yF = basFeuillage + (1 - basFeuillage - 0.06);
    const hFleche = 0.055 + rand() * 0.035;
    const etages = simple ? 2 : 4;
    for (let i = 0; i < etages; i++) {
      const u = i / etages;
      const r = 0.030 * (1 - u) + 0.004;
      for (let b = 0; b < (simple ? 3 : 4); b++) {
        pousserBranche(fPos, fNor, fCol, {
          azimut: i * 1.9 + b * (Math.PI * 2 / (simple ? 3 : 4)) + rand() * 0.4,
          y0: yF + u * hFleche,
          rBase: 0.002,
          longueur: r,
          chute: -hFleche * 0.16,     // negative : la pousse monte
          releve: 0,
          demiLarge: r * 0.34,
          segments: 1,
          croisee: !simple,
          sombre: 0.80 + u * 0.15, clair: 1.15 + u * 0.20,
          neige: null,
          rand,
        });
      }
    }
  }

  /* LE TRONC, ET SON PIED.

     Trois defauts d'un coup dans la version precedente.

     1. SON DIAMETRE SUIVAIT LA HAUTEUR. Comme la matrice d'instance met la
        meme echelle en x, y et z, un rayon de 0,026 donnait 0,65 m sur un
        arbre de vingt-cinq metres — un tronc d'un metre trente de diametre,
        soit un sequoia. Un epicea de cette taille fait quarante centimetres.
        On ne peut pas corriger dans la geometrie, qui est partagee : c'est la
        matrice d'instance qui doit cesser d'etre uniforme (voir forest.js).
        Ici on se contente de dimensionner pour un arbre moyen.

     2. IL N'AVAIT PAS DE PIED. Un cone qui sort de la neige, sans
        empattement, se lit comme un poteau plante. Un vrai tronc S'EVASE au
        contact du sol, et la neige s'accumule contre lui. On ajoute donc un
        empattement dans le profil — le rayon augmente fortement sur les
        derniers pourcents, ce qui suffit a poser l'arbre au lieu de le
        planter.

     3. IL N'AVAIT QU'UN SEGMENT EN HAUTEUR, donc le shader de vent le
        courbait en ligne droite, comme une tige rigide qui pivote. Quatre
        segments donnent une vraie flexion, ou le pied reste fixe. */
  /* Le fut lointain n'a pas besoin de cinq troncons ni de deux rangees : a
     quarante metres il fait deux pixels de large. Il pesait cent triangles,
     soit un tiers de l'arbre entier. */
  const seg = simple ? 4 : Math.max(5, detail);
  const rangs = simple ? 1 : 2;
  const parties = [];
  /* Il s'arrete a 0,93 : au-dela c'est la fleche qui prend le relais, et un
     tronc qui montait jusqu'a 1,0 laissait un piquet nu au-dessus du
     feuillage. Il s'affine aussi beaucoup plus vite en haut. */
  const profil = [
    [0.000, 0.052],   // empattement, sous la neige et juste au-dessus
    [0.030, 0.032],
    [0.090, 0.026],
    [0.400, 0.017],
    [0.750, 0.009],
    [0.930, 0.004],
  ];
  for (let i = 0; i < profil.length - 1; i++) {
    const [y0, r0] = profil[i];
    const [y1, r1] = profil[i + 1];
    const c = new THREE.CylinderGeometry(r1, r0, y1 - y0, seg, rangs, true);
    c.translate(0, (y0 + y1) / 2, 0);
    parties.push(c);
  }
  const tronc = fusionnerGeos(parties);

  return {
    feuillage: versGeometrie(fPos, fNor, fCol),
    neige: versGeometrie(nPos, nNor, nCol),
    tronc,
  };
}

/* LE FEUILLAGE, ECLAIRE COMME DES AIGUILLES ET NON COMME UNE TOLE.

   Un conifere de nuit occupe le deuxieme plus grand nombre de pixels apres la
   neige, et il etait rendu comme une surface opaque en facettes plates : sur
   une face detournee de la lune, N·L tombe a zero et l'etage entier devient
   un aplat noir. D'ou l'aspect de decoupe en carton, surtout au loin ou les
   facettes se lisent une a une.

   Or une masse d'aiguilles n'est pas une tole. Trois choses la distinguent, et
   toutes les trois sont bon marche :

   · ELLE TRANSMET. La lumiere passe entre les aiguilles et ressort de l'autre
     cote. On ajoute donc un terme qui vit LA OU N·L EST NEGATIF, c'est-a-dire
     precisement la ou le rendu classique donne du noir. C'est ce terme qui
     redonne du volume aux etages a contre-jour.

   · ELLE VOIT LE CIEL PAR LE HAUT. Les branches hautes recoivent le bleu du
     ciel, les basses sont enfouies. Un simple gradient vertical, indexe sur la
     hauteur dans l'arbre, remplace une occlusion ambiante qu'on ne peut pas se
     payer ici.

   · SON BORD S'ALLUME. Sur une silhouette, les aiguilles du contour sont
     traversees par la lumiere et brillent. Comme pour le cerf, le terme
     n'existe que la ou la normale regarde a la fois de cote ET vers la lune :
     sans ce second facteur, tout l'arbre s'allumerait uniformement.

   Le resultat vise n'est pas un arbre plus clair — c'est un arbre dont on lit
   encore la forme quand il n'est pas eclaire de face. */
export function eclairerAiguilles(materiau, { uniforms, transmission = 1 } = {}) {
  const precedent = materiau.onBeforeCompile;
  materiau.onBeforeCompile = (shader) => {
    if (precedent) precedent(shader);
    shader.uniforms.uTransm = { value: transmission };
    shader.uniforms.uLuneCol = uniforms.uLuneCol;
    shader.uniforms.uCielCol = uniforms.uCielCol;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n varying float vHaut;')
      // `transformed.y` est la hauteur dans l'arbre normalise : zero au pied,
      // un a la cime, quelle que soit la taille de l'instance.
      .replace('#include <project_vertex>', '#include <project_vertex>\n vHaut = clamp(transformed.y, 0.0, 1.0);');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        varying float vHaut;
        uniform float uTransm;
        uniform vec3 uLuneCol, uCielCol;
      `)
      .replace('#include <opaque_fragment>', `
        #if NUM_DIR_LIGHTS > 0
        {
          vec3 N = normalize(normal);
          vec3 V = normalize(vViewPosition);
          vec3 L = normalize(directionalLights[0].direction);
          float nl = dot(N, L);

          // 1. Transmission : elle ne vit que du cote non eclaire.
          float dos = clamp(-nl, 0.0, 1.0);
          outgoingLight += diffuseColor.rgb * uLuneCol * pow(dos, 1.6) * 0.34 * uTransm;

          // 2. Le ciel arrive par le haut ; le pied de l'arbre est enfoui.
          outgoingLight += diffuseColor.rgb * uCielCol * (0.10 + vHaut * 0.30) * 0.42;

          /* 3. Le bord des aiguilles s'allume, mais seulement face a la lune.

             C'ETAIT LUI, LE CARTON BEIGE. Ce terme ajoutait la couleur de la
             lune pure, sans la teinter du feuillage, a hauteur de 0,30 — soit
             trois a cinq fois l'eclairement propre des aiguilles, et dans une
             teinte tres ambree. Il etait cense ne toucher qu'une mince
             silhouette, puisque la tranche ne monte qu'a l'incidence rasante.
             Mais un etage de branches EST un plan large, et vu depuis le sol
             un plan large est presque toujours rasant : la tranche valait donc
             1 sur toute la surface. Chaque etage se remplissait a ras bord
             et l'arbre entier virait au brun clair — l'aspect « planches de
             carton » qu'on voyait sans que la geometrie y soit pour rien.

             Deux corrections. La lumiere de bord est desormais teintee par
             l'aiguille qu'elle traverse, donc elle ne peut plus virer au brun ;
             et l'exposant monte pour que le terme se resserre reellement sur
             le contour au lieu de couvrir la planche. */
          vec3 bord = mix(uLuneCol, uLuneCol * diffuseColor.rgb * 4.0, 0.62);
          float tranche = pow(1.0 - abs(dot(N, V)), 6.0);
          outgoingLight += bord * tranche * clamp(nl, 0.0, 1.0) * 0.11 * uTransm;
        }
        #endif
        #include <opaque_fragment>
      `);
  };
  const clefPrec = materiau.customProgramCacheKey ? materiau.customProgramCacheKey() : '';
  materiau.customProgramCacheKey = () => clefPrec + '-aiguilles' + transmission;
}

/* Le vent, injecte dans n'importe quel materiau instancie.

   Le balancement doit dependre de la position de l'arbre dans le monde,
   sinon toute la foret oscille en choeur — ce qui se remarque immediatement.
   L'amplitude croit avec la hauteur locale : le pied reste fixe, la cime
   travaille. */
export function appliquerVent(materiau, { amplitude = 1, uniforms }) {
  materiau.onBeforeCompile = (shader) => {
    shader.uniforms.uTemps = uniforms.uTemps;
    shader.uniforms.uVent = uniforms.uVent;
    shader.uniforms.uAmpVent = { value: amplitude };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        uniform float uTemps, uAmpVent;
        uniform vec2 uVent;
      `)
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec3 ancre = instanceMatrix[3].xyz;
            float taille = length(instanceMatrix[1].xyz);
            float largeur = max(length(instanceMatrix[0].xyz), 0.001);
          #else
            vec3 ancre = vec3(0.0);
            float taille = 1.0;
            float largeur = 1.0;
          #endif

          float phase = ancre.x * 0.13 + ancre.z * 0.11;
          // Deux frequences : une houle lente et une vibration plus courte.
          float souffle = sin(uTemps * 0.62 + phase) * 0.72
                        + sin(uTemps * 1.63 + phase * 2.3) * 0.28;

          // La rafale traverse la foret : elle arrive plus tard au loin.
          float rafale = 0.55 + 0.45 * sin(uTemps * 0.21 - ancre.z * 0.012);

          float prise = pow(clamp(transformed.y, 0.0, 1.0), 1.7);

          /* LE BALANCEMENT SE CALCULE EN METRES, PUIS SE CONVERTIT.

             C'etait faux, et de facon spectaculaire. Le deplacement etait
             ajoute a transformed.xz, donc dans le repere NORMALISE du
             modele — puis multiplie par l'echelle horizontale de l'instance.
             Pour un sapin de vingt-cinq metres, cela donnait un balancement
             de pres de vingt metres. La foret entiere ondulait comme des
             algues, et surtout :

             LE FEUILLAGE GLISSAIT HORS DE SON TRONC. Feuillage et tronc
             recevaient des amplitudes differentes (1,0 contre 0,25) et,
             pire, des echelles horizontales differentes. Ils se separaient
             donc de plusieurs metres — le tronc restait planté droit pendant
             que le houppier partait de cote. C'est exactement ce qu'on voyait
             sans le comprendre : des poteaux nus dressés au milieu des
             arbres, que j'avais d'abord pris pour mes propres futs de premier
             plan.

             En divisant par la largeur de l'instance, le deplacement devient
             une vraie distance en metres, identique pour toutes les pieces du
             meme arbre quelle que soit leur epaisseur. L'arbre bouge d'un
             seul tenant, et l'amplitude reglee est enfin celle qu'on obtient. */
          transformed.xz += uVent * souffle * rafale * prise * uAmpVent
                          * taille * 0.030 / largeur;
        }
      `);
  };
  materiau.customProgramCacheKey = () => 'vent' + amplitude;
}
