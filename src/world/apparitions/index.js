/* LES APPARITIONS.

   Antoine : « tout au long du trajet je veux qu'il y ait des apparitions wtf,
   en mode voitures de police, Spider-Man (j'aime beaucoup Spider-Man), les
   films, etc. »

   Six clins d'oeil semes le long du chemin. Trois regles, et elles decident
   de tout :

   · C'EST BREF. Chacun dure quelques secondes, apparait a l'ecart du chemin
     et s'en va. Une blague qui reste plantee dans le decor cesse d'etre une
     surprise des la deuxieme halte et devient un element de decor rate ;
   · CA NE COUPE JAMAIS LA BALADE. Rien ne s'arrete, rien ne demande un
     geste, le cerf continue de marcher. On l'apercoit ou on le rate — et le
     rater est une bonne chose, ca donne envie de refaire le trajet ;
   · TOUT EST PROCEDURAL. Aucun modele, aucune texture chargee : le fichier
     doit rester un seul HTML chiffre et autonome. Une silhouette bien
     choisie en dit plus qu'un maillage detaille, surtout de nuit et a
     vingt metres.

   Chaque apparition dort (groupe invisible) tant que le cerf n'entre pas
   dans sa fenetre, joue sa scene, puis se rendort. Le cout au repos est donc
   nul, et en pleine action il ne depasse jamais quelques dizaines de
   triangles.

   Ce fichier est l'ORCHESTRATEUR : la table des scenes (`planApparitions`),
   les zones a degager pour elles (`sitesApparitions`) et la classe qui les
   pilote (`Apparitions`). Chaque scene individuelle vit dans son propre
   fichier de ce dossier ; les helpers qu'au moins deux d'entre elles
   partagent vivent dans `communs.js`.
*/

import * as THREE from 'three';
import { smoothstep, clamp } from '../../core/noise.js';
import { coursePoursuite } from './police.js';
import { spiderSuspendu } from './spider1.js';
import { spiderBalance } from './spider2.js';
import { etDevantLaLune } from './et.js';
import { duelSabres } from './sabres.js';
import { traineesDeFeu } from './delorean.js';
import { patronus } from './patronus.js';
import { seulALaMaison } from './kevin.js';
import { mugiwara } from './mugiwara.js';
import { nueeHamburgers } from './hamburgers.js';
import { jurassique } from './jurassique.js';
import { trouNoir } from './gargantua.js';
import { killBill } from './killbill.js';
import { shining } from './shining.js';

/* Les zones a laisser sans arbre, en coordonnees du monde. Le rayon est
   celui de la scene plus une marge : un sapin dont le TRONC est hors zone
   peut encore etaler ses branches dessus, et c'est le feuillage qu'on voit.

   Cette table est sortie du constructeur pour une raison precise : LA FORET
   DOIT LA CONNAITRE AVANT D'ETRE SEMEE.

   Antoine : « fait gaffe a ce qu'il n'y ait pas de collision avec les
   arbres ». Le semis place plus de mille sapins au hasard le long du chemin,
   sans rien savoir de ce qui viendra s'y ajouter : un duelliste pouvait donc
   se retrouver le nez dans un tronc, et un Spider-Man pendu au milieu d'un
   feuillage. Le seul remede qui tienne est de degager le terrain AVANT de
   semer — retirer un arbre apres coup laisse un trou visible, et deplacer
   une apparition apres coup casse le cadrage qu'on vient de mesurer.

   `sitesApparitions` rend donc la liste des zones a laisser libres, et
   `main.js` la passe a la foret au moment du semis. */
