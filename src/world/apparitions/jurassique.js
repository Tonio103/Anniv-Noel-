import * as THREE from 'three';
import { grainRond } from '../../core/dot.js';
import { smoothstep, clamp } from '../../core/noise.js';
import { creerTrex, marcheTrex } from '../trex.js';
import { buee, majBuee } from './communs.js';

/* ==========================================================================
   JURASSIC PARK

   La scene la plus celebre du cinema d'aventure, et la seule qui COMMENCE
   AVANT QU'ON VOIE QUOI QUE CE SOIT. Le verre d'eau qui tremble, le
   silence, puis la chose. On reprend cette construction en trois temps,
   transposee a une foret enneigee.

   Il passe DERRIERE la ligne d'arbres, jamais entierement degage. Ce n'est
   pas une economie : un dinosaure entierement visible invite a l'examiner,
   et il ne resiste jamais a l'examen. Entrevu entre deux troncs, il est
   enorme.

   « Y A PAS D'EMPREINTE DE PAS. » Antoine, a propos de cette scene
   precisement (voir `notes/son/empreintes-trex.md`) — et il avait raison :
   le systeme d'empreintes (`footprints.js`) n'avait jamais qu'un seul
   appelant, le cerf, avec un tampon cale sur sa forme. Le theropode
   laisse desormais les siennes, tridactyles et bien plus profondes (voir
   `tamponTrex` dans `footprints.js`), deposees au moment exact ou
   `marcheTrex` pose chaque pied — pas a une cadence arbitraire, la MEME
   horloge que celle qui declenche deja le bruit du pas, pour que l'image
   et le son ne derivent jamais l'un de l'autre.
   ========================================================================== */
