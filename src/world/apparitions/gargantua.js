import * as THREE from 'three';
import { smoothstep } from '../../core/noise.js';

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
