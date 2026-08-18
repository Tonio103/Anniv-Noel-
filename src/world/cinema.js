/* DEUX SCENES DE CINEMA DE PLUS.

   ANTOINE : « je veux du reve, genre une Kill Bill, une Interstellar, et
   faut que ce soit vraiment des scenes de films ».

   Les deux qu'il nomme sont, par chance, aux antipodes l'une de l'autre :
   l'une est une SILHOUETTE — une femme en survetement jaune avec un sabre,
   reconnaissable au premier coup d'oeil et a n'importe quelle distance —
   l'autre est un PHENOMENE, un disque noir cercle de feu qui occupe le ciel.
   Mises a une centaine de metres l'une de l'autre, elles ne se marchent pas
   dessus une seconde.

   Aucune des deux ne charge quoi que ce soit : la premiere reutilise le
   corps implicite de `humanoide.js`, la seconde tient entierement dans un
   nuanceur de dix-huit lignes.
*/

import * as THREE from 'three';
import { smoothstep, clamp } from '../core/noise.js';
import { grainRond, lueurDiffuse } from '../core/dot.js';
import {
  REPERES, construireCorps, nouvelleInstance, piste, regarderVers, appliquerPose,
} from './humanoide.js';

/* ==========================================================================
   1. GARGANTUA — INTERSTELLAR

   Le trou noir du film est l'une des images les plus reconnaissables du
   cinema recent, et elle se resume a trois choses :

   · UN DISQUE PARFAITEMENT NOIR au centre. Pas sombre : noir. C'est le seul
     endroit d'une image ou il n'y a rigoureusement rien ;
   · UN ANNEAU DE FEU vu par la tranche, qui passe devant en bas ;
   · ET SURTOUT, la partie du disque situee DERRIERE l'astre, que la gravite
     ramene par-dessus. C'est ce halo qui ceinture le noir de haut en bas et
     qui rend l'image impossible a confondre avec un anneau de Saturne.

   Tout cela se dessine analytiquement dans un fragment, sur un simple carre
   tourne vers la camera : pas une texture, pas un maillage, et une nettete
   parfaite a n'importe quelle taille d'ecran.
   ========================================================================== */