export function jurassique(chemin, relief, palier, deposerEmpreinte) {
  const g = new THREE.Group();
  g.userData.suitChemin = true;

  const bete = creerTrex(palier);
  g.add(bete);
  const os = bete.userData.os;

  /* LA BUEE. Une nuit assez froide pour que la neige tombe des branches au
     moindre pas merite un souffle visible — et pour une masse de cette
     taille, un souffle bien plus large et bien plus lent que celui d'un
     enfant qui tremble (voir `kevin.js`, meme helper partage).

     ELLE N'EST PAS UN ENFANT DU CRANE — un choix qui n'a PAS ete dicte
     par la cause qu'on lui a d'abord pretee. Premier essai : accrochee
     directement a `os.crane`, comme n'importe quel accessoire ailleurs
     dans ce dossier (le chapeau de Mugiwara sur `os.tete`, la baguette de
     Harry sur `os.mainD`...). A ce moment-la, le banc de cadrage des
     scenes mobiles (`build/apparitions.mjs`, qui calcule la boite
     englobante de la scene ENTIERE via `Box3.setFromObject`) s'est mis a
     mesurer plus de deux cents metres au lieu de soixante. Le coupable
     SEMBLAIT etre la chaine de transformation du sprite a travers un
     grand squelette anime — mais deplacer le sprite en enfant simple de
     `g` (ce qui suit) n'a RIEN change a la mesure : la piste etait
     fausse.

     LE VRAI COUPABLE : `SkinnedMesh.boundingBox`. Cette propriete n'est
     JAMAIS calculee automatiquement par le moteur (la doc de three.js est
     explicite : « must be called by your app », « should be recomputed
     per frame » si l'objet est anime) — elle reste `null` jusqu'au
     premier `Box3.setFromObject` qui la rencontre, moment ou elle se fige
     DEFINITIVEMENT a partir des matrices de squelette EN VIGUEUR A CET
     INSTANT. Or ces matrices ne sont elles-memes rafraichies que par
     `renderer.render()` — jamais par la simulation manuelle a coups de
     `s.apparitions.maj(...)` de ce banc. Le tout premier calcul de boite
     venu pouvait donc figer une pose fantome (bind pose, ou la pose d'un
     tout autre instant deja rendu plus tot dans la page) et fausser la
     mesure de plusieurs centaines de metres pour le reste de
     l'execution — un defaut du BANC DE MESURE, pas du rendu (l'image
     elle-meme restait juste a l'ecran). Corrige directement dans
     `apparitions.mjs` : squelette rafraichi et cache invalide juste avant
     de mesurer.

     Le sprite reste neanmoins ENFANT DE `g` (plus simple a raisonner,
     jamais mesure qu'a travers une transformation simple) et suit la
     position du crane en LISANT sa matrice-monde chaque image — le meme
     principe que la traine de lame de Kill Bill et du duel de sabres,
     deplace ici du cas d'une arme a celui d'un souffle. */
  const nuageTrex = buee([0.82, 0.86, 0.92]);
  g.add(nuageTrex);
  let dernierSouffleTrexT = -999;
  const museauMonde = new THREE.Vector3();

  /* LA NEIGE QUI TOMBE DES BRANCHES. C'est le premier temps de la scene, et
     c'est le seul moment ou elle repose entierement sur autre chose que la
     bete : deux gerbes qui se detachent des arbres, en cadence, pendant
     qu'on ne voit encore rien. */
  const N = palier.nom === 'bas' ? 90 : 170;
  const pos = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const matN = new THREE.PointsMaterial({
    map: grainRond(), alphaTest: 0.02, color: 0xE6EEFB, size: 0.13,
    transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
  });
  const chute = new THREE.Points(geo, matN);
  chute.frustumCulled = false;
  g.add(chute);
  const vies = new Float32Array(N).map(() => Math.random());
  const oX = new Float32Array(N).map(() => (Math.random() - 0.5) * 26);
  const oZ = new Float32Array(N).map(() => (Math.random() - 0.5) * 34);
  const oH = new Float32Array(N).map(() => 5 + Math.random() * 9);

  /* La voie : loin du chemin et DERRIERE les arbres. */
  /* OU LE PLACER, ET C'EST TOUTE LA DIFFICULTE DE CETTE SCENE.

     Premiere version : vingt-deux metres de cote, marchant a la hauteur du
     cerf. Il etait donc PARALLELE a nous et par le travers — c'est-a-dire a
     plus de trente degres de l'axe, alors qu'en portrait le champ n'en fait
     que seize et demi de chaque cote. On ne le voyait jamais.

     La reponse n'est pas de le rapprocher du chemin — il doit rester
     derriere des arbres — mais de le tenir DEVANT. A treize metres de cote,
     il tombe a douze degres de l'axe des qu'il precede le cerf de quelques
     metres : dans le cadre, loin, a demi mange par le brouillard et par les
     troncs. C'est exactement le plan qu'on veut.

     A treize metres, la marge du couloir garantit qu'il y a de grands
     sapins entre lui et nous : elle vaut deux metres soixante plus quatre
     dixiemes de la hauteur de l'arbre, soit pres de dix metres pour un
     sujet de quinze.

     SECONDE ERREUR, ET CELLE-LA ETAIT GRAVE : DEPART ET ARRIVEE COURAIENT
     DEVANT LA CAMERA, PAS DEVANT LE CERF.

     Avec `avant = 48` et `apres = 26`, la fenetre s'ouvre a `ancre - 48` et
     se ferme a `ancre + 26` : c'est la LE SEUL INTERVALLE ou le cerf — donc
     a peu pres la camera — peut se trouver pendant toute la scene. Or DEPART
     valait 26 et ARRIVEE 78 : la bete demarrait DEJA a la limite haute de
     cet intervalle et finissait cinquante-deux metres plus loin, hors de
     portee sur toute la duree. Mesure faite avec `build/apparitions.mjs`,
     qui balaie desormais la fenetre entiere d'une scene mobile au lieu d'un
     seul instant : la bete ne repassait JAMAIS a moins de cent trente metres
     de la camera. Elle courait devant une camera qui ne pouvait pas la
     suivre — invisible du debut a la fin, et rien dans un simple coup d'oeil
     ne le laissait voir, puisqu'une capture isolee tombait toujours, par
     chance, sur un instant ou elle etait encore loin devant.

     La marche visible se joue entre u=0,30 et u=0,86 (voir plus bas) ; sur
     ce segment le cerf va de `ancre-25,8` a `ancre+15,6`.

     TROISIEME ERREUR, MESUREE CETTE FOIS AVEC LA VRAIE CAMERA DE MARCHE, PAS
     UNE RECONSTITUTION.

     Le calage precedent (DEPART=-19, ARRIVEE=23) collait de trop pres a la
     progression du cerf : la bete finissait par rester quasiment FIXE en
     fin de fenetre (k sature a 1 des que u depasse 0,86) pendant que le
     cerf, lui, continue d'avancer jusqu'a `ancre+apres` puis au-dela. Le
     cerf la RATTRAPE, puis la depasse — et une bete treize metres sur le
     cote et desormais legerement EN ARRIERE tombe evidemment hors du champ
     d'une camera qui regarde devant. La marche complete simulee image par
     image (`build/_tmp_trex_real.mjs`, jamais un instantane reconstruit) l'a
     montre sans ambiguite : l'ecart ecran partait de -0,68 a la sortie de la
     halte voisine pour atteindre -20 quelques secondes plus tard.

     La regle qui en decoule : ARRIVEE doit rester en avance sur le cerf
     MEME apres la fin nominale de la fenetre, avec une marge confortable, et
     DEPART doit deja placer la bete en avance des le debut de la marche. On
     vise une avance qui ne descend jamais sous vingt-cinq metres sur tout le
     segment utile, ce qui, a treize metres de voie, tient l'angle sous
     vingt-huit degres — au-dela du champ theorique de seize degres et demi,
     mais la moitie de cette marge est mangee par le brouillard et les
     troncs, ce qui est justement l'effet voulu : on l'aperçoit, on ne le
     fixe pas. */
  /* ANTOINE : « le T-Rex ne ressemble a rien, il ne fait pas peur, on le
     voit de loin ». Le parti pris d'origine — le tenir loin, a demi mange
     par le brouillard — etait une lecture du plan du film ; pour Antoine
     ca ne marche pas, la bete est trop petite et trop floue pour qu'on la
     reconnaisse, et une menace qu'on ne reconnait pas ne fait pas peur. On
     la rapproche nettement : neuf metres de voie au lieu de treize, ce qui
     la rapproche ET l'ecarte moins de l'axe de la camera (l'angle depend
     du rapport voie/avance, donc les deux s'ameliorent ensemble). */
  const VOIE = 9, COTE = -1;
  const DEPART = 8, ARRIVEE = 58;
  const p = new THREE.Vector3(), c = new THREE.Vector3(), tan = new THREE.Vector3();
  const piedMonde = new THREE.Vector3();

  let dernierPas = -1, rugi = false;
  g.userData.reinit = () => {
    dernierPas = -1; rugi = false;
    dernierSouffleTrexT = -999;
    nuageTrex.material.opacity = 0;
  };

  g.userData.jouer = (u, t, camera, sAncre, dt) => {
    /* LES TROIS TEMPS.
       0.00 → 0.30  la neige tombe des branches, on ne voit rien
       0.22 → 0.32  le rugissement, toujours invisible
       0.30 → 0.86  il traverse derriere les arbres  */
    const vis = smoothstep(0, 0.04, u) * smoothstep(1, 0.92, u);
    g.visible = vis > 0.01;
    if (!g.visible) return;

    const k = clamp((u - 0.30) / 0.56, 0, 1);
    const sBete = sAncre + DEPART + k * (ARRIVEE - DEPART);
    const sc = clamp(sBete, 0, chemin.longueur);
    chemin.point(sc, p);
    chemin.cote(sc, c);
    chemin.tangente(sc, tan);
    const x = p.x + c.x * COTE * VOIE;
    const z = p.z + c.z * COTE * VOIE;
    g.position.set(x, relief.hauteur(x, z), z);
    g.rotation.y = Math.atan2(-tan.x, -tan.z);

    /* IL N'EST LA QU'A PARTIR DU DEUXIEME TEMPS. Avant, le groupe existe —
       il porte la neige qui tombe et la source sonore — mais la bete est
       eteinte : c'est ce qui fait qu'on entend des pas sans voir personne. */
    bete.visible = u > 0.28;

    /* LA CADENCE. Un pas toutes les huit dixiemes de seconde, comptes sur le
       temps ABSOLU et non sur la progression : ainsi le rythme reste le meme
       quelle que soit la vitesse du cerf, et c'est le rythme qui fait la
       masse. */
    const cadence = t / 0.82;
    const phase = cadence % 1;
    marcheTrex(os, phase, 1);
    // Il avance vraiment : la marche et le deplacement sont accordes.
    bete.position.z = 0;

    /* Le pas qui vient de se poser. On declenche dessus la secousse et le
       son — jamais sur une horloge separee, sinon l'image et le bruit
       derivent l'un de l'autre au bout de quelques secondes. */
    const numero = Math.floor(cadence * 2);
    const neuf = numero !== dernierPas;
    if (neuf) {
      dernierPas = numero;
      if (u > 0.02) g.userData.emettre?.('pas');

      /* L'EMPREINTE, DEPOSEE AU PIED QUI VIENT REELLEMENT DE SE POSER.
         `marcheTrex` alterne les pattes sur un demi-tour de phase (voir
         `trex.js` : dec=0 pour D, dec=PI pour G), et `numero` change de
         parite exactement a ces memes demi-tours — la parite dit donc
         sans ambiguite quel pied touche le sol a CET instant, sans avoir
         a lire l'etat interne de la marche. On lit la position REELLE du
         pied (sa matrice-monde du jour, pas une approximation a partir du
         centre de la bete) : a neuf metres de voie et avec le roulis du
         bassin, les deux pattes ne sont jamais a la meme distance du
         chemin. */
      if (bete.visible && deposerEmpreinte) {
        const piedActif = numero % 2 === 0 ? os.piedG : os.piedD;
        piedActif.updateWorldMatrix(true, false);
        piedActif.getWorldPosition(piedMonde);
        deposerEmpreinte(piedMonde.x, piedMonde.z, g.rotation.y, 1.3, 'trex');
      }

      // Le souffle, une fois par foulee complete (donc deux fois moins
      // souvent que les pas) — une respiration plus lente que la marche,
      // comme chez n'importe quel grand animal.
      if (bete.visible && numero % 2 === 0) dernierSouffleTrexT = t;
    }
    if (bete.visible) {
      g.updateWorldMatrix(true, false);
      os.crane.updateWorldMatrix(true, false);
      os.crane.getWorldPosition(museauMonde);
      g.worldToLocal(museauMonde);
      nuageTrex.position.copy(museauMonde);
    }
    majBuee(nuageTrex, t, dernierSouffleTrexT, vis, 0.62, 1.6);
    // La force de la secousse decroit apres chaque impact.
    const depuis = (cadence * 2) % 1;
    const secousse = Math.pow(1 - depuis, 3);

    if (!rugi && u > 0.22) { rugi = true; g.userData.emettre?.('rugir'); }

    /* La neige des branches. Elle tombe surtout juste apres un pas, et elle
       s'arrete quand la bete est passee — c'est elle qui fait le compte a
       rebours du debut. */
    const pluie = smoothstep(0, 0.05, u) * smoothstep(0.92, 0.62, u);
    matN.opacity = pluie * (0.30 + secousse * 0.70);
    for (let i = 0; i < N; i++) {
      vies[i] += dt * 0.55;
      if (vies[i] > 1) vies[i] -= 1;
      const kk = vies[i];
      pos[i * 3] = oX[i];
      pos[i * 3 + 1] = oH[i] * (1 - kk * kk);
      pos[i * 3 + 2] = oZ[i] + kk * 0.6;
    }
    geo.attributes.position.needsUpdate = true;
    void camera;
  };
  return g;
}