export function planApparitions(L) {
  return [
    /* LA POURSUITE ETAIT ALLUMEE DES LA PREMIERE SECONDE. Sa fenetre
       s'ouvrait quarante-deux metres avant son ancrage, place a neuf pour
       cent du chemin — soit dix-huit metres — alors que la balade DEMARRE a
       vingt-six. On voyait donc le gyrophare avant meme d'avoir fait un pas,
       ce qui grillait la seule surprise qu'il avait a offrir. Elle est
       reculee a quinze pour cent du parcours, ce qui laisse cinquante
       metres de foret silencieuse avant qu'il ne se passe quoi que ce soit.

       L'ancrage n'est plus qu'un REPERE : les voitures, elles, parcourent
       deux cent cinquante metres autour de lui. */
    /* ONZE APPARITIONS, ESPACEES DE HUIT POUR CENT DU PARCOURS.

       L'espacement n'est plus un choix de gout mais une contrainte
       arithmetique : chaque fenetre mesure de quarante a quatre-vingts
       metres, et le chemin en fait six cent soixante-neuf. A onze scenes,
       il reste cinquante-trois metres entre deux ancrages — juste de quoi
       qu'elles ne se chevauchent pas.

       La verification s'est imposee toute seule : le theropode, avec ses
       cinquante-deux metres d'approche, empietait a la fois sur le trio qui
       le precede et sur le patronus qui le suit. Trois apparitions
       simultanees, ce n'est plus une surprise, c'est une brocante. */
    { nom: 'police',    s: L * 0.12, cote: -1, ecart: 6.0, avant: 46, apres: 26, degage: 0 },
    { nom: 'spider1',   s: L * 0.20, cote: -1, ecart: 3.5, avant: 30, apres: 8,  degage: 5.5 },
    /* MUGIWARA, GLISSE DANS LE COURT INTERVALLE ENTRE SPIDER1 ET KILL BILL.
       Une fenetre volontairement breve — on ne le voit pas arriver, on
       tombe sur lui — meme logique que Shining plus loin sur le parcours. */
    /* ECART REDUIT DE 4,0 A 3,1 — « BORD » AU BANC DE CADRAGE.
       A 4,0 m, l'ancrage du personnage tombait a x=-0.78 a l'ecran au
       point de mesure (milieu de fenetre), juste au-dela du seuil de
       0,75 : visible, dans le champ, mais frolant le bord gauche plutot
       que lu confortablement. La scene ne suit pas le chemin (elle est
       fixe, comme Kill Bill juste apres), donc son cadrage ne beneficie
       d'aucun rattrapage dynamique — le seul levier est la distance
       laterale au chemin elle-meme. */
    { nom: 'mugiwara',  s: L * 0.2212, cote: -1, ecart: 3.1, avant: 8, apres: 5, degage: 5.5 },
    { nom: 'killbill',  s: L * 0.28, cote: -1, ecart: 4.0, avant: 32, apres: 12, tourne: 0.3, degage: 5.0 },
    { nom: 'et',        s: L * 0.36, cote:  0, ecart: 0,   avant: 34, apres: 24, degage: 0 },
    { nom: 'sabres',    s: L * 0.44, cote: -1, ecart: 4.5, avant: 40, apres: 10, degage: 6.5, assombrit: 1 },
    { nom: 'kevin',     s: L * 0.52, cote: -1, ecart: 7.0, avant: 34, apres: 10, tourne: 0.4, degage: 5.5 },
    /* Le theropode marche a vingt-deux metres du chemin, derriere la ligne
       d'arbres : on ne degage donc RIEN pour lui — ce sont justement les
       troncs entre lui et nous qui font la scene. */
    /* ANTOINE : « le T-Rex part en meme temps que le patronus ». Les deux
       fenetres ne se recouvraient que de vingt-deux centimetres sur le
       papier — assez pour paraitre reglees a la main — mais la traine du
       theropode qui s'efface et l'amorce du patronus qui se leve se
       lisaient bel et bien comme un seul instant a deux endroits. On
       raccourcit la traine du premier et on retarde l'amorce du second :
       vingt-huit metres d'ecart net entre les deux, largement plus qu'il
       n'en faut pour que le silence entre les deux se sente. */
    { nom: 'trex',      s: L * 0.61, cote: -1, ecart: 0,   avant: 48, apres: 12, degage: 0 },
    /* SHINING, GLISSEE DANS LE GRAND ECART LAISSE ENTRE LE T-REX ET LE
       PATRONUS (vingt-huit metres nets, voir plus haut). Une fenetre
       courte et sans amorce : ce n'est pas une scene qu'on voit arriver,
       c'est une scene qu'on DECOUVRE — l'effet ne marche que si l'on
       tombe dessus. */
    { nom: 'shining',   s: L * 0.6522, cote: -1, ecart: 5.0, avant: 12, apres: 6, degage: 6.0 },
    { nom: 'patronus',  s: L * 0.70, cote: -1, ecart: 5.5, avant: 20, apres: 10, degage: 8.0 },
    /* LES HAMBURGERS, DANS LE COURT INTERVALLE ENTRE PATRONUS ET GARGANTUA.
       Scene aerienne (suitCamera) : aucun degagement d'arbres a prevoir,
       elle flotte au-dessus de tout. */
    { nom: 'hamburgers', s: L * 0.7189, cote: 0, ecart: 0, avant: 5, apres: 3, degage: 0 },
    { nom: 'gargantua', s: L * 0.78, cote:  0, ecart: 0,   avant: 38, apres: 28, degage: 0 },
    { nom: 'spider2',   s: L * 0.86, cote: -1, ecart: 3.0, avant: 28, apres: 8,  degage: 7.0 },
    /* ECART RELEVE A QUATRE METRES. Antoine : « elle roule sur le cerf ».
       Pose exactement sur l'axe du chemin (ecart nul), la trainee de la
       DeLorean partageait la meme ligne que la marche du cerf — et les deux
       s'y trouvaient au meme instant (mesure faite : le flash tombe alors
       que le cerf n'est qu'a quelques metres de l'ancre). Decalee du meme
       cote que tout le reste, elle file desormais sur son propre bas-cote,
       assez large pour ne jamais toucher le corps du cerf ni ses bois. */
    { nom: 'delorean',  s: L * 0.94, cote: -1, ecart: 4.0, avant: 46, apres: 16, degage: 4.0 },
  ];
}

