import * as THREE from 'three';
import { smoothstep } from '../../core/noise.js';
import { piste, regarderVers } from '../humanoide.js';
import { creerSpider, POSES } from '../spider.js';
import { filDeToile, troncAccroche, touffeExtremite } from './communs.js';

/* ==========================================================================
   SPIDER-MAN, PREMIER PASSAGE : SUSPENDU LA TETE EN BAS

   La pose la plus reconnaissable du personnage, et de loin la plus facile a
   rater : accroche par un pied, l'autre jambe repliee, les bras qui pendent
   vers le sol.

   LA SCENE EST ECRITE COMME UN PLAN DE FILM, en quatre temps :

     il pend et tourne lentement  →  il vous repere et s'immobilise
       →  il vous salue  →  il reprend sa derive

   Chaque temps est une pose cle datee ; la piste les enchaine avec une
   acceleration et une deceleration, parce qu'un passage a vitesse constante
   d'une pose a l'autre se lit immediatement comme une machine.
   ========================================================================== */
export function spiderSuspendu(palier) {
  const g = new THREE.Group();
  const perso = creerSpider(palier, { ombres: palier.ombres });

  /* IL PENDAIT SOUS LA NEIGE, PUIS PAR LE VENTRE. Deux corrections
     successives, dont voici le compte definitif : le groupe est pose AU SOL,
     le personnage est retourne d'un demi-tour autour de Z — donc ses pieds
     restent a la hauteur qu'on lui donne et sa tete descend d'un metre
     soixante-dix-huit en dessous. On accroche les chevilles a 3,55 m : la
     tete arrive alors a 1,77 m, pile a hauteur de regard du drone. Le fil
     mesure 3,4 m ; son sommet — l'ACCROCHE — est donc a 6,95 m. */
  const CHEVILLES = 3.55;
  const ACCROCHE = CHEVILLES + 3.4;

  /* LE PIVOT DE LA BALANCE ETAIT AU SOL, ET C'ETAIT PHYSIQUEMENT A
     L'ENVERS. Une fois le tronc ajoute, le defaut a saute aux yeux : le
     personnage se balancant autour d'un point a hauteur de ses PIEDS, le
     sommet du fil — cense rester noue a la branche — se deplaçait de PLUS
     D'UN METRE a chaque oscillation, largement assez pour se detacher du
     tronc, fixe lui, a l'ecran. Un corps suspendu se balance autour de son
     ACCROCHE, jamais autour du sol : le pivot est donc place a la hauteur
     du noeud, et tout ce qu'il contient est repere par rapport a CETTE
     hauteur — negatif pour le personnage, qui pend dessous. */
  const pivot = new THREE.Group();
  pivot.position.y = ACCROCHE;
  perso.rotation.z = Math.PI;
  perso.position.y = CHEVILLES - ACCROCHE;
  pivot.add(perso);

  const fil = filDeToile(3.4);
  fil.position.y = (CHEVILLES + 1.70) - ACCROCHE;
  pivot.add(fil);
  pivot.add(touffeExtremite());
  g.add(pivot);
  g.add(troncAccroche());

  const os = perso.userData.os;
  /* La sequence. Les instants sont exprimes en progression dans la fenetre,
     de zero a un : la scene dure ce qu'elle dure selon la vitesse du cerf,
     et elle se joue toujours en entier. */
  const sequence = piste([
    { t: 0.00, pose: POSES.suspendu },
    { t: 0.34, pose: POSES.suspendu },
    { t: 0.50, pose: POSES.suspenduSalut },
    { t: 0.70, pose: POSES.suspenduSalut },
    { t: 0.86, pose: POSES.suspendu },
    { t: 1.00, pose: POSES.suspendu },
  ]);

  g.userData.jouer = (u, t, camera) => {
    const vis = smoothstep(0, 0.10, u) * smoothstep(1, 0.88, u);
    g.visible = vis > 0.01;
    if (!g.visible) return;

    sequence(os, u);

    /* LE SALUT SE SUPERPOSE A LA POSE, il ne la remplace pas : la main
       oscille deux fois pendant que le bras reste ou la sequence l'a mis.
       C'est ce qui evite qu'un geste dure trop et devienne un moulinet. */
    const salut = smoothstep(0.44, 0.52, u) * smoothstep(0.76, 0.66, u);
    if (salut > 0.001) {
      const bat = Math.sin(t * 5.6);
      os.avantD.rotation.z += salut * bat * 0.55;
      os.mainD.rotation.z += salut * bat * 0.35;
    }

    // Il se balance doucement, et tourne un peu sur lui-meme.
    pivot.rotation.z = Math.sin(t * 1.15) * 0.15;
    /* La rotation propre s'ARRETE quand il vous a vu : on ne detaille pas
       quelqu'un qui tourne sur lui-meme, et surtout, un regard qui suit
       pendant que le corps pivote se lit comme un decrochage de nuque. */
    const attention = smoothstep(0.20, 0.36, u) * smoothstep(0.94, 0.82, u);
    pivot.rotation.y = Math.sin(t * 0.52) * 0.85 * (1 - attention);
    regarderVers(perso, os, camera, attention);
  };
  return g;
}
