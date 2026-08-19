import * as THREE from 'three';
import { smoothstep, clamp } from '../../core/noise.js';
import { REPERES, piste, regarderVers } from '../humanoide.js';
import { creerSpider, POSES } from '../spider.js';
import { filDeToile, tendreFil } from './communs.js';

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

  let tirFait = false;
  g.userData.reinit = () => { tirFait = false; };

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

    /* Il se retourne vers vous au passage le plus bas — le seul instant ou
       il est assez pres pour que ca se voie. */
    regarderVers(perso, os, camera,
      smoothstep(0.28, 0.42, u) * smoothstep(0.80, 0.66, u));

    if (!tirFait && u > 0.60) { tirFait = true; g.userData.emettre?.('toile'); }

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
    } else {
      tir.visible = false;
    }
    void t;
  };
  return g;
}