/* Les zones a laisser sans arbre, en coordonnees du monde. Le rayon est
   celui de la scene plus une marge : un sapin dont le TRONC est hors zone
   peut encore etaler ses branches dessus, et c'est le feuillage qu'on voit. */
export function sitesApparitions(chemin) {
  const L = chemin.longueur;
  const p = new THREE.Vector3(), c = new THREE.Vector3();
  const sites = [];
  for (const d of planApparitions(L)) {
    if (!d.degage) continue;
    chemin.point(d.s, p);
    chemin.cote(d.s, c);
    sites.push({
      x: p.x + c.x * d.cote * d.ecart,
      z: p.z + c.z * d.cote * d.ecart,
      r: d.degage,
    });
  }
  return sites;
}

/* ========================================================================== */
export class Apparitions {
  constructor(scene, chemin, relief, palier) {
    this.chemin = chemin;
    this.relief = relief;
    this.groupe = new THREE.Group();
    this.groupe.name = 'apparitions';
    scene.add(this.groupe);

    const L = chemin.longueur;
    /* Reparties sur tout le trajet, jamais deux dans la meme foulee, et
       toujours A COTE du chemin : le cerf ne doit jamais avoir a les
       contourner. Les distances laterales sont choisies pour que la chose
       tienne dans le champ du drone, qui regarde devant et un peu de cote. */
    /* `avant` / `apres` : de combien de metres AVANT l'objet la scene
       s'allume, et combien de metres APRES elle s'eteint. Ce n'est pas une
       coquetterie de reglage — une fenetre centree sur l'objet l'allume au
       moment ou on le depasse, donc quand il est deja derriere la camera.
       Le drone regarde DEVANT : tout doit s'ouvrir largement en amont. */
    /* SEIZE APPARITIONS, UNE TOUS LES QUARANTE METRES ENVIRON — soit une
       toutes les douze ou treize secondes au rythme de marche du cerf.

       L'ordre n'est pas aleatoire. On alterne :

       · les PROCHES (le tuyau, le bonhomme de neige, Spider-Man) et les
         LOINTAINES (le T-Rex derriere les arbres, la fusee a l'horizon) ;
       · les BRUYANTES (le chasseur qui passe en rase-mottes, la soucoupe)
         et les SILENCIEUSES (le tuyau vert planté là sans un mot, le trio
         qui ne bouge pas d'un cil) ;
       · et l'on garde le traineau et la DeLorean pour la fin, quand on
         approche de la clairiere de Noel.

       Sans cette alternance, six gags spectaculaires d'affilee s'annulent
       les uns les autres : c'est le silence entre deux qui fait la
       surprise du suivant.

       `avant` / `apres` : de combien de metres AVANT l'objet la scene
       s'allume, et combien de metres APRES elle s'eteint. Une fenetre
       centree sur l'objet l'allumerait au moment ou on le depasse, donc
       quand il est deja derriere la camera : tout s'ouvre largement en
       amont. Les scenes du ciel, elles, peuvent s'ouvrir plus tot encore,
       puisque rien ne les masque. */
    /* HUIT APPARITIONS, ET PAS SEIZE.

       J'en avais ajoute dix d'un coup ; Antoine en a coupe la moitie, et il
       a eu raison : au-dela, elles se marchent dessus. Six gags
       spectaculaires d'affilee s'annulent les uns les autres — c'est le
       silence entre deux qui fait la surprise du suivant. Mieux vaut huit
       scenes travaillees qu'une brocante.

       Les huit retenues collent a ce qui etait demande : une voiture de
       police, du Spider-Man (trois fois — c'est assume, il l'aime beaucoup)
       et du cinema. Une toutes les quatre-vingts metres environ, soit une
       toutes les vingt-cinq secondes au rythme de marche du cerf.

       L'ordre alterne les proches et les lointaines, les bruyantes et les
       silencieuses : le trio qui ne bouge pas d'un cil tombe entre le duel
       de sabres et le balancement, et c'est cette respiration qui les rend
       toutes lisibles.

       `avant` / `apres` : de combien de metres AVANT l'objet la scene
       s'allume, et combien de metres APRES elle s'eteint. Une fenetre
       centree sur l'objet l'allumerait au moment ou on le depasse, donc
       quand il est deja derriere la camera. */
    /* LES ECARTS SONT DICTES PAR LE FORMAT DU TELEPHONE, ET C'EST BEAUCOUP
       PLUS SERRE QU'IL N'Y PARAIT.

       En portrait, le champ vertical vaut soixante-six degres mais le champ
       HORIZONTAL n'en fait plus que trente-trois — seize et demi de chaque
       cote de l'axe. Une apparition posee a dix metres du chemin sort donc
       du cadre des que l'on n'est plus qu'a trente-cinq metres d'elle, et
       elle en est franchement dehors au moment ou l'on passe a son niveau.

       Mesure faite a la mi-fenetre, avant correction : cinq des huit
       apparitions etaient hors champ sur l'ecran d'Antoine, alors qu'elles
       tenaient toutes largement dans mon cadre paysage. C'est exactement le
       genre d'erreur qu'on ne peut pas commettre deux fois — on verifie au
       format de l'appareil, pas au sien.

       ET LE DRONE N'EST PAS DANS L'AXE DU CHEMIN. Il vole de cote, et le
       cadrage vise a cote du cerf par-dessus le marche. La mesure est sans
       appel : les trainees de la DeLorean sont posees EXACTEMENT sur le
       chemin — ecart nul — et leur centre tombe a plus zero virgule
       soixante-quinze de l'ecran. Tout le cadre est donc decale d'environ
       les trois quarts d'un demi-ecran vers la droite, en permanence.

       Consequence : un cote est utilisable, l'autre pas. Une apparition
       posee du cote « plus un » part vers le bord droit et n'en revient
       jamais ; du cote « moins un », l'ecart la ramene vers le milieu, a
       raison d'environ un dixieme d'ecran par metre. Tout est donc du meme
       cote, et la variete se fait sur la DISTANCE au chemin — de trois a
       sept metres — plutot que sur la gauche et la droite, alternance que
       personne ne remarquerait de toute facon et qui coutait ici la moitie
       des apparitions.

       (J'avais d'abord cru a un simple biais a compenser, sur la foi de deux
       mesures qui se contredisaient. Le banc lui-meme etait en cause : il
       passait au drone une heure figee et differente a chaque execution, si
       bien que son tremblement de main levee changeait le cadrage d'un demi-
       ecran d'un essai a l'autre. Une horloge fixe a rendu le banc
       reproductible, et les chiffres ci-dessus sont les premiers auxquels on
       puisse se fier.) Le prix a payer est qu'elles frolent le
       chemin ; c'est sans consequence, aucune n'est au sol devant le cerf —
       Spider-Man pend en hauteur, le patronus est un fantome, et le duel se
       tient assez loin pour qu'on n'ait pas a le contourner. */
    /* Le pont vers les empreintes — une fermeture, pas la reference
       directe : voir `brancherEmpreintes` ci-dessus pour la raison. */
    const deposerEmpreinte = (x, z, angle, force, type) => {
      this.empreintes?.ajouter(x, z, angle, force, type);
    };

    /* Les fabriques, indexees par nom. La table des positions vit desormais
       hors de la classe (voir `planApparitions`) parce que la foret doit la
       lire avant de semer ses arbres ; il ne reste ici que ce qui construit
       reellement les objets. */
    const FABRIQUES = {
      police: () => coursePoursuite(chemin, relief, palier),
      spider1: () => spiderSuspendu(palier),
      et: () => etDevantLaLune(chemin),
      sabres: () => duelSabres(palier),
      kevin: () => seulALaMaison(palier),
      patronus: () => patronus(palier),
      spider2: () => spiderBalance(9, palier),
      killbill: () => killBill(palier),
      trex: () => jurassique(chemin, relief, palier, deposerEmpreinte),
      shining: () => shining(palier),
      gargantua: () => trouNoir(relief, chemin, palier),
      delorean: () => traineesDeFeu(26, palier, relief),
      mugiwara: () => mugiwara(palier),
      hamburgers: () => nueeHamburgers(chemin, palier),
    };
    const plan = planApparitions(L).map((d) => ({ ...d, faire: FABRIQUES[d.nom] }));

    const p = new THREE.Vector3(), c = new THREE.Vector3(), tan = new THREE.Vector3();
    this._viseeInteret = new THREE.Vector3();
    /* LE CERF S'ARRETE POUR CHAQUE APPARITION. Antoine : « ça doit être
       vraiment une vraie scène de film ». Une silhouette entr'apercue en
       marchant reste un decor qui defile ; on veut un ARRET, une camera qui
       s'installe et compose, comme a une halte-cadeau — mais sans toucher
       au minutage de chaque scene, deja regle avec soin. La vitesse
       virtuelle avance donc la scene exactement comme l'aurait fait la
       marche normale : arreter le cerf ne change ni le rythme ni la duree
       de ce qu'on voit, seulement le fait que la camera n'a plus a courir
       pour le suivre pendant qu'elle le regarde. */
    this._vitesseVirtuelle = 3.3;
    this._enArret = false;
    this._vitesseAvantArret = null;
    this._sensArc = 1;
    // Le point-tire de mise au point pendant un arret : voir `maj()`.
    this.cibleFocus = null;
    this.scenes = [];
    /* Le son est branche plus tard : le contexte audio n'existe qu'apres le
       premier geste du visiteur, et les apparitions, elles, sont construites
       au chargement. Tant que rien n'est branche, tout se joue en silence
       sans qu'aucune scene n'ait a le savoir. */
    this.son = null;
    for (const d of plan) {
      const o = d.faire();
      if (!o) continue;
      /* Le canal par lequel une scene declenche un bruit ponctuel — le choc
         des lames, le bang de la DeLorean. Les scenes ne connaissent ni le
         moteur audio ni leur propre nom : elles disent seulement « ceci vient
         de se produire », et c'est ici qu'on sait a qui l'adresser.

         LE MEME EVENEMENT SECOUE AUSSI LA CAMERA. Un choc de lames, un rugissement,
         un ascenseur qui claque n'existaient jusqu'ici que dans ce qu'ils
         montraient — la camera, elle, ne reagissait jamais. `regler` (un simple
         ajustement continu de volume) et `pas` (repete a chaque foulee) sont
         exclus : les secouer donnerait une vibration permanente, pas un choc. */
      o.userData.emettre = (quoi, valeur) => {
        const s = this.son;
        if (s && typeof s[quoi] === 'function') s[quoi](d.nom, valeur);
        if (quoi !== 'regler' && quoi !== 'pas') {
          this._droneCourant?.choc(typeof valeur === 'number' ? clamp(valeur, 0.35, 1) : 0.6);
        }
      };
      if (!o.userData.suitCamera && !o.userData.suitChemin) {
        chemin.point(d.s, p);
        chemin.cote(d.s, c);
        chemin.tangente(d.s, tan);
        const x = p.x + c.x * d.cote * d.ecart;
        const z = p.z + c.z * d.cote * d.ecart;
        o.position.set(x, relief.hauteur(x, z), z);
        // Face au chemin, avec le decalage propre a chaque scene.
        o.rotation.y = Math.atan2(-tan.x, -tan.z) + (d.tourne || 0);
        /* Une fois la scene POSEE et ORIENTEE, elle peut conformer ce qui
           doit l'etre au relief — flaques de gyrophare, trainees de feu.
           L'ordre compte : avant l'orientation, on echantillonnerait le sol
           aux mauvais endroits. */
        if (o.userData.poser) {
          this.groupe.updateWorldMatrix(true, false);
          o.updateMatrixWorld(true);
          o.userData.poser(relief);
        }
      }
      o.visible = false;
      this.groupe.add(o);
      this.scenes.push({ ...d, objet: o, ouverte: false });
    }
  }

