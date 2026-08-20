import * as THREE from 'three';
import { smoothstep, clamp } from '../../core/noise.js';
import { REPERES, piste, regarderVers } from '../humanoide.js';
import { creerSpider, POSES } from '../spider.js';
import { filDeToile, tendreFil, halo, gerbeImpact, majImpact, ondeChoc, majOndeChoc } from './communs.js';

/* ==========================================================================
   SPIDER-MAN, SECOND PASSAGE : EN PLEIN BALANCEMENT

   Il traverse au-dessus du chemin, suspendu a un fil, et lance le suivant a
   mi-course. Ce second tir n'est pas un ornement : sans lui on voit un homme
   pendu a une corde qui oscille, avec lui on voit quelqu'un qui SE DEPLACE
   — la difference tient a un fil de plus.
   ========================================================================== */
export function spiderBalance(porteeX, palier) {
  const g = new THREE.Group();
  const ancre = new THREE.Group();       // le point d'accroche, en hauteur
  const perso = creerSpider(palier, { ombres: palier.ombres });

  /* LE FIL PARTAIT DANS LE MAUVAIS SENS. Il montait de l'ancre vers le ciel
     pendant que le personnage pendait dessous, sans rien qui les relie :
     un homme en vol plane sous une corde tendue vers rien. Il descend
     desormais de l'ancre jusqu'a la main levee, ce qui est le seul montage
     qui se tienne. */
  const LONGUEUR = 3.4;
  const fil = filDeToile(LONGUEUR);
  fil.position.y = -LONGUEUR / 2;
  ancre.add(fil);

  /* Le poignet leve se trouve a `epaule + humerus + radius` au-dessus des
     pieds. C'est une constante CALCULEE a partir des reperes du corps,
     jamais un nombre ajuste a vue : le jour ou l'on rallonge un bras, la
     main reste accrochee a son fil.

     ELLE ETAIT DEVENUE « NON DEFINI ». Le corps ne decrivait plus ses bras
     par la HAUTEUR de leurs articulations mais par la LONGUEUR de leurs
     segments — la pose de liaison en « A » l'imposait — et deux reperes
     disparus laissaient ici un calcul valant NaN. Le personnage partait
     alors a une position invalide, ce qui contaminait sa matrice monde,
     donc la position de sa source sonore, et le Web Audio refusait un
     parametre non fini. Un metre de trop dans un fil se voit ; une position
     invalide se manifeste trois modules plus loin, par une erreur qui ne
     parle de rien. */
  const POIGNET = REPERES.epaule + REPERES.humerus + REPERES.radius;
  perso.position.y = -LONGUEUR - POIGNET;
  ancre.add(perso);
  g.add(ancre);
  ancre.position.y = 7.6;

  const os = perso.userData.os;
  const sequence = piste([
    { t: 0.00, pose: POSES.balance },
    { t: 0.40, pose: POSES.balance },
    { t: 0.56, pose: POSES.arme },
    { t: 0.64, pose: POSES.lance },
    { t: 0.82, pose: POSES.balance },
    { t: 1.00, pose: POSES.balance },
  ]);

  const tir = filDeToile(1);          // longueur pilotee par l'etirement
  tir.visible = false;
  g.add(tir);
  /* Le point vers lequel il lance son fil suivant. Il est DEVANT lui dans
     le sens de la marche : un fil lance vers l'arriere le ferait freiner. */
  const ACCROCHE = new THREE.Vector3(-porteeX * 0.7, 13.0, -46);
  const _poignet = new THREE.Vector3();
  const _bout = new THREE.Vector3();

  /* LE « THWIP ». Deux instants meritent une ponctuation : le depart, au
     poignet (une bouffee de fils fins qui giclent avant de se rassembler
     en un seul brin), et l'arrivee, au loin, la ou le fil s'accroche (un
     bref eclat qui dit « ca vient de mordre »). PAS DE MARQUEUR SOLIDE A
     L'ANCRAGE — une premiere version posait une branche a `ACCROCHE`,
     mais un objet PERMANENT, plante a cinquante metres du personnage sur
     toute la duree de la scene, elargit la boite englobante du groupe
     entier bien au-dela de la ou le personnage se trouve reellement : le
     banc de cadrage (`build/apparitions.mjs`) mesurait alors une distance
     gonflee de treize a pres de quarante metres — la MEME famille de
     defaut que le sac de vapeur du theropode avant sa correction, ici
     evitee a la racine plutot que rustinee apres coup. Un eclat de
     lumiere seul, sans support physique, se lit tres bien dans cet
     univers ou toutes les apparitions sont deja des visions plutot que
     des objets poses — memes fonctions que les impacts de Kill Bill, du
     duel de sabres et du theropode. */
  const gicleeDepart = gerbeImpact(10, 0xE8EEF6, 0.035);
  g.add(gicleeDepart);
  let departT = -999;
  const eclatArrivee = ondeChoc(0xEAF2FF, 0.22, 0.09);
  eclatArrivee.position.copy(ACCROCHE);
  g.add(eclatArrivee);
  let arriveeFaite = false, arriveeT = -999;

  /* LE FLOU DE VITESSE. Trois « fantomes » a des phases legerement
     ANTERIEURES de la MEME trajectoire analytique — jamais une vraie copie
     du corps (un clone de personnage anime coute cher), juste une trainee
     de petites lueurs allongees qui suivent le mouvement avec retard. Leur
     intensite suit `vitesse`, une derivee analytique de l'arc du pendule :
     elle est maximale au point bas de chaque swing, nulle aux extremites —
     exactement la ou l'oeil s'attend a voir un flou de mouvement. */
  const N_FANTOMES = 3;
  const fantomes = [];
  for (let i = 0; i < N_FANTOMES; i++) {
    const f = halo([0.75, 0.85, 1.0], 1.4 - i * 0.3, 1);
    g.add(f);
    fantomes.push(f);
  }

  let tirFait = false;
  g.userData.reinit = () => {
    tirFait = false;
    departT = -999;
    arriveeFaite = false;
    arriveeT = -999;
  };

  g.userData.jouer = (u, t, camera) => {
    const vis = smoothstep(0, 0.08, u) * smoothstep(1, 0.90, u);
    g.visible = vis > 0.01;
    if (!g.visible) return;

    sequence(os, u);

    /* IL SE BALANCAIT SUR PLACE, ET C'ETAIT LE VRAI DEFAUT.

       Antoine : « je veux que le dernier Spider-Man se balance enfin, qu'il
       bouge vraiment ». L'ancienne version faisait osciller le personnage
       autour d'un point d'accroche FIXE : il allait de gauche a droite et
       revenait, sans jamais avancer d'un metre. On regardait un pendule,
       pas quelqu'un qui se deplace — et se deplacer est tout ce que ce
       personnage sait faire.

       Il TRAVERSE desormais : son point d'accroche remonte la scene sur
       cinquante-quatre metres pendant qu'il pendule dessous, si bien qu'il
       arrive de derriere, passe au-dessus du chemin et file devant. Le
       balancement se fait dans le plan de la marche — d'arriere en avant
       sous l'ancre — et non plus lateralement : c'est ainsi qu'un pendule
       porte celui qui s'y accroche.

       Il louvoie tout de meme un peu de cote, parce qu'une trajectoire
       rigoureusement rectiligne se lit comme un rail. */
    const av = clamp((u - 0.10) / 0.78, 0, 1);
    ancre.position.z = 27 - av * 54;
    ancre.position.x = Math.sin(av * Math.PI * 1.6) * porteeX * 0.42;

    /* Le pendule : trois arcs sur la traversee, vite au point bas et lent
       aux extremites. Un deplacement lineaire se lirait comme un panneau
       qu'on tire sur un rail. */
    const a = Math.sin(av * Math.PI * 3.0) * 1.0;
    ancre.rotation.x = a * 0.62;
    ancre.rotation.z = Math.cos(av * Math.PI * 1.6) * 0.22;
    /* Il monte au point haut de chaque arc et redescend au point bas : c'est
       ce qui distingue un vol plane d'un balancement. */
    /* SEPT METRES SOIXANTE, PAS NEUF DEUX. Mesure au format du telephone :
       a neuf metres d'accroche, sa tete passait a plus de sept metres du sol
       et sortait par le haut du cadre au moment ou il est le plus pres —
       c'est-a-dire au seul moment ou l'on voudrait le voir. */
    ancre.position.y = 7.6 + Math.abs(a) * 1.5;
    /* Le corps se redresse au point bas et se couche aux extremites : c'est
       ce qu'un pendule vivant fait de son bassin, et c'est ce qui empeche la
       silhouette de rester raide comme un pendu. */
    perso.rotation.x = -0.30 + Math.abs(a) * 0.28;
    perso.rotation.z = -ancre.rotation.z * 0.5;

    /* LES FANTOMES DE VITESSE. `vitesse` est la derivee de `a` par rapport
       a `av` (a un facteur pres) : Math.cos vaut un exactement la ou
       Math.sin — donc `a` — franchit zero, c'est-a-dire au point bas de
       chaque arc, la ou le pendule va le plus vite. Chaque fantome revit
       la MEME formule de position que l'ancre, quelques centiemes de `av`
       plus tot — jamais une position inventee, toujours un point reel de
       la trajectoire deja ecrite plus haut. */
    const vitesse = Math.pow(Math.abs(Math.cos(av * Math.PI * 3.0)), 2);
    for (let i = 0; i < fantomes.length; i++) {
      const avF = Math.max(0, av - (i + 1) * 0.012);
      const aF = Math.sin(avF * Math.PI * 3.0);
      fantomes[i].position.set(
        Math.sin(avF * Math.PI * 1.6) * porteeX * 0.42,
        7.6 + Math.abs(aF) * 1.5 - POIGNET - LONGUEUR * 0.5,
        27 - avF * 54);
      fantomes[i].material.opacity = vis * vitesse * (0.22 - i * 0.06);
    }

    /* Il se retourne vers vous au passage le plus bas — le seul instant ou
       il est assez pres pour que ca se voie. */
    regarderVers(perso, os, camera,
      smoothstep(0.28, 0.42, u) * smoothstep(0.80, 0.66, u));

    if (!tirFait && u > 0.60) { tirFait = true; departT = t; g.userData.emettre?.('toile'); }

    const sortie = smoothstep(0.60, 0.70, u);
    if (sortie > 0.01) {
      /* La position du poignet, prise dans le repere du groupe. On force la
         mise a jour de la branche concernee : les matrices du monde ne sont
         recalculees qu'au moment du rendu, donc sans cela le fil accuserait
         une image de retard — visible, sur un mouvement aussi rapide. */
      ancre.updateWorldMatrix(true, true);
      _poignet.set(0, 0, 0);
      os.mainD.localToWorld(_poignet);
      g.worldToLocal(_poignet);
      /* Le fil ne jaillit pas d'un coup sur toute sa longueur : il PART de
         la main et file vers son point d'accroche. */
      _bout.lerpVectors(_poignet, ACCROCHE, sortie);
      tendreFil(tir, _poignet, _bout);

      // La bouffee au poignet, au tout debut du jet : elle suit la main,
      // pas l'ancre.
      gicleeDepart.position.copy(_poignet);
      majImpact(gicleeDepart, t - departT, {
        duree: 0.22, plateau: 0.16, portee: 0.55, monte: 0.9, gravite: 1.2, decroissance: 6.0,
      });

      // L'impact sur la branche, une seule fois, quand le fil l'atteint
      // vraiment — pas a chaque image ou `sortie` frole un.
      if (!arriveeFaite && sortie > 0.98) { arriveeFaite = true; arriveeT = t; }
    } else {
      tir.visible = false;
      gicleeDepart.material.opacity = 0;
    }
    majOndeChoc(eclatArrivee, t - arriveeT, 0.28);
  };
  return g;
}
