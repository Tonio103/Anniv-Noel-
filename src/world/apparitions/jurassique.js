import * as THREE from 'three';
import { grainRond } from '../../core/dot.js';
import { smoothstep, clamp } from '../../core/noise.js';
import { creerTrex, marcheTrex } from '../trex.js';

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
   ========================================================================== */
export function jurassique(chemin, relief, palier) {
  const g = new THREE.Group();
  g.userData.suitChemin = true;

  const bete = creerTrex(palier);
  g.add(bete);
  const os = bete.userData.os;

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

  let dernierPas = -1, rugi = false;
  g.userData.reinit = () => { dernierPas = -1; rugi = false; };

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
    }
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
