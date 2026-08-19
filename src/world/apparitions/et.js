import * as THREE from 'three';
import { lueurDiffuse } from '../../core/dot.js';
import { smoothstep, clamp } from '../../core/noise.js';

/* ==========================================================================
   3. E.T. DEVANT LA LUNE

   Le plan le plus cite du cinema, et il ne coute qu'une silhouette noire :
   un velo, deux passagers, un panier. Tout tient dans le CONTOUR — c'est
   d'ailleurs ainsi que le plan est filme, entierement a contre-jour.

   La silhouette se place sur la direction de la lune et suit la camera, de
   sorte qu'elle passe toujours devant le disque, quel que soit l'endroit du
   chemin ou la scene se declenche.
   ========================================================================== */
function siluetteVelo() {
  const n = 256;
  const cv = document.createElement('canvas');
  cv.width = n; cv.height = Math.round(n * 0.62);
  const c = cv.getContext('2d');
  c.clearRect(0, 0, cv.width, cv.height);
  c.strokeStyle = '#000'; c.fillStyle = '#000';
  c.lineCap = 'round'; c.lineJoin = 'round';

  const R = 34, yR = 108;                    // roues
  c.lineWidth = 7;
  for (const cx of [66, 190]) {
    c.beginPath(); c.arc(cx, yR, R, 0, Math.PI * 2); c.stroke();
  }
  // Cadre
  c.lineWidth = 9;
  c.beginPath();
  c.moveTo(66, yR); c.lineTo(112, 62); c.lineTo(168, 62);
  c.lineTo(190, yR); c.lineTo(112, yR); c.lineTo(112, 62);
  c.stroke();
  // Guidon et selle
  c.lineWidth = 8;
  c.beginPath(); c.moveTo(168, 62); c.lineTo(186, 44); c.stroke();
  c.beginPath(); c.moveTo(112, 62); c.lineTo(104, 46); c.stroke();
  c.fillRect(92, 40, 26, 9);
  // Panier a l'avant, avec la petite tete dedans
  c.fillRect(176, 46, 30, 22);
  c.beginPath(); c.arc(191, 40, 11, 0, Math.PI * 2); c.fill();
  // Le cycliste : buste penche, jambes pliees, tete
  c.lineWidth = 13;
  c.beginPath(); c.moveTo(112, 58); c.lineTo(138, 30); c.stroke();
  c.beginPath(); c.arc(146, 22, 15, 0, Math.PI * 2); c.fill();
  c.lineWidth = 10;
  c.beginPath(); c.moveTo(138, 34); c.lineTo(170, 48); c.stroke();   // bras
  c.beginPath(); c.moveTo(118, 62); c.lineTo(126, 92); c.lineTo(112, yR); c.stroke();

  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: t, transparent: true, opacity: 0, color: 0x05070B,
    depthWrite: false, fog: false, side: THREE.DoubleSide,
  });
  const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.62), mat);
  q.renderOrder = 3;
  return q;
}

