import * as THREE from 'three';
import { smoothstep, clamp } from '../../core/noise.js';
import {
  REPERES, construireCorps, nouvelleInstance, appliquerPose, regarderVers,
} from '../humanoide.js';
import { halo, buee, majBuee } from './communs.js';

/* ==========================================================================
   8. SEUL A LA MAISON

   Antoine : « trois Spider-Man c'est trop, rajoute une reference a un
   autre film connu ». Le triangle de Spider-Man qui se pointent du doigt
   est retire (deux passages du personnage suffisent, et le troisieme
   citait surtout un mème) ; a sa place, la pose la plus reconnaissable du
   cinema familial de Noel — les deux mains plaquees sur les joues, la
   bouche grande ouverte. Un enfant seul, en pleine neige, qui hurle sans
   bruit : ca n'a besoin d'aucun visage pour se reconnaitre, seulement de
   ce geste-la.

   CETTE PASSE-CI, SUR LA DEMANDE D'ENRICHIR CHAQUE APPARITION : le titre
   du film dit « a la maison », et jusqu'ici rien dans le decor ne le
   racontait — un enfant seul dans la neige, sans plus de contexte, aurait
   tout aussi bien pu etre perdu en foret. Un fragment de facade derriere
   lui — porche, porte, fenetre allumee, guirlande — ancre enfin la scene
   dans SA maison, celle qu'il est cense garder. */
const BEIGE_PULL = new THREE.Color(0xC9A876);
const RAYURE_PULL = new THREE.Color(0x8A2E28);
const PANTALON_SOMBRE = new THREE.Color(0x262B33);
const PEAU_CLAIRE = new THREE.Color(0xD8B48C);

function teinteKevin(x, y, z, c, os) {
  if (os === 'piedD' || os === 'piedG') { c.setHex(0x1B1E24); return; }
  const jambe = os === 'cuisseD' || os === 'cuisseG' || os === 'molletD' || os === 'molletG';
  if (jambe) { c.copy(PANTALON_SOMBRE); return; }
  if (os === 'tete') {
    /* Le bonnet, sur le dessus et l'arriere du crane ; le visage, dans
       l'ombre, en dessous — la meme logique de coupe par la normale que
       la chevelure de Kill Bill, ici sur un bonnet plutot qu'un carre. */
    if (y > REPERES.crane - 0.05 || (z > 0.01 && y > REPERES.menton)) { c.setHex(0xB23B3B); return; }
    c.copy(PEAU_CLAIRE);
    return;
  }
  /* LE PULL RAYE. Un aplat beige uniforme se lisait comme un vetement de
     synthese ; deux rayures horizontales, peintes par position plutot que
     par une texture, suffisent a en faire un pull tricote sans le moindre
     cout de plus. */
  const buste = os === 'colonne' || os === 'poitrine' || os === 'brasD' || os === 'brasG'
             || os === 'avantD' || os === 'avantG';
  if (buste && (Math.abs(y - REPERES.nombril - 0.10) < 0.018
             || Math.abs(y - REPERES.cotes + 0.02) < 0.018)) {
    c.copy(RAYURE_PULL);
    return;
  }
  c.copy(BEIGE_PULL);
  void x; void z;
}

/* LA POSE. Les deux bras montent haut et se replient fort — les mains
   viennent aux joues, les coudes ecartes — c'est exactement la silhouette
   de l'affiche, jusque dans l'asymetrie legere qui empeche une symetrie
   parfaite de se lire comme une pose de mannequin. */
const POSE_KEVIN = {
  brasD: [-2.00, 0.15, 0.22], avantD: [-1.85, 0, 0], mainD: [0, 0, 0.15],
  brasG: [-2.10, -0.12, -0.20], avantG: [-1.90, 0, 0], mainG: [0, 0, -0.15],
  cuisseD: [-0.04, 0, 0.05], molletD: [0.06, 0, 0],
  cuisseG: [0.04, 0, -0.05], molletG: [0.06, 0, 0],
  colonne: [-0.10, 0, 0], poitrine: [-0.16, 0, 0],
  cou: [0.10, 0, 0], tete: [0.18, 0, 0],
};

/* --------------------------------------------------------------------------
   LE PORCHE.

   Un fragment de facade, pas la maison entiere : on ne voit jamais plus
   que ce qu'un porche donne a voir depuis la neige devant lui — un pan de
   bardage, une porte, une fenetre allumee a l'etage, l'auvent et sa
   guirlande. Suffisamment reconnaissable, suffisamment leger pour tenir
   dans le degagement de la scene sans jamais s'approcher de l'enfant.
   -------------------------------------------------------------------------- */