function matiereTrouNoir() {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    /* PAS D'ADDITION, ET C'EST TOUT LE PROBLEME D'UN TROU NOIR.

       Premiere version en melange additif : l'anneau de feu sortait
       parfaitement, et l'horizon — qui vaut zero — n'ajoutait rien du tout.
       On voyait donc la foret AU TRAVERS du trou noir, ce qui est
       exactement le contraire de ce qu'un trou noir fait. Le seul endroit
       d'une image ou il n'y a rigoureusement rien ne peut pas se peindre en
       ajoutant de la lumiere : il faut EN RETIRER, donc un melange normal,
       avec une opacite qui vaut un a l'interieur de l'horizon et qui suit
       la clarte ailleurs. */
    blending: THREE.NormalBlending,
    uniforms: { uTemps: { value: 0 }, uForce: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform float uTemps;
      uniform float uForce;

      /* Une bande douce entre deux rayons. Bords en smoothstep pour qu'il
         n'y ait aucun arret de degrade : l'oeil lit une rupture de pente
         comme un contour, et un disque d'accretion cercle d'un trait est
         un anneau de Saturne. */
      float bande(float x, float a0, float a1, float b0, float b1) {
        return smoothstep(a0, a1, x) * (1.0 - smoothstep(b0, b1, x));
      }

      void main() {
        vec2 p = vUv;
        float r = length(p);

        /* LE DISQUE D'ACCRETION, vu presque par la tranche. On ecrase
           l'ordonnee d'un facteur six : c'est ce seul chiffre qui fait
           qu'on regarde un disque de biais et non un rond de fumee. C'est
           une BANDE PLEINE, du bord interne au bord externe, et non un
           trait — de la matiere, pas un cerceau. */
        float rd = length(vec2(p.x, p.y / 0.155));
        float disque = bande(rd, 0.34, 0.42, 0.72, 0.98) * 1.35;
        /* Il est bien plus brillant d'un cote : la matiere qui vient vers
           nous est amplifiee, celle qui s'eloigne s'eteint. C'est le
           faisceau relativiste, et c'est lui qui empeche l'anneau d'avoir
           l'air d'un decor symetrique. */
        disque *= 0.42 + 0.95 * smoothstep(-0.45, 0.55, -p.x);

        /* LE HALO LENSE : la face arriere du disque, que la gravite ramene
           par-dessus et par-dessous l'astre. Celui-la est CIRCULAIRE — la
           perspective a ete redressee — et il est d'autant plus fort qu'on
           s'ecarte de l'horizontale. */
        float arc = bande(r, 0.302, 0.318, 0.395, 0.475);
        arc *= 0.30 + 0.85 * abs(p.y) / max(r, 1e-3);
        arc *= 1.35;

        /* Un frisson lent dans la matiere. Sinus d'arguments modestes :
           rien qui puisse s'effondrer en precision moyenne sur telephone. */
        float grain = 0.86 + 0.14 * sin(atan(p.y, p.x) * 7.0 + uTemps * 0.9)
                            * sin(rd * 17.0 - uTemps * 1.7);

        float feu = (disque + arc) * grain;

        /* L'HORIZON. Noir franc, bord tres serre : c'est la nettete de ce
           bord qui donne l'echelle de la chose. */
        float noir = smoothstep(0.302, 0.288, r);
        /* MAIS LA FACE AVANT DU DISQUE PASSE DEVANT LUI. C'est le detail qui
           fait basculer l'image du gadget au plan de film : en bas, la
           matiere est entre nous et l'astre, donc elle n'est pas masquee. */
        float devant = disque * grain * smoothstep(0.03, -0.06, p.y);
        feu = max(feu * (1.0 - noir), devant);

        vec3 chaud = vec3(1.00, 0.66, 0.26);
        vec3 blanc = vec3(1.00, 0.95, 0.86);
        vec3 col = mix(chaud, blanc, clamp(feu * 0.75, 0.0, 1.0)) * feu;
        // Une lueur tres large, qui pose l'astre dans le ciel.
        float voile = exp(-pow((r - 0.44) / 0.30, 2.0)) * 0.05;
        col += chaud * voile;

        /* L'opacite : un a l'interieur de l'horizon, la clarte ailleurs.
           C'est elle qui creuse le ciel. */
        float a = max(noir, clamp(max(max(col.r, col.g), col.b), 0.0, 1.0));
        gl_FragColor = vec4(col, a * uForce);
      }
    `,
  });
  return mat;
}

/* LA SILHOUETTE AU SOL. Antoine : « je veux plus d'elements aussi sur
   terre en reference a Interstellar ». Le disque seul dans le ciel est un
   phenomene ; ce qui manque pour raconter le film, c'est quelqu'un qui le
   REGARDE depuis le sol — la combinaison bouffante, le casque en bulle, un
   bras leve vers ce qu'il montre, c'est la silhouette la plus citee de la
   science-fiction juste apres le vaisseau lui-meme. Meme technique que le
   velo d'E.T. : un contour noir peint au canevas, rien de plus. */
function siluetteAstronaute() {
  const n = 160;
  const cv = document.createElement('canvas');
  cv.width = n; cv.height = Math.round(n * 1.35);
  const c = cv.getContext('2d');
  c.fillStyle = '#000';

  // Les jambes, ecartees, ancrees au sol.
  c.beginPath();
  c.moveTo(58, 216); c.lineTo(48, 148); c.lineTo(66, 146); c.lineTo(74, 214);
  c.closePath(); c.fill();
  c.beginPath();
  c.moveTo(102, 216); c.lineTo(112, 148); c.lineTo(94, 146); c.lineTo(86, 214);
  c.closePath(); c.fill();

  // Le sac a dos (PLSS), qui deborde derriere les epaules.
  c.beginPath();
  c.ellipse(78, 96, 32, 24, 0, 0, Math.PI * 2); c.fill();
  // Le torse, large et arrondi : la combinaison est bouffante, pas ajustee.
  c.beginPath();
  c.ellipse(80, 110, 34, 44, 0, 0, Math.PI * 2); c.fill();

  // Les bras : un le long du corps, l'autre leve — il montre ce qu'il
  // regarde, geste qui a lui seul raconte toute la scene.
  c.lineWidth = 20; c.lineCap = 'round';
  c.beginPath(); c.moveTo(52, 92); c.lineTo(40, 152); c.stroke();
  c.beginPath(); c.moveTo(106, 92); c.lineTo(126, 38); c.stroke();

  // Le casque : une grande bulle ronde, le signe qui rend la silhouette
  // reconnaissable entre toutes, la tete renversee vers l'arriere.
  c.beginPath();
  c.arc(84, 46, 30, 0, Math.PI * 2); c.fill();

  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: t, transparent: true, opacity: 0, color: 0x03050A,
    depthWrite: false, fog: true, side: THREE.DoubleSide,
  });
  const q = new THREE.Mesh(new THREE.PlaneGeometry(1, cv.height / cv.width), mat);
  q.renderOrder = 1;
  return q;
}

export function trouNoir(relief, chemin) {
  const g = new THREE.Group();
  const mat = matiereTrouNoir();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  /* CENT UNITES A TROIS CENTS METRES, soit dix-neuf degres de large. A
     cent cinquante, il debordait franchement par le haut du cadre en
     portrait — on ne voyait que la moitie basse d'un anneau, ce qui ne se
     lit pas du tout. */
  quad.scale.setScalar(102);
  quad.renderOrder = 2;
  /* Le disque et l'astronaute sont chacun dans leur PROPRE sous-groupe : le
     premier suspendu dans le ciel, loin, le second pose au sol, pres — deux
     positions qui n'ont rien a voir, mais qui doivent toutes deux faire
     face a la camera (un panneau plat vu de travers se lit comme une
     lame). `g` lui-meme ne bouge jamais : voir plus bas pourquoi. */
  const discGroupe = new THREE.Group();
  discGroupe.add(quad);
  g.add(discGroupe);
  const astro = siluetteAstronaute();
  astro.scale.setScalar(2.3);
  const astroGroupe = new THREE.Group();
  astroGroupe.add(astro);
  g.add(astroGroupe);

  const p = new THREE.Vector3(), tan = new THREE.Vector3(), cote = new THREE.Vector3();
  g.userData.suitCamera = true;

  /* ANTOINE, PUIS UNE SECONDE FOIS SUR LA LUNE D'E.T. — meme cause :
     `g.position` etait recalcule a partir de la direction INSTANTANEE de
     la camera au moment ou la fenetre s'ouvre, et cet instant tombe parfois
     en pleine transition de cadrage, ou cette direction n'est pas stable
     d'une image a l'autre : l'astre se figeait alors a un endroit
     legerement different selon l'image exacte du declenchement, ce qui, vu
     deux fois, se lit comme un saut plutot qu'une derive.

     LA VRAIE CORRECTION, appliquee ici comme sur la lune : on ne demande
     plus JAMAIS a la camera OU PLACER l'astre. Le CHEMIN — fixe, connu
     d'avance, identique a chaque image — donne un repere stable a
     l'endroit ou la scene s'ouvre. La camera ne sert plus qu'a orienter le
     disque face a elle. */
  let calcule = false;
  const posDisque = new THREE.Vector3();
  const posAstro = new THREE.Vector3();
  g.userData.reinit = () => { calcule = false; };

  g.userData.jouer = (u, t, camera, sAncre) => {
    /* Il se leve lentement et se retire de meme : un trou noir n'apparait
       pas d'un coup, il est LA et l'on finit par le voir. */
    const vis = smoothstep(0, 0.26, u) * smoothstep(1, 0.74, u);
    g.visible = vis > 0.005;
    if (!g.visible || !camera) return;
    mat.uniforms.uForce.value = vis;
    mat.uniforms.uTemps.value = t;
    astro.material.opacity = vis * 0.95;
    /* LA LUMIERE SE COURBE PRES DE LUI. L'aberration chromatique du moteur —
       jusqu'ici un simple reglage discret d'objectif — devient ici l'effet
       lui-meme : une vraie lentille gravitationnelle, pas une texture
       plaquee. Elle suit `vis` : nulle tant qu'on ne le voit pas, pleine
       quand il domine le cadre. */
    g.userData.distorsionDyn = vis * 0.85;

    if (!calcule) {
      /* Le meme placement que la lune d'E.T., et pour la meme raison
         mesuree : le drone pique vers le cerf, il ne reste qu'un bandeau
         de ciel au haut du cadre en portrait. Un peu plus loin et un peu
         plus haut que la lune, parce que l'objet est beaucoup plus grand. */
      chemin.point(sAncre, p);
      chemin.tangente(sAncre, tan);
      chemin.cote(sAncre, cote);
      const D = 300;
      posDisque.copy(p).addScaledVector(tan, D).addScaledVector(cote, 22);
      /* Vingt-six metres a trois cents, soit cinq degres d'elevation : il
         se LEVE derriere la ligne d'arbres au lieu de flotter au zenith.
         Le drone vole une dizaine de metres au-dessus du chemin : on part
         de la hauteur DU CHEMIN, stable, pas de celle de la camera. */
      posDisque.y = p.y + 36;

      /* L'astronaute, lui, est pres et au sol : trente metres devant, tres
         legerement de cote pour ne pas boucher exactement l'axe. */
      posAstro.copy(p).addScaledVector(tan, 30).addScaledVector(cote, -9);
      posAstro.y = relief.hauteur(posAstro.x, posAstro.z);

      /* La racine `g`, elle, ne bouge jamais — seuls ses deux sous-groupes
         sont positionnes. Sans ce repere, le mecanisme qui tourne la camera
         vers la scene active viserait l'origine du monde, tres loin derriere
         nous, au lieu du disque. */
      g.userData.pointRegard = posDisque;

      calcule = true;
    }
    discGroupe.position.copy(posDisque);
    discGroupe.lookAt(camera.position);
    astroGroupe.position.copy(posAstro);
    astroGroupe.lookAt(camera.position.x, posAstro.y + 1.2, camera.position.z);
  };
  return g;
}

/* ==========================================================================
   2. KILL BILL

   Une silhouette, et c'est tout ce qu'il faut : un survetement JAUNE avec
   sa bande noire le long des bras et des jambes, et un sabre japonais. Ces
   deux elements suffisent — personne n'a jamais eu besoin de voir un visage
   pour reconnaitre ce plan-la.

   La bande noire ne peut pas se decouper a l'abscisse : dans une pose en
   « A », les membres sont inclines et aucun seuil sur x ne separe le dehors
   du dedans. On se sert de la NORMALE de la surface, qui le dit exactement.
   ========================================================================== */
const JAUNE = new THREE.Color(0xC9A215);
const NOIR = new THREE.Color(0x0B0C10);

function teinteKillBill(x, y, z, c, os, nx, ny, nz) {
  // Les chaussures, jaunes elles aussi mais plus sombres.
  if (os === 'piedD' || os === 'piedG') { c.setHex(0x8A6E0E); return; }
  /* La bande. Elle court sur le cote EXTERIEUR des membres : la normale y
     pointe lateralement, loin de l'axe du corps. On exige en plus que le
     point soit du bon cote, sans quoi la face interne de la cuisse opposee
     se retrouverait rayee elle aussi. */
  const limbe = os === 'brasD' || os === 'brasG' || os === 'avantD' || os === 'avantG'
             || os === 'cuisseD' || os === 'cuisseG' || os === 'molletD' || os === 'molletG';
  if (limbe) {
    const dehors = (x > 0 ? nx : -nx);
    if (dehors > 0.72) { c.copy(NOIR); return; }
  }
  // Le col, noir : il detache la tete du survetement.
  if (y > REPERES.baseCou - 0.02 && y < REPERES.menton - 0.03) { c.copy(NOIR); return; }
  // La tete : on ne modelise pas un visage, on suggere une chevelure sombre.
  if (os === 'tete' && (z > -0.02 || y > REPERES.crane + 0.02)) { c.setHex(0x2A2118); return; }
  if (os === 'tete') { c.setHex(0xC9A98A); return; }        // le visage, dans l'ombre
  c.copy(JAUNE);
  void ny; void nz;
}

/* Le sabre. Une lame LEGEREMENT COURBE et a dos plat : c'est cette asymetrie
   qui fait « katana » plutot que « epee ». On la construit en decalant les
   sommets d'une boite fine le long d'un arc, ce qui coute deux boucles. */
function katana() {
  const g = new THREE.Group();
  const L = 0.72, N = 14;
  const pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = t * L;
    // La courbure, tres faible : deux centimetres sur toute la lame.
    const cx = Math.sin(t * 0.55) * 0.028;
    // Elle s'affine vers la pointe, et le dos reste plus epais que le fil.
    const demi = 0.0155 * (1 - t * 0.35);
    const ep = 0.0055 * (1 - t * 0.45);
    pos.push(cx - demi, y, -ep, cx + demi, y, 0, cx - demi, y, ep);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 3, b = a + 3;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
    idx.push(a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    idx.push(a + 2, b + 2, a, a, b + 2, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const lame = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0xD8E2EE, roughness: 0.12, metalness: 0.95,
    emissive: 0x1A2230, emissiveIntensity: 1, side: THREE.DoubleSide,
  }));
  g.add(lame);

  // La garde ronde, puis la poignee tressee.
  const tsuba = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.008, 14),
    new THREE.MeshStandardMaterial({ color: 0x24282F, roughness: 0.45, metalness: 0.7 })
  );
  g.add(tsuba);
  const poignee = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.019, 0.24, 8),
    new THREE.MeshStandardMaterial({ color: 0x14161B, roughness: 0.85 })
  );
  poignee.position.y = -0.13;
  g.add(poignee);
  return g;
}

/* L'ADVERSAIRE. Antoine : « elle ne combat personne, il n'y a pas
   d'animation de combat, il faut vraiment que ce soit du Tarantino avec
   beaucoup de sang ». Une choregraphie solo, aussi enchainee soit-elle,
   ne raconte jamais un combat — il faut quelqu'un en face, et quelqu'un
   qui PERD. Un des hommes masques du film — costume noir, masque blanc —
   affronte donc le sabre de Kill Bill et n'y survit pas : deux coups
   portes, deux reactions, une chute, et le sang sur la neige qui reste
   bien apres que tout le reste s'est efface. */
const NOIR_MASQUE = new THREE.Color(0x101114);
const MASQUE_BLANC = new THREE.Color(0xE8E4DA);

function teinteMasque(x, y, z, c, os) {
  if (os === 'tete') {
    // Le masque couvre tout sauf une bande etroite autour des yeux.
    if (Math.abs(x) < 0.045 && y > REPERES.menton - 0.01 && y < REPERES.crane - 0.03) {
      c.setHex(0x0A0A0C);
      return;
    }
    c.copy(MASQUE_BLANC);
    return;
  }
  if (os === 'piedD' || os === 'piedG') { c.setHex(0x08090B); return; }
  c.copy(NOIR_MASQUE);
  void z;
}

let _corpsAdversaire = null;

function adversaireMasque(palier) {
  const g = new THREE.Group();
  if (!_corpsAdversaire) {
    _corpsAdversaire = construireCorps(palier, {
      teinter: teinteMasque,
      // Plus large qu'elle : c'est ce rapport, encore, qui fait lire un
      // homme en face d'une femme, avant tout autre detail.
      gabarit: { carrure: 1.12, masse: 1.14 },
      pas: palier.nom === 'bas' ? 0.032 : palier.nom === 'moyen' ? 0.024 : 0.020,
    });
  }
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.72, metalness: 0.02,
    emissive: new THREE.Color(0x0A0A0C), emissiveIntensity: 1,
  });
  const perso = nouvelleInstance(_corpsAdversaire, mat, { ombres: palier.ombres });
  g.add(perso);
  const os = perso.userData.os;

  const sabre = katana();
  sabre.rotation.x = -0.30;
  sabre.position.y = -0.02;
  os.mainD.add(sabre);

  const POSE = {
    garde: {
      brasD: [-0.95, 0, 0.30], avantD: [1.15, 0, 0], mainD: [0, 0, 0.15],
      brasG: [-0.70, 0, -0.40], avantG: [0.90, 0, 0],
      cuisseD: [-0.30, 0, 0.14], molletD: [-0.20, 0, 0],
      cuisseG: [0.30, 0, -0.16], molletG: [-0.24, 0, 0],
      colonne: [0.04, 0, 0], poitrine: [0.03, 0, 0],
    },
    /* LE PREMIER COUP LE TOUCHE : le corps se casse en arriere, le sabre
       echappe presque de la main. */
    touche1: {
      brasD: [-0.30, 0.60, -0.50], avantD: [0.30, 0, 0], mainD: [0, 0, -0.4],
      brasG: [0.40, 0, -0.70], avantG: [0.20, 0, 0],
      cuisseD: [0.20, 0, 0.10], molletD: [0.10, 0, 0],
      cuisseG: [-0.35, 0, -0.20], molletG: [0.30, 0, 0],
      bassin: [0, -0.30, 0], colonne: [-0.45, -0.20, 0.20], poitrine: [-0.35, -0.15, 0.15],
      cou: [0.10, -0.10, 0.20], tete: [0.15, -0.10, 0.25],
    },
    /* LE SECOND LE COUCHE : les genoux cedent, le sabre part au sol. */
    chute: {
      brasD: [0.10, 0.30, -0.90], avantD: [0.60, 0, 0], mainD: [0, 0, 0],
      brasG: [0.30, 0, -0.60], avantG: [0.70, 0, 0],
      cuisseD: [-1.35, 0, 0.30], molletD: [-1.65, 0, 0], piedD: [0.80, 0, 0],
      cuisseG: [-1.20, 0, -0.30], molletG: [-1.55, 0, 0], piedG: [0.75, 0, 0],
      bassin: [0, 0.70, 0.60], colonne: [0.55, 0.30, 0.30], poitrine: [0.45, 0.20, 0.20],
      cou: [0.30, 0.10, 0], tete: [0.35, 0.15, 0],
    },
  };

  g.userData.os = os;
  g.userData.POSE = POSE;
  return g;
}

/* LE SANG. Antoine, deux fois : « je veux surtout enormement de sang ».
   Quarante-six points qui retombaient en trois quarts de seconde etaient
   un aveu de pudeur, pas une scene de Tarantino. On ne retouche pas la
   nuance : on retouche l'ECHELLE — quatre fois plus de particules, deux
   fois plus grosses, qui giclent trois fois plus loin et mettent deux
   fois plus longtemps a s'effacer. */
function gerbeDeSang(N = 170) {
  const pos = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: grainRond(), alphaTest: 0.02, color: 0x9C0D12, size: 0.19,
    transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  const dirs = Array.from({ length: N }, () => {
    const a = Math.random() * Math.PI * 2, e = Math.random() * 0.6 + 0.15;
    return [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)];
  });
  pts.userData.dirs = dirs;
  pts.userData.mat = mat;
  return pts;
}

/* LA FONTAINE. Le second coup est celui qui tue : il merite plus qu'une
   gerbe de plus, il merite le geyser vertical le plus cite du cinema de
   sabre — un jet qui monte, retombe, et continue de pulser une seconde
   ou deux apres l'impact. */
function fontaineDeSang() {
  const N = 140;
  const pos = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: grainRond(), alphaTest: 0.02, color: 0xA80F14, size: 0.20,
    transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  // Presque vertical, avec juste assez d'ecart pour faire un jet et non
  // un fil — c'est cet ecart qui donne l'epaisseur du geyser.
  const dirs = Array.from({ length: N }, () => {
    const a = Math.random() * Math.PI * 2, e = 0.62 + Math.random() * 0.5;
    return [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)];
  });
  const dephasages = Float32Array.from({ length: N }, () => Math.random() * 0.9);
  pts.userData.dirs = dirs;
  pts.userData.dephasages = dephasages;
  pts.userData.mat = mat;
  return pts;
}

/* LA MARE. Une seule tache ronde disait « quelqu'un a saigne ici » ;
   Antoine veut une MARE, pas une piece de monnaie. Trois eclaboussures
   irregulieres et superposees, de tailles differentes, couvrent un
   territoire bien plus large et rompent le contour parfaitement circulaire
   qu'un cercle unique trahit toujours. */
function tacheDeSang() {
  const g = new THREE.Group();
  const taches = [];
  const disposition = [
    { x: 0, z: 0.3, r: 1.35, rot: 0.4 },
    { x: 0.55, z: 0.85, r: 0.75, rot: 1.7 },
    { x: -0.5, z: 0.55, r: 0.65, rot: 2.6 },
  ];
  for (const d of disposition) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x60090D, transparent: true, opacity: 0, depthWrite: false,
    });
    const m = new THREE.Mesh(new THREE.CircleGeometry(d.r, 11), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = d.rot;
    m.position.set(d.x, 0, d.z);
    m.renderOrder = 1;
    g.add(m);
    taches.push(mat);
  }
  g.userData.taches = taches;
  return g;
}

let _corpsKB = null;

export function killBill(palier) {
  const g = new THREE.Group();
  if (!_corpsKB) {
    _corpsKB = construireCorps(palier, {
      teinter: teinteKillBill,
      /* Une charpente plus fine et moins large que celle de Spider-Man :
         c'est ce seul rapport qui fait lire une femme plutot qu'un homme en
         jaune, bien avant n'importe quel detail. */
      gabarit: { carrure: 0.90, masse: 0.90 },
      pas: palier.nom === 'bas' ? 0.032 : palier.nom === 'moyen' ? 0.024 : 0.020,
    });
  }
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.66, metalness: 0.02,
    emissive: new THREE.Color(0x141008), emissiveIntensity: 1,
  });
  const perso = nouvelleInstance(_corpsKB, mat, { ombres: palier.ombres });
  g.add(perso);

  const os = perso.userData.os;
  const sabre = katana();
  /* Le sabre prolonge le poing : greffe sur l'os de la main, tout ce que
     fait l'epaule se propage jusqu'a la pointe. */
  sabre.rotation.x = -0.30;
  sabre.position.y = -0.02;
  os.mainD.add(sabre);

  /* LA QUEUE-DE-CHEVAL. Antoine : « on ne reconnait pas Kill Bill ». Le
     survetement jaune et le sabre suffisent en photo fixe, mais en
     mouvement, de loin et de nuit, ils se lisent comme n'importe quel
     escrimeur. La coiffure — stricte, tiree en arriere, qui fouette dans
     les coups — est le troisieme signe reconnaissable entre tous : c'est
     elle qui manquait. Une chaine de troncons coniques, comme la lame,
     greffee a l'arriere du crane. */
  const queue = new THREE.Group();
  const matCheveux = new THREE.MeshStandardMaterial({ color: 0x1C160E, roughness: 0.55 });
  const SEG = 5;
  for (let i = 0; i < SEG; i++) {
    const t0 = i / SEG;
    const l = 0.11 - t0 * 0.045;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028 * (1 - t0 * 0.55), 0.032 * (1 - t0 * 0.45), l, 6),
      matCheveux
    );
    seg.position.y = -t0 * 0.30 - l / 2;
    // Elle s'ecarte legerement du crane puis retombe, jamais tout a fait droite.
    seg.position.z = 0.05 + Math.sin(t0 * 2.4) * 0.05;
    queue.add(seg);
  }
  queue.position.set(0, REPERES.crane - 0.06, 0.05);
  os.tete.add(queue);

  /* L'ADVERSAIRE, plante la ou ses coups portent — voir plus bas, la
     sequence l'attaque a u=0,67 puis u=0,78. Il lui fait face, de l'autre
     cote de l'axe qu'elle prend une fois retournee. */
  const adversaire = adversaireMasque(palier);
  adversaire.position.set(0.55, 0, -1.95);
  adversaire.rotation.y = Math.PI - 0.35;
  g.add(adversaire);
  const osAdv = adversaire.userData.os;
  const POSE_ADV = adversaire.userData.POSE;
  appliquerPose(osAdv, POSE_ADV.garde);

  /* LE SANG. Antoine : « enormement de sang ». Une gerbe au premier coup,
     puis la FONTAINE — le geyser vertical — au second, celui qui l'acheve.
     Et une mare, pas une tache, qui reste bien apres que tout le reste
     s'est efface. */
  const sangs = [gerbeDeSang(), fontaineDeSang()];
  for (const s of sangs) { s.position.copy(adversaire.position).add(new THREE.Vector3(0, 1.1, 0)); g.add(s); }
  const tache = tacheDeSang();
  tache.position.set(adversaire.position.x, 0.02, adversaire.position.z + 0.3);
  g.add(tache);
  g.userData.poser = (relief) => {
    tache.position.y = relief.hauteur(
      g.position.x + tache.position.x, g.position.z + tache.position.z) - g.position.y + 0.02;
  };

  /* LA SEQUENCE. Antoine : « elle doit bouger, elle doit avoir une
     choregraphie ». La pose de garde tenue jusqu'au bout etait un choix
     assume — mais assume a tort : sans coup porte, une femme en jaune
     immobile ne dit "Kill Bill" a personne. On garde l'arrivee en garde
     (le sursaut, le demi-tour) puis on enchaine deux coups tres differents
     l'un de l'autre, comme le duel au sabre l'a appris : un coup HAUT
     abattu de haut en bas, puis un REVERS remontant de l'autre cote. La
     garde ne revient qu'a la toute fin, desormais GAGNEE par l'action
     plutot que donnee d'emblee. */
  const POSE = {
    dos: {
      brasD: [0.20, 0, 0.22], avantD: [0.55, 0, 0], mainD: [0, 0, -0.3],
      brasG: [0.14, 0, -0.20], avantG: [0.42, 0, 0],
      cuisseD: [-0.06, 0, 0.10], molletD: [0.10, 0, 0],
      cuisseG: [0.10, 0, -0.12], molletG: [-0.18, 0, 0],
      colonne: [0.04, 0, 0], poitrine: [0.02, 0, 0],
    },
    alerte: {
      brasD: [0.30, 0, 0.26], avantD: [0.85, 0, 0], mainD: [0, 0, -0.3],
      brasG: [0.20, 0, -0.24], avantG: [0.60, 0, 0],
      cuisseD: [-0.14, 0, 0.12], molletD: [0.14, 0, 0],
      cuisseG: [0.18, 0, -0.14], molletG: [-0.26, 0, 0],
      colonne: [0.02, -0.28, 0], poitrine: [0, -0.34, 0],
      cou: [0, -0.30, 0], tete: [0, -0.34, 0],
    },
    /* LA GARDE. Le sabre tendu vers l'avant, presque a l'horizontale, les
       deux mains sur la poignee, le corps de trois quarts et le poids en
       arriere. C'est la pose la plus citee du film. */
    garde: {
      brasD: [-1.35, 0, 0.34], avantD: [0.72, 0, 0], mainD: [0.15, 0, 0],
      brasG: [-1.05, 0, -0.52], avantG: [1.05, 0, 0],
      cuisseD: [-0.52, 0, 0.20], molletD: [-0.30, 0, 0], piedD: [0.35, 0, 0],
      cuisseG: [0.46, 0, -0.26], molletG: [-0.42, 0, 0],
      bassin: [0, 0.34, 0], colonne: [0.08, 0.28, 0], poitrine: [0.04, 0.22, 0],
      cou: [-0.06, -0.42, 0], tete: [-0.04, -0.38, 0],
    },
    // LE COUP HAUT : la lame se leve loin derriere l'epaule...
    leve: {
      brasD: [-2.55, 0.30, 0.30], avantD: [0.25, 0, 0], mainD: [0.10, 0, 0],
      brasG: [-1.05, 0, -0.52], avantG: [1.05, 0, 0],
      cuisseD: [-0.30, 0, 0.16], molletD: [-0.20, 0, 0],
      cuisseG: [0.30, 0, -0.18], molletG: [-0.30, 0, 0],
      bassin: [0, 0.10, 0], colonne: [-0.10, 0.10, 0], poitrine: [-0.12, 0.06, 0],
      cou: [-0.04, -0.20, 0], tete: [-0.02, -0.18, 0],
    },
    // ...puis s'abat, le corps en fente, jusqu'au sol de l'autre cote.
    abattu: {
      brasD: [0.55, -0.85, 0.10], avantD: [0.95, 0, 0], mainD: [0.05, 0, 0],
      brasG: [-0.30, 0, -0.10], avantG: [0.40, 0, 0],
      cuisseD: [-0.85, 0, 0.30], molletD: [-0.55, 0, 0], piedD: [0.55, 0, 0],
      cuisseG: [0.15, 0, -0.10], molletG: [-0.15, 0, 0],
      bassin: [0, 0.55, 0], colonne: [0.20, 0.45, 0], poitrine: [0.10, 0.35, 0],
      cou: [-0.10, 0.10, 0], tete: [-0.06, 0.12, 0],
    },
    // LE REVERS : la lame revient bas, de l'autre cote...
    ramene: {
      brasD: [0.10, -0.20, -0.85], avantD: [1.10, 0, 0], mainD: [0, 0, 0.20],
      brasG: [-0.60, 0, -0.30], avantG: [0.70, 0, 0],
      cuisseD: [-0.35, 0, 0.15], molletD: [-0.25, 0, 0],
      cuisseG: [0.10, 0, -0.15], molletG: [-0.20, 0, 0],
      bassin: [0, -0.20, 0], colonne: [-0.05, -0.15, 0], poitrine: [-0.05, -0.10, 0],
    },
    // ...et remonte en un revers qui balaie jusqu'a l'epaule opposee.
    revers: {
      brasD: [-1.70, 0.50, 0.75], avantD: [0.35, 0, 0], mainD: [0.10, 0, 0],
      brasG: [-0.90, 0, -0.45], avantG: [0.85, 0, 0],
      cuisseD: [-0.10, 0, 0.10], molletD: [-0.10, 0, 0],
      cuisseG: [0.45, 0, -0.20], molletG: [-0.35, 0, 0], piedG: [-0.40, 0, 0],
      bassin: [0, -0.30, 0], colonne: [-0.15, -0.30, 0], poitrine: [-0.10, -0.20, 0],
      cou: [0.06, -0.30, 0], tete: [0.04, -0.28, 0],
    },
  };

  /* LE COMBAT DOIT SE JOUER TOT DANS LA FENETRE, ET C'EST UNE MESURE, PAS
     UNE INTUITION.

     La halte suivante tombe a peine six metres apres l'ancre de cette
     scene (193,3 contre 187,4) : des u=0,33 environ, la camera bascule en
     'approche' et se met a cadrer le cadeau de la halte, pas le duel — a
     u=0,67, la ou le coup haut atterrissait, l'ancrage etait deja a
     x=-1,3 a l'ecran et sortait du champ dans la foulee. Toute la
     choregraphie, aussi reussie soit-elle, se jouait donc hors champ.
     Mesure faite avec une vraie marche simulee (pas une reconstitution) :
     le combat entier — demi-tour compris — est donc resserre pour se
     terminer avant u=0,46, largement dans la fenetre ou le cadrage tient
     encore. La garde finale, elle, peut deriver hors champ sans dommage :
     rien n'y bouge plus. */
  const sequence = piste([
    { t: 0.00, pose: POSE.dos },
    { t: 0.10, pose: POSE.dos },
    { t: 0.16, pose: POSE.alerte },
    { t: 0.20, pose: POSE.alerte },
    { t: 0.26, pose: POSE.garde },
    { t: 0.30, pose: POSE.leve },
    { t: 0.34, pose: POSE.abattu },
    { t: 0.36, pose: POSE.abattu },
    { t: 0.39, pose: POSE.ramene },
    { t: 0.42, pose: POSE.revers },
    { t: 0.44, pose: POSE.revers },
    { t: 0.50, pose: POSE.garde },
    { t: 1.00, pose: POSE.garde },
  ]);

  /* L'ADVERSAIRE ENCAISSE LES DEUX COUPS, cale sur les memes instants que
     `sequence` ci-dessus (abattu a t=0,34 ; revers a t=0,42). */
  const sequenceAdv = piste([
    { t: 0.00, pose: POSE_ADV.garde },
    { t: 0.33, pose: POSE_ADV.garde },
    { t: 0.37, pose: POSE_ADV.touche1 },
    { t: 0.40, pose: POSE_ADV.touche1 },
    { t: 0.44, pose: POSE_ADV.chute },
    { t: 1.00, pose: POSE_ADV.chute },
  ]);

  /* Elle commence DE DOS, tournee vers la foret. Le demi-tour se fait sur le
     groupe entier, parce qu'un corps qui pivote autour de sa colonne
     vertebrale sans deplacer ses appuis se lit comme une poupee sur un
     socle. */
  let lameFaite = false;
  let coup1Fait = false, coup2Fait = false;
  let coup1T = 0, coup2T = 0;
  g.userData.reinit = () => {
    lameFaite = false; coup1Fait = false; coup2Fait = false;
    sangs[0].material.opacity = 0; sangs[1].material.opacity = 0;
    for (const m of tache.userData.taches) m.opacity = 0;
    tache.scale.setScalar(1);
  };

  g.userData.jouer = (u, t, camera) => {
    const vis = smoothstep(0, 0.10, u) * smoothstep(1, 0.88, u);
    g.visible = vis > 0.01;
    if (!g.visible) return;

    sequence(os, u);
    /* LA LAME CHANTE QUAND ELLE SE MET EN GARDE, juste avant le premier
       coup : c'est ce qui transforme la pose en un evenement qui annonce
       l'action a venir. Il ne se rejoue pas tant que la fenetre ne s'est
       pas refermee. */
    if (!lameFaite && u > 0.24) { lameFaite = true; g.userData.emettre?.('lame'); }
    // Le demi-tour, cale sur le deuxieme temps de la sequence.
    const tourne = smoothstep(0.12, 0.28, u);
    perso.rotation.y = Math.PI * (1 - tourne) + 0.35 * tourne;
    /* Elle vous suit du regard des qu'elle se met en garde — avant, elle ne
       vous a pas encore vu — et jusqu'au bout du combat : elle se bat pour
       vous, pas pour un adversaire qu'on ne voit jamais. */
    regarderVers(perso, os, camera, smoothstep(0.22, 0.28, u) * 0.85);

    /* Une respiration minuscule quand elle tient la garde, avant et apres
       les coups : sans elle, une pose tenue devient une statue ; avec,
       elle est immobile mais vivante, ce qui n'est pas la meme chose. */
    const tientGarde = smoothstep(0.50, 0.54, u) + (1 - smoothstep(0.26, 0.30, u)) * smoothstep(0.24, 0.26, u);
    const souffle = tientGarde * Math.sin(t * 1.4) * 0.022;
    os.poitrine.rotation.x += souffle;
    os.brasD.rotation.x += souffle * 0.8;
    os.brasG.rotation.x += souffle * 0.8;
    // La queue-de-cheval fouette avec un leger retard sur la tete.
    queue.rotation.x = Math.sin(t * 3.1) * 0.05 - os.tete.rotation.x * 0.35;
    queue.rotation.z = Math.cos(t * 2.3) * 0.04 - os.tete.rotation.y * 0.25;

    // L'adversaire encaisse, recule, tombe — sans jamais bouger de place :
    // c'est elle qui se deplace pour porter les coups, pas lui.
    sequenceAdv(osAdv, u);
    adversaire.position.y = u > 0.435 ? -0.62 * smoothstep(0.435, 0.50, u) : 0;

    /* LES DEUX COUPS. Chacun declenche sa propre gerbe, une seule fois, au
       moment exact ou la lame de `sequence` touche (voir les temps cles
       0,34 et 0,42 ci-dessus). */
    if (!coup1Fait && u > 0.335) { coup1Fait = true; coup1T = t; g.userData.emettre?.('choc'); }
    if (!coup2Fait && u > 0.415) { coup2Fait = true; coup2T = t; g.userData.emettre?.('choc'); }

    /* LE PREMIER COUP : une gerbe large, qui gicle loin et met deux fois
       plus longtemps qu'avant a s'effacer. */
    if (coup1Fait) {
      const dt = t - coup1T;
      const gerbe = sangs[0];
      const pos = gerbe.geometry.attributes.position;
      const dirs = gerbe.userData.dirs;
      for (let i = 0; i < dirs.length; i++) {
        const [dx, dy, dz] = dirs[i];
        const vol = Math.min(dt, 1.1);
        pos.setXYZ(i, dx * vol * 3.0, dy * vol * 2.6 - dt * dt * 2.6, dz * vol * 3.0);
      }
      pos.needsUpdate = true;
      gerbe.userData.mat.opacity = Math.max(0, 1 - dt * 0.75) * vis;
    }
    /* LE SECOND, LE COUP FATAL : LA FONTAINE. Un jet vertical qui monte,
       retombe, et pulse encore une fois avant de s'eteindre — c'est ce
       second sursaut qui fait « geyser » plutot que « fuite ». */
    if (coup2Fait) {
      const dt = t - coup2T;
      const gerbe = sangs[1];
      const pos = gerbe.geometry.attributes.position;
      const dirs = gerbe.userData.dirs;
      const dephasages = gerbe.userData.dephasages;
      for (let i = 0; i < dirs.length; i++) {
        const [dx, dy, dz] = dirs[i];
        // Un second pouls, decale, pour que le jet retombe puis reparte.
        const local = Math.max(0, dt - dephasages[i] * 0.35);
        const vol = Math.min(local, 0.85);
        pos.setXYZ(i, dx * vol * 2.2, dy * vol * 4.4 - local * local * 3.4, dz * vol * 2.2);
      }
      pos.needsUpdate = true;
      gerbe.userData.mat.opacity = Math.max(0, 1 - dt * 0.55) * vis;

      // La mare s'etale largement une fois au sol, et y reste jusqu'a la fin.
      const depuis = clamp((t - coup2T) * 0.42, 0, 1);
      for (const m of tache.userData.taches) m.opacity = depuis * 0.88 * vis;
      tache.scale.setScalar(0.25 + depuis * 1.9);
    }
  };
  return g;
}

export function coutKillBill() {
  return _corpsKB ? { triangles: _corpsKB.triangles, sommets: _corpsKB.sommets } : null;
}

/* ==========================================================================
   3. SHINING

   Antoine : « je veux aussi une reference a Shining ». L'image la plus
   citee du film n'est pas une action, c'est une IMMOBILITE : deux
   fillettes identiques, robe bleue, main dans la main, qui ne bougent pas
   et regardent. Aucune choregraphie ne pourrait la rendre plus inquietante
   — c'est le meme principe que le trio de Spider-Man qui pointait du
   doigt, pousse plus loin : ici, rien ne bouge JAMAIS, pas meme un souffle,
   jusqu'a ce qu'elles tournent la tete d'un seul mouvement, ensemble.

   Une flaque sombre grandit lentement a leurs pieds — jamais expliquee,
   jamais commentee, elle est juste LA, comme dans le couloir de l'hotel.
   ========================================================================== */
const ROBE_JUMELLE = new THREE.Color(0x8FA8C4);
const PEAU_JUMELLE = new THREE.Color(0xDCC0A6);
const CHEVEUX_JUMELLE = new THREE.Color(0x241C14);

function teinteJumelle(x, y, z, c, os) {
  if (os === 'piedD' || os === 'piedG' || os === 'molletD' || os === 'molletG') {
    c.setHex(0xEDEDE8); // chaussettes et chaussures blanches
    return;
  }
  if (os === 'tete') {
    if (y > REPERES.crane - 0.06 || (z > 0.01 && y > REPERES.menton - 0.01)) {
      c.copy(CHEVEUX_JUMELLE);
      return;
    }
    c.copy(PEAU_JUMELLE);
    return;
  }
  c.copy(ROBE_JUMELLE);
  void x;
}

let _corpsJumelle = null;

function jumelle(palier) {
  if (!_corpsJumelle) {
    _corpsJumelle = construireCorps(palier, {
      teinter: teinteJumelle,
      // Une fillette, pas une adulte reduite : le rapport compte plus que
      // l'echelle qui suit.
      gabarit: { carrure: 0.74, masse: 0.68 },
      pas: palier.nom === 'bas' ? 0.032 : palier.nom === 'moyen' ? 0.024 : 0.020,
    });
  }
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.80, metalness: 0.0,
    emissive: new THREE.Color(0x08090C), emissiveIntensity: 1,
  });
  const perso = nouvelleInstance(_corpsJumelle, mat, { ombres: palier.ombres });
  perso.scale.setScalar(0.70);
  const os = perso.userData.os;
  // Debout, bras le long du corps, les mains a peine tournees vers
  // l'interieur — la main dans la main, sans qu'on ait besoin de la
  // modeliser vraiment : la proximite suffit a le faire lire.
  appliquerPose(os, {
    brasD: [-0.06, 0, 0.06], avantD: [0.08, 0, 0],
    brasG: [-0.06, 0, -0.06], avantG: [0.08, 0, 0],
  });
  return perso;
}

/* L'ASCENSEUR. La seconde image la plus citee du film, et la plus demandee
   par Antoine : les portes en laiton s'ouvrent sur un noir complet, et le
   sang jaillit du sol par vagues plutot que par une seule gerbe — un
   DELUGE qui continue de couler tant que les portes restent ouvertes,
   pas une explosion ponctuelle comme celle de Kill Bill. Il se dresse
   derriere les jumelles : on les regarde d'abord, et c'est lui qui se
   revele une fois qu'elles ont fini de nous fixer. */
function ascenseurOverlook() {
  const g = new THREE.Group();
  const cage = new THREE.Group();
  cage.position.y = -3.6; // sous le sol, avant de monter
  g.add(cage);

  const matCadre = new THREE.MeshStandardMaterial({ color: 0x241A10, roughness: 0.62, metalness: 0.22 });
  const cadre = new THREE.Mesh(new THREE.BoxGeometry(2.7, 3.5, 0.24), matCadre);
  cadre.position.y = 1.75;
  cage.add(cadre);

  // Le noir du puits, derriere les portes — rien a y voir avant qu'elles
  // ne s'ecartent.
  const matNoir = new THREE.MeshBasicMaterial({ color: 0x030202 });
  const trou = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 3.05), matNoir);
  trou.position.set(0, 1.72, 0.09);
  cage.add(trou);

  // Deux vantaux de laiton qui coulissent horizontalement, comme au film.
  const matPorte = new THREE.MeshStandardMaterial({ color: 0xAD8A47, roughness: 0.30, metalness: 0.80 });
  const porteD = new THREE.Mesh(new THREE.BoxGeometry(1.08, 3.10, 0.10), matPorte);
  const porteG = porteD.clone();
  porteD.position.set(0.54, 1.72, -0.10);
  porteG.position.set(-0.54, 1.72, -0.10);
  cage.add(porteD, porteG);

  g.userData.cage = cage;
  g.userData.porteD = porteD;
  g.userData.porteG = porteG;
  return g;
}

/* LE DELUGE. Contrairement a la gerbe d'un coup unique, chaque particule
   reboucle sur son propre cycle : le flot ne s'arrete jamais tant que
   l'enveloppe qui pilote son opacite reste ouverte, ce qui est exactement
   ce qu'un DELUGE doit faire et qu'une explosion ponctuelle ne peut pas. */
function delugeSang(N = 260) {
  const pos = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: grainRond(), alphaTest: 0.02, color: 0x9C0D12, size: 0.27,
    transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  const N_ = N;
  const phase = Float32Array.from({ length: N_ }, () => Math.random());
  const cycle = Float32Array.from({ length: N_ }, () => 0.55 + Math.random() * 0.45);
  const ox = Float32Array.from({ length: N_ }, () => (Math.random() - 0.5) * 1.9);
  const haut = Float32Array.from({ length: N_ }, () => 0.5 + Math.random() * 0.9);
  const portee = Float32Array.from({ length: N_ }, () => 3.4 + Math.random() * 4.2);
  pts.userData = { mat, phase, cycle, ox, haut, portee };
  return pts;
}

export function shining(palier) {
  const g = new THREE.Group();
  const gauche = jumelle(palier);
  const droite = jumelle(palier);
  gauche.position.x = -0.34;
  droite.position.x = 0.34;
  g.add(gauche, droite);
  const paires = [[gauche, gauche.userData.os], [droite, droite.userData.os]];

  // Une flaque qui grandit sous elles, sombre, jamais expliquee.
  const tache = tacheDeSang();
  tache.position.set(0, 0.02, 0.35);
  tache.scale.setScalar(0.55);
  g.add(tache);

  // L'ascenseur, plante derriere elles — on ne le decouvre qu'une fois
  // qu'elles ont fini de nous regarder.
  const ascenseur = ascenseurOverlook();
  ascenseur.position.set(0, 0, 2.35);
  g.add(ascenseur);
  const { cage, porteD, porteG } = ascenseur.userData;
  const PORTE_D_FERMEE = porteD.position.x, PORTE_D_OUVERTE = PORTE_D_FERMEE + 1.05;
  const PORTE_G_FERMEE = porteG.position.x, PORTE_G_OUVERTE = PORTE_G_FERMEE - 1.05;

  // Enfant de l'ascenseur, et non de la scene : il herite ainsi la
  // correction de sol de `poser` sans qu'on ait a la dupliquer.
  const deluge = delugeSang();
  deluge.position.set(0, 0, -0.10); // le seuil des portes
  ascenseur.add(deluge);

  // La mare qui grossit au pied de l'ascenseur — bien plus vaste que celle
  // des jumelles, puisque c'est elle qui recueille tout le deluge. Enfant
  // de l'ascenseur pour la meme raison que le deluge : elle herite sa
  // correction de sol au lieu d'en refaire une, approximative, a part.
  const flaqueAsc = tacheDeSang();
  flaqueAsc.position.set(0, 0.015, -0.55);
  flaqueAsc.scale.setScalar(0.4);
  ascenseur.add(flaqueAsc);

  g.userData.poser = (relief) => {
    const solIci = relief.hauteur(g.position.x, g.position.z) - g.position.y;
    tache.position.y = solIci + 0.02;
    ascenseur.position.y = solIci;
  };

  /* LE NEON QUI FAIBLIT. Une lumiere blanche et froide, au-dessus d'elles,
     qui vacille par a-coups irreguliers — jamais un clignotement
     mecanique et regulier, qui se lirait comme un defaut de rendu plutot
     que comme un tube qui va lacher. */
  const neon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: lueurDiffuse(), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  }));
  neon.material.color.setRGB(2.1, 2.3, 2.6);
  neon.scale.setScalar(2.4);
  neon.position.set(0, 2.5, -0.2);
  g.add(neon);

  let clacFait = false;
  g.userData.reinit = () => {
    clacFait = false;
    cage.position.y = -3.6;
    porteD.position.x = PORTE_D_FERMEE;
    porteG.position.x = PORTE_G_FERMEE;
    deluge.userData.mat.opacity = 0;
    for (const m of flaqueAsc.userData.taches) m.opacity = 0;
    flaqueAsc.scale.setScalar(0.4);
    g.userData.assombritDyn = 0;
    g.userData.teinteForceDyn = 0;
  };

  g.userData.jouer = (u, t, camera) => {
    const vis = smoothstep(0, 0.08, u) * smoothstep(1, 0.90, u);
    g.visible = vis > 0.01;
    if (!g.visible) return;

    /* LE VACILLEMENT DU NEON. Une somme de sinus a des frequences non
       multiples les unes des autres ne se repete jamais a l'identique sur
       la duree de la scene — c'est ce qui empeche l'oeil de deviner le
       rythme, et donc de s'y habituer. */
    const tremble = Math.sin(t * 11) * Math.sin(t * 3.7) > 0.55 ? 0.15 : 1.0;
    neon.material.opacity = vis * 0.42 * tremble;

    // La flaque des jumelles grandit tout au long du passage, tres lentement.
    const etale = smoothstep(0, 1, u);
    for (const m of tache.userData.taches) m.opacity = vis * (0.20 + etale * 0.55);
    tache.scale.setScalar(0.4 + etale * 1.1);

    /* L'IMMOBILITE, JUSQU'AU REGARD. Rien ne bouge — ni respiration, ni
       balancement — jusqu'a ce battement bref ou les deux tournent la tete
       EXACTEMENT ensemble. C'est cette synchronisation parfaite, plus que
       le mouvement lui-meme, qui derange : deux individus ne font jamais
       exactement la meme chose au meme instant, sauf dans ce film. */
    const regarde = smoothstep(0.40, 0.48, u) * smoothstep(0.66, 0.58, u);
    for (const [racine, os] of paires) regarderVers(racine, os, camera, regarde);

    /* L'ASCENSEUR MONTE, LES PORTES S'OUVRENT. Juste apres que les jumelles
       ont fini de nous fixer : on n'a pas encore quitte des yeux leur
       regard qu'un bruit de mecanique se fait deja sentir derriere elles. */
    const monte = smoothstep(0.46, 0.58, u);
    cage.position.y = -3.6 * (1 - monte);
    const ouvre = smoothstep(0.58, 0.70, u);
    porteD.position.x = PORTE_D_FERMEE + (PORTE_D_OUVERTE - PORTE_D_FERMEE) * ouvre;
    porteG.position.x = PORTE_G_FERMEE + (PORTE_G_OUVERTE - PORTE_G_FERMEE) * ouvre;
    if (!clacFait && ouvre > 0.97) { clacFait = true; g.userData.emettre?.('choc', 1); }

    /* LE DELUGE. Il jaillit du seuil des portes et coule vers nous — pas
       une explosion instantanee, un FLOT continu tant que l'enveloppe
       reste ouverte. Chaque particule reboucle sur son propre cycle, donc
       le jet ne s'epuise ni ne se repete jamais a l'identique. */
    const gush = smoothstep(0.68, 0.78, u) * smoothstep(0.97, 0.85, u);
    deluge.userData.mat.opacity = vis * gush * 0.95;
    if (gush > 0.01) {
      const du = deluge.userData;
      const pos = deluge.geometry.attributes.position;
      for (let i = 0; i < du.phase.length; i++) {
        const cyc = ((t * 0.85) / du.cycle[i] + du.phase[i]) % 1;
        const x = du.ox[i] * (0.25 + 0.75 * cyc);
        const z = -cyc * du.portee[i];
        const y = Math.max(0.05, 0.20 + Math.sin(cyc * Math.PI) * 1.15 * du.haut[i] - cyc * cyc * 0.55);
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
    }

    // La mare de l'ascenseur, qui engloutit tout l'espace devant les portes.
    const etaleAsc = smoothstep(0.64, 1.0, u);
    for (const m of flaqueAsc.userData.taches) m.opacity = vis * (0.15 + etaleAsc * 0.78);
    flaqueAsc.scale.setScalar(0.4 + etaleAsc * 3.6);

    /* L'ECRAN LUI-MEME EST ENVAHI. La scene ecrit ces deux valeurs dans son
       propre userData ; c'est `Apparitions.maj` qui les relit et les
       transmet au post-traitement — voir la-bas pour le pourquoi de cette
       indirection. */
    g.userData.assombritDyn = smoothstep(0.70, 0.80, u) * smoothstep(0.97, 0.87, u) * 0.60 * vis;
    g.userData.teinteDyn = 0x6B0E12;
    g.userData.teinteForceDyn = smoothstep(0.72, 0.83, u) * smoothstep(0.97, 0.89, u) * 0.55 * vis;
  };
  return g;
}

export function coutJumelles() {
  return _corpsJumelle ? { triangles: _corpsJumelle.triangles, sommets: _corpsJumelle.sommets } : null;
}