export function etDevantLaLune(chemin) {
  const g = new THREE.Group();

  /* SA PROPRE LUNE, ET C'EST UNE DECISION MESUREE.

     L'idee de depart etait de faire passer la silhouette devant la vraie
     lune du ciel. Mesure faite le long de tout le chemin : la lune est dans
     une direction FIXE du monde, le chemin serpente, et l'ecart entre l'axe
     de la camera et la lune ne descend jamais sous 30° — bien au-dela du
     champ, surtout en portrait, et l'eclat de la vraie lune (un lobe
     specular a la puissance soixante-deux dans le nuanceur du ciel) s'y
     eteint de toute facon completement. Elle n'est donc JAMAIS visible
     pendant la balade. Une silhouette noire sur un ciel noir n'aurait rien
     donne.

     La scene porte donc son propre disque, pose devant la camera. */
  const disque = new THREE.Sprite(new THREE.SpriteMaterial({
    map: lueurDiffuse(), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  disque.material.color.setRGB(1.35, 1.32, 1.12);
  disque.scale.setScalar(58);
  disque.renderOrder = 2;
  g.add(disque);

  const velo = siluetteVelo();
  velo.scale.setScalar(13);
  g.add(velo);

  g.userData.suitCamera = true;

  /* ANTOINE, DEUX FOIS : « la lune bouge toujours avec la camera, et en
     plus ca fait deux lunes ». Le premier correctif figeait la position au
     moment ou la fenetre s'ouvre — mais il la calculait a partir de la
     direction INSTANTANEE de la camera a cet instant precis, et cet
     instant tombe parfois pendant une transition (approche d'une halte,
     ajustement du cadrage) ou cette direction n'est pas stable d'une image
     a l'autre. Un simple decalage d'une image dans le declenchement du gel
     suffit alors a figer la lune a un endroit legerement different a
     chaque essai — ce qui, revu comme un « saut », se lit comme deux lunes
     distinctes plutot qu'une derive.

     LA VRAIE CORRECTION : ne plus jamais interroger la camera pour
     PLACER la lune. On se sert du CHEMIN — fixe, connu d'avance, identique
     a chaque image — pour batir un repere stable a l'endroit ou la scene
     s'ouvre, une fois pour toutes. La camera ne sert plus qu'a orienter le
     disque face a elle (un panneau plat vu de travers se lit comme une
     lame) et a le faire naitre au bon moment ; plus jamais a le DEPLACER. */
  const p = new THREE.Vector3(), tan = new THREE.Vector3(), cote = new THREE.Vector3();
  let calcule = false;
  const posLune = new THREE.Vector3();
  g.userData.reinit = () => { calcule = false; };

  g.userData.jouer = (u, t, camera, sAncre) => {
    const vis = smoothstep(0, 0.16, u) * smoothstep(1, 0.80, u);
    disque.material.opacity = vis * 0.55;
    velo.material.opacity = vis * 0.98;
    g.visible = vis > 0.01;
    if (!camera) return;

    if (!calcule) {
      /* Devant l'axe general du chemin a cet endroit, haut dans le ciel,
         assez loin pour etre derriere toute la foret : la silhouette doit
         se detacher sur le disque, jamais sur des branches. */
      chemin.point(sAncre, p);
      chemin.tangente(sAncre, tan);
      chemin.cote(sAncre, cote);
      const D = 265;
      posLune.copy(p).addScaledVector(tan, D).addScaledVector(cote, -50);
      /* HAUTEUR MESUREE, PAS DEVINEE. A 62 m pour 240 de distance, cela
         faisait 14,5° d'elevation — et comme le drone pique legerement vers
         le cerf, le disque sortait par le haut du cadre. A 34 m pour 265,
         on est a 7,3°, ce qui le pose au-dessus de la ligne d'arbres sans
         jamais toucher le bord. Le drone vole une dizaine de metres
         au-dessus du chemin : on part donc de la hauteur DU CHEMIN, pas de
         celle, instable, de la camera. */
      posLune.y = p.y + 39;
      calcule = true;
    }
    g.position.copy(posLune);
    g.lookAt(camera.position);

    /* LA BOUCLE. Antoine : « je veux qu'elle exerce une boucle ». Le velo
       ne faisait que GLISSER a plat devant le disque ; le plan du film,
       lui, est un bond — la roue avant se souleve, l'engin monte, retombe.
       Meme course horizontale qu'avant (le disque mesure cinquante-huit
       unites de large, son coeur clair une quinzaine ; vingt-six fait
       traverser le velo devant l'astre lui-meme), mais desormais avec une
       vraie trajectoire d'arc par-dessus, et le cadre qui suit l'inclinaison
       du saut. */
    const av = clamp(u, 0, 1);
    const arc = Math.sin(av * Math.PI);
    velo.position.set((av - 0.5) * 26, 1.4 + arc * 4.2, 1);
    velo.rotation.z = (0.5 - av) * 0.9;
  };
  return g;
}