function porcheMaison() {
  const g = new THREE.Group();

  const matBardage = new THREE.MeshStandardMaterial({ color: 0x8A6B4A, roughness: 0.85 });
  const matPorte = new THREE.MeshStandardMaterial({ color: 0x3A2418, roughness: 0.6 });
  const matCadre = new THREE.MeshStandardMaterial({ color: 0xE8E2D4, roughness: 0.7 });
  const matAuvent = new THREE.MeshStandardMaterial({ color: 0x5A4028, roughness: 0.8 });

  const mur = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.2, 0.18), matBardage);
  mur.position.set(0, 1.6, 0);
  g.add(mur);

  const porte = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.95, 0.06), matPorte);
  porte.position.set(-0.55, 0.98, 0.10);
  g.add(porte);
  const cadrePorte = new THREE.Mesh(new THREE.BoxGeometry(0.98, 2.10, 0.05), matCadre);
  cadrePorte.position.set(-0.55, 1.05, 0.06);
  g.add(cadrePorte);
  const poignee = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 6, 5),
    new THREE.MeshStandardMaterial({ color: 0xC9A24A, roughness: 0.3, metalness: 0.7 })
  );
  poignee.position.set(-0.20, 0.95, 0.14);
  g.add(poignee);

  /* LA COURONNE DE NOEL, sur la porte — le detail qui acheve de dire
     « c'est Noel » sans avoir besoin d'un sapin de plus. Un tore de
     branchage sombre et un noeud rouge, rien de plus : a cette distance,
     c'est tout ce qu'une couronne a besoin d'etre. */
  const couronne = new THREE.Mesh(
    new THREE.TorusGeometry(0.145, 0.032, 6, 14),
    new THREE.MeshStandardMaterial({ color: 0x2E4A28, roughness: 0.85 })
  );
  couronne.position.set(-0.55, 1.35, 0.135);
  g.add(couronne);
  const noeud = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 6, 5),
    new THREE.MeshStandardMaterial({ color: 0x9C1A1A, roughness: 0.5 })
  );
  noeud.scale.set(1, 0.7, 0.6);
  noeud.position.set(-0.55, 1.49, 0.14);
  g.add(noeud);

  /* LES MARCHES DU PERRON. Sans elles, le mur semblait planté a meme la
     neige plutot que porte par un vrai porche — trois degres suffisent a
     donner cette assise. */
  const matMarche = new THREE.MeshStandardMaterial({ color: 0x6B6258, roughness: 0.9 });
  for (let i = 0; i < 3; i++) {
    const large = 1.5 - i * 0.16;
    const marche = new THREE.Mesh(new THREE.BoxGeometry(large, 0.10, 0.32 - i * 0.02), matMarche);
    marche.position.set(-0.55, 0.05 + i * 0.10, 0.30 + i * 0.20);
    g.add(marche);
  }

  /* LA FENETRE ALLUMEE. Une plaque emissive tres simple — un vitrage
     chauffe de l'interieur suffit a dire « quelqu'un est cense etre la »,
     et c'est precisement le vide que la scene raconte. */
  const matVitre = new THREE.MeshBasicMaterial({ color: 0xFFD9A0 });
  const vitre = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.78), matVitre);
  vitre.position.set(0.75, 1.95, 0.095);
  g.add(vitre);
  const cadreVitre = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.88, 0.04), matCadre);
  cadreVitre.position.set(0.75, 1.95, 0.07);
  g.add(cadreVitre);
  // Une croisee, deux barres fines, pour que la fenetre se lise comme un
  // vrai chassis et non comme un simple carre lumineux.
  for (const rot of [0, Math.PI / 2]) {
    const barre = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.78, 0.02), matCadre);
    barre.rotation.z = rot;
    barre.position.set(0.75, 1.95, 0.10);
    g.add(barre);
  }
  const lueurFenetre = halo([1.0, 0.72, 0.35], 1.6, 1.1);
  lueurFenetre.position.set(0.75, 1.95, 0.30);
  g.add(lueurFenetre);

  // L'auvent du porche, au-dessus de la porte.
  const auvent = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.10, 0.55), matAuvent);
  auvent.position.set(-0.55, 2.15, 0.30);
  g.add(auvent);

  /* LA GUIRLANDE. Une chaine de petites lumieres chaudes qui pendent en
     legere caténaire sous l'auvent — le detail qui dit « Noel » sans
     avoir besoin d'un sapin de plus dans cette foret qui en compte deja
     des centaines. */
  const N_GUIRLANDE = 9;
  const ampoules = [];
  const matAmpoule = new THREE.MeshBasicMaterial({ color: 0xFFC060 });
  for (let i = 0; i < N_GUIRLANDE; i++) {
    const t0 = i / (N_GUIRLANDE - 1);
    const x = -1.30 + t0 * 1.5;
    const affaissement = Math.sin(t0 * Math.PI) * 0.09;
    const ampoule = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), matAmpoule);
    ampoule.position.set(x, 2.08 - affaissement, 0.34);
    g.add(ampoule);
    ampoules.push(ampoule);
  }

  g.userData.ampoules = ampoules;
  g.userData.lueurFenetre = lueurFenetre;
  g.userData.matVitre = matVitre;
  return g;
}