  /* Le moteur audio des apparitions, branche une fois le contexte ouvert. */
  brancherSon(son) { this.son = son; }

  /* Les empreintes, sur le meme principe et pour la meme raison : le
     systeme (`Empreintes`, dans `footprints.js`) est construit APRES les
     apparitions dans `main.js`, donc `this.empreintes` n'existe pas
     encore au moment ou `FABRIQUES.trex` capture `deposerEmpreinte` dans
     son constructeur. La fermeture, elle, ne lit `this.empreintes` qu'au
     moment ou elle est APPELEE — bien plus tard, une fois le branchement
     fait — donc l'ordre de construction n'a aucune importance. */
  brancherEmpreintes(empreintes) { this.empreintes = empreintes; }

  /* On ouvre la fenetre BIEN AVANT d'arriver : une apparition qu'on decouvre
     au moment ou on la depasse est deja finie.

     `cadrageBase` est le cadrage que le cerf tiendrait s'il n'y avait pas
     d'apparition — 'route' ou 'approche', ou rien du tout si l'on est dans
     une halte ou une cinematique, auquel cas tout le mecanisme d'arret
     ci-dessous se desactive de lui-meme : l'arret du cerf pour une
     apparition ne doit jamais entrer en conflit avec l'arret pour un
     cadeau. */
  maj(dt, t, cerf, camera, drone, postfx, cadrageBase) {
    const sReel = cerf.s;
    // Pour que `emettre` (ferme plus bas, sur chaque scene) puisse secouer
    // la camera sans qu'on ait a le lui passer explicitement.
    this._droneCourant = drone;
    let assombrissement = 0;
    let teinteForce = 0;
    let teinteCouleur;
    let distorsion = 0;
    let quelquUnTient = false;
    let cibleFocus = null;

    for (const sc of this.scenes) {
      /* L'ABSCISSE EFFECTIVE. Tant qu'on ne retient pas la scene, elle suit
         le cerf reel — c'est exactement le calcul d'avant. Des qu'on la
         retient (plus bas), elle continue d'avancer TOUTE SEULE, a la
         vitesse a laquelle le cerf aurait marche : la scene se joue donc
         exactement comme prevu, minutee au meme rythme, que le cerf coure
         ou qu'il se tienne immobile pendant qu'on la regarde. */
      if (sc.sEff === undefined || !sc.enArret) sc.sEff = sReel;

      const u = (sc.sEff - (sc.s - sc.avant)) / (sc.avant + sc.apres);
      const dedans = u > 0 && u < 1;

      /* LES DEUX BASCULES. On ne se contente pas de regarder si la scene est
         dans sa fenetre : on repere l'INSTANT ou elle y entre et celui ou
         elle en sort. C'est la seule facon d'allumer une sirene une fois et
         de la couper proprement — la tester a chaque image en rallumerait
         une par image. */
      if (dedans !== sc.ouverte) {
        sc.ouverte = dedans;
        if (dedans) this.son?.ouvrir(sc.nom, sc.objet);
        else {
          this.son?.fermer(sc.nom);
          sc.objet.userData.reinit?.();
          /* La camera cesse d'etre attiree des que la scene se referme : sans
             ce relachement, elle resterait braquee sur un point maintenant
             vide jusqu'a la prochaine apparition, voire jusqu'a la halte
             suivante. Les phases de halte (PERCEE et apres) reprennent de
             toute facon la main sur `regarder` a chaque image ; ce
             relachement ne les concerne donc jamais. */
          drone?.regarder(null, 0);
          sc.enArret = false;
          sc.arretFini = false;
          sc.sEff = undefined;
        }
      }

      if (!dedans) {
        if (sc.objet.visible) sc.objet.visible = false;
        continue;
      }
      sc.objet.visible = true;
      /* L'ABSCISSE DU CERF EST PASSEE AUX SCENES. Une apparition immobile
         n'en a que faire, mais celle qui se DEPLACE le long du chemin — la
         course-poursuite — a besoin de savoir ou l'on en est pour se placer
         par rapport a nous. */
      const uu = clamp(u, 0, 1);
      sc.objet.userData.jouer(uu, t, camera, sc.s, dt);

      /* LE CERF S'ARRETE POUR LA REGARDER — SAUF CE QUI COURT DEJA TOUT SEUL.
         Une poursuite de police ou un theropode en marche sont choregraphies
         pour un observateur qui AVANCE : ils parcourent leurs quarante a
         soixante-dix metres pendant que la camera les longe, restant a peu
         pres a distance constante. Le cerf arrete, cette distance n'est plus
         bornee par rien — l'engin continue son trajet tout seul, s'eloigne
         sans plus jamais revenir, et la moitie de l'arret se passe braquee
         sur un point vide (mesure faite : les voitures sortent du champ des
         146 m et y restent sept secondes). Ces scenes-la gardent donc leur
         defile d'origine, deja regle ; seules celles qui restent SUR PLACE
         meritent qu'on s'y arrete.

         Declenche a une distance fixe de l'ancre — plafonnee a la moitie de
         l'amorce de la scene, pour qu'une fenetre courte (Shining, decouverte
         a dessein) ne force pas un freinage qui deborderait sur ce qui la
         precede. Une fois retenue, la scene ne l'est qu'UNE fois : `arretFini`
         empeche un second freinage si jamais on repassait par la
         (recommencer()). */
      if (cadrageBase && !sc.arretFini && !sc.objet.userData.suitChemin) {
        const rayon = Math.min(14, sc.avant * 0.5);
        if (!sc.enArret && sReel >= sc.s - rayon) {
          sc.enArret = true;
          /* LE CIEL A BESOIN D'UN AUTRE CADRAGE. « apparition » decale
             fortement la camera de cote — le bon choix pour un personnage
             plante en bordure de chemin, mais un contresens pour la lune ou
             Gargantua : centres sur l'axe (cote:0), places tres loin, ils
             sortent purement et simplement du cadre des qu'on s'ecarte
             autant. Ces scenes-la gardent donc le cadrage de croisiere. */
          this._holdVersLeCiel = !!sc.objet.userData.suitCamera;
        }
        if (sc.enArret) {
          quelquUnTient = true;
          sc.sEff += dt * this._vitesseVirtuelle;
          if (sc.sEff >= sc.s + sc.apres) { sc.enArret = false; sc.arretFini = true; }
        }
      }

      /* LA CAMERA REGARDE VERS L'ACTION. Une apparition qu'on croise sans que
         le drone y prete attention se lit a peine, en peripherie de cadre —
         alors que le plan de drone la doit precisement chercher, comme un
         operateur qui reagit a ce qui bouge. On tire donc le point vise vers
         la scene active pendant toute sa fenetre, avec une force qui monte
         puis redescend : jamais un a-coup a l'ouverture. A l'arret, on pousse
         bien plus fort — plus rien ne s'oppose a un cadrage compose,
         puisqu'il n'y a plus de trajectoire a suivre en meme temps. */
      if (drone) {
        const pic = sc.enArret ? 0.88 : 0.6;
        const force = smoothstep(0, 0.16, uu) * smoothstep(1, 0.80, uu) * pic;
        if (force > 0.001) {
          /* La plupart des scenes placent leur GROUPE RACINE a l'endroit
             meme qu'elles occupent, et sa position suffit donc a designer
             ou regarder. Ce n'est pas vrai de toutes : une scene « suitCamera »
             dont les elements sont chacun positionnes independamment (le
             disque de Gargantua, loin dans le ciel ; l'astronaute, pres du
             sol) peut laisser sa racine a l'origine du monde — auquel cas
             viser `sc.objet.position` braque la camera vers un point vide,
             souvent a l'oppose de la scene reelle. Ces scenes-la exposent
             donc leur propre `pointRegard`, tenu a jour a la meme place que
             ce qu'elles montrent. */
          this._viseeInteret.copy(sc.objet.userData.pointRegard || sc.objet.position);
          drone.regarder(this._viseeInteret, force);
          /* LA MISE AU POINT SUIT LE MEME POINT, MAIS SEULEMENT A L'ARRET.
             Pendant une simple traversee, le plan de nettete doit rester sur
             le cerf — sans quoi l'image entiere se brouille a chaque
             apparition croisee en marchant. A l'arret, en revanche, rien ne
             s'oppose plus a un point de vue compose : la mise au point
             glisse vers ce qu'on regarde vraiment, comme un vrai
             point-tire de cinema. */
          if (sc.enArret) cibleFocus = sc.objet.userData.pointRegard || sc.objet.position;
        }
      }

      /* L'ASSOMBRISSEMENT D'UNIVERS. Certaines scenes — le duel de sabres —
         doivent faire sentir qu'on bascule ailleurs, pas seulement montrer
         un decor de plus. `assombrit` porte la force maximale voulue par la
         scene ; l'enveloppe (monte/descend avec la fenetre) est la meme
         logique que pour le regard camera, appliquee cette fois a l'image
         entiere plutot qu'au cadrage. */
      if (sc.assombrit) {
        const env = smoothstep(0, 0.22, uu) * smoothstep(1, 0.72, uu);
        assombrissement = Math.max(assombrissement, env * sc.assombrit);
      }

      /* MEME PRINCIPE, MAIS AU RYTHME DE LA SCENE ELLE-MEME plutot qu'a celui
         de sa fenetre entiere : l'ascenseur de Shining ne doit assombrir et
         teinter l'image qu'au moment precis ou le sang jaillit, pas pendant
         toute son ouverture. La scene ecrit donc elle-meme ces valeurs dans
         son `userData` a chaque image, et on les relit ici. */
      if (sc.objet.userData.assombritDyn) {
        assombrissement = Math.max(assombrissement, sc.objet.userData.assombritDyn);
      }
      if (sc.objet.userData.teinteForceDyn) {
        teinteForce = Math.max(teinteForce, sc.objet.userData.teinteForceDyn);
        teinteCouleur = sc.objet.userData.teinteDyn ?? teinteCouleur;
      }
      if (sc.objet.userData.distorsionDyn) {
        distorsion = Math.max(distorsion, sc.objet.userData.distorsionDyn);
      }
    }

    /* LA BASCULE ARRET / REPRISE, une seule fois par changement d'etat — pas
       a chaque image, sans quoi `cadrer` et `arc` recevraient sans cesse la
       meme consigne (inoffensif, mais inutile) et surtout la vitesse
       sauvegardee se ferait ecraser par du zero des la deuxieme image de
       l'arret. */
    if (cadrageBase) {
      if (quelquUnTient && !this._enArret) {
        this._enArret = true;
        this._vitesseAvantArret = cerf.vitesseCible;
        cerf.vitesseCible = 0;
        // Le sens de l'orbite alterne d'une apparition a l'autre, comme aux
        // haltes : sans quoi les douze arrets tournent tous du meme cote.
        this._sensArc *= -1;
        drone.cadrer(this._holdVersLeCiel ? cadrageBase : 'apparition');
        drone.arc(this._sensArc * 0.05, 0.10);
      } else if (!quelquUnTient && this._enArret) {
        this._enArret = false;
        cerf.vitesseCible = this._vitesseAvantArret ?? cerf.vitesseCible;
        drone.cadrer(cadrageBase);
        drone.arc(0, 0);
      }
    }

    postfx?.assombrir(assombrissement, dt);
    postfx?.teinter(teinteCouleur, teinteForce, dt);
    postfx?.distordre(distorsion, dt);
    // Lu par `main.js` pour le point-tire de mise au point : voir plus haut.
    this.cibleFocus = cibleFocus;
  }
}