function majPorche(porche, t, vis) {
  const { ampoules, lueurFenetre, matVitre } = porche.userData;
  // Chaque ampoule scintille sur son propre rythme — une guirlande dont
  // toutes les lumieres pulsent a l'unisson se lit comme un seul objet
  // anime, pas comme une vraie chaine de petites lampes independantes.
  for (let i = 0; i < ampoules.length; i++) {
    const scint = 0.6 + 0.4 * Math.sin(t * 3.1 + i * 1.7);
    ampoules[i].material.color.setRGB(1.0 * scint, 0.75 * scint, 0.38 * scint);
  }
  // La fenetre vacille tres legerement, comme un poste de television
  // allume seul dans une piece vide.
  const flicker = 0.88 + Math.sin(t * 9.0) * 0.06 + Math.sin(t * 21.0 + 3) * 0.04;
  matVitre.color.setRGB(1.0 * flicker, 0.85 * flicker, 0.63 * flicker);
  lueurFenetre.material.opacity = vis * 0.55;
}

/* LA BUEE — `buee()`/`majBuee()`, importees de `communs.js`. Nee ici
   (« il tremble de froid » etait deja ecrit dans ce fichier avant cette
   session, mais rien ne le PROUVAIT visuellement — un enfant qui tremble
   sans jamais souffler un nuage, par une nuit visiblement glaciale,
   contredit ce que la scene raconte deja), puis remontee des que le
   theropode de Jurassic Park en a eu besoin a son tour. */

let _corpsKevin = null;

export function seulALaMaison(palier) {
  const g = new THREE.Group();
  if (!_corpsKevin) {
    _corpsKevin = construireCorps(palier, {
      teinter: teinteKevin,
      // Une charpente plus menue : c'est ce rapport, avant toute echelle,
      // qui fait lire un enfant plutot qu'un adulte reduit.
      gabarit: { carrure: 0.80, masse: 0.76 },
      pas: palier.nom === 'bas' ? 0.032 : palier.nom === 'moyen' ? 0.024 : 0.020,
    });
  }
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.78, metalness: 0.0,
    emissive: new THREE.Color(0x0A0806), emissiveIntensity: 1,
  });
  const perso = nouvelleInstance(_corpsKevin, mat, { ombres: palier.ombres });
  // Et une echelle plus petite encore, par-dessus le gabarit : a vingt
  // metres et de nuit, c'est elle qui achieve de le distinguer d'un adulte.
  perso.scale.setScalar(0.82);
  g.add(perso);

  const os = perso.userData.os;
  appliquerPose(os, POSE_KEVIN);

  // Le porche, plante derriere lui — legerement decale pour ne jamais le
  // recouvrir, jamais assez pres pour concurrencer sa silhouette.
  const porche = porcheMaison();
  porche.position.set(0.35, 0, 2.7);
  g.add(porche);

  /* La buee, greffee pres de la bouche : elle suit donc la tete quand elle
     tremble et se tourne, sans aucun calcul de position supplementaire. */
  const nuage = buee();
  nuage.position.set(0, REPERES.menton - REPERES.crane + 0.04, -0.16);
  os.tete.add(nuage);

  /* LE RYTHME DU SOUFFLE. Une sequence d'intervalles fixe plutot qu'un
     tirage aleatoire : deux visites de la balade doivent montrer le meme
     souffle au meme instant, sans quoi rien de ce qui touche au temps
     n'est plus verifiable a l'image (voir la meme regle pour l'ordre des
     echanges du duel de sabres). Les intervalles ne sont pourtant pas
     uniformes — c'est cette irregularite, et non un vrai hasard, qui
     empeche le souffle de se lire comme un metronome. */
  const INTERVALLES_SOUFFLE = [0.85, 1.35, 0.65, 1.55, 1.05, 0.95];
  let indexSouffle = 0;
  let dernierSouffleT = -999;
  let prochainSouffleT = 0;
  let souffleAmorce = false;

  g.userData.reinit = () => {
    souffleAmorce = false;
    dernierSouffleT = -999;
    nuage.material.opacity = 0;
  };

  g.userData.jouer = (u, t, camera) => {
    const vis = smoothstep(0, 0.10, u) * smoothstep(1, 0.88, u);
    g.visible = vis > 0.01;
    if (!g.visible) return;

    /* IL TREMBLE — de froid, de peur, ou des deux a la fois. Sans ce
       battement rapide et minuscule, la pose la plus celebre du cinema
       familial de Noel devient une statue de cire plantee dans la neige. */
    const tremble = Math.sin(t * 14) * 0.035 + Math.sin(t * 23 + 1.7) * 0.02;
    os.brasD.rotation.z += tremble;
    os.brasG.rotation.z -= tremble;
    os.tete.rotation.z += tremble * 0.6;

    // Il vous voit passer, et son hurlement silencieux se tourne vers vous.
    regarderVers(perso, os, camera, smoothstep(0.18, 0.34, u) * 0.85);

    if (!souffleAmorce) { souffleAmorce = true; prochainSouffleT = t + INTERVALLES_SOUFFLE[0]; }
    if (t > prochainSouffleT) {
      dernierSouffleT = t;
      indexSouffle = (indexSouffle + 1) % INTERVALLES_SOUFFLE.length;
      prochainSouffleT = t + INTERVALLES_SOUFFLE[indexSouffle];
    }
    majBuee(nuage, t, dernierSouffleT, vis);

    majPorche(porche, t, vis);
  };
  return g;
}
