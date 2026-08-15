/* LE RUISSEAU GELE.

   Le plan en prevoyait un ; il n'y en a jamais eu. Ce n'est pas un ornement :
   c'est le seul endroit de toute la balade ou la matiere du sol CHANGE. Sur
   un kilometre de neige, croiser une bande de glace noire — dure, reflechie,
   parcourue de fentes blanches — redonne d'un coup une echelle et une texture
   au terrain, parce qu'on a enfin quelque chose a quoi comparer la neige.

   Il traverse le chemin, jamais le long : on le FRANCHIT, on ne le suit pas.
   Le cerf passe dessus, la camera aussi, et pendant deux secondes le sol
   n'est plus le meme. C'est aussi, accessoirement, le seul moment ou le ciel
   se reflete quelque part.

   Techniquement il est plat et pose LEGEREMENT SOUS la neige : la neige le
   recouvre partout sauf dans le lit, qui a ete creuse par le relief. On evite
   ainsi toute decoupe a faire, et le raccord est fait par la geometrie du
   terrain elle-meme.
*/

import * as THREE from 'three';
import { rng } from '../core/noise.js';

/* Fentes et bulles prises dans la glace, dessinees une fois. C'est ce
   reseau de craquelures qui fait lire "gele" plutot que "flaque".

   ET SURTOUT : DE LA NEIGE PAR-DESSUS.

   Le ruban etait une bande uniforme de bleu tres sombre — fond de texture a
   #0d1a24, multiplie par une couleur elle-meme sombre, ce qui donne du noir.
   Tant qu'il etait enterre, personne ne l'a vu. Des qu'il est sorti, il a
   traverse le bas du cadre comme une tranchee : quatre-vingt-douze metres de
   trou noir en travers d'une neige eclatante.

   Or un ruisseau gele en decembre n'est pas une patinoire propre. Il est
   couvert de neige soufflee sur la plus grande partie de sa surface, et la
   glace nue n'apparait que par plaques — la ou le vent balaie, la ou le
   courant a travaille dessous. Ce sont ces plaques, rares et lisses, qui font
   l'effet ; une bande pleine le detruit.

   On tire donc DEUX cartes du meme masque de congeres : la couleur et la
   rugosite. La ou la neige a pris, c'est blanc et mat ; ailleurs, c'est de la
   glace grise et miroitante. Elles ne peuvent pas se contredire. */
function texGlace() {
  const n = 256;
  const faire = () => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = n;
    return [cv, cv.getContext('2d')];
  };
  const [cvCol, col] = faire();
  const [cvRug, rug] = faire();

  // Glace nue : un gris bleute qui reflete le ciel, pas un trou.
  col.fillStyle = '#41586B';
  col.fillRect(0, 0, n, n);
  rug.fillStyle = '#1E1E1E';        // lisse : la glace miroite
  rug.fillRect(0, 0, n, n);

  const r = rng(9182);
  // Craquelures : des polylignes claires qui se ramifient.
  col.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    let x = r() * n, y = r() * n;
    let a = r() * Math.PI * 2;
    col.beginPath();
    col.moveTo(x, y);
    const seg = 3 + ((r() * 6) | 0);
    for (let k = 0; k < seg; k++) {
      a += (r() - 0.5) * 1.1;
      x += Math.cos(a) * (10 + r() * 34);
      y += Math.sin(a) * (10 + r() * 34);
      col.lineTo(x, y);
    }
    col.strokeStyle = `rgba(224,240,255,${0.16 + r() * 0.34})`;
    col.lineWidth = 0.6 + r() * 1.6;
    col.stroke();
  }
  // Bulles emprisonnees.
  for (let i = 0; i < 90; i++) {
    const x = r() * n, y = r() * n, rr = 0.6 + r() * 2.2;
    col.beginPath();
    col.arc(x, y, rr, 0, Math.PI * 2);
    col.fillStyle = `rgba(232,246,255,${0.10 + r() * 0.26})`;
    col.fill();
  }

  /* LA NEIGE SE RANGE SUR LES RIVES, PAS N'IMPORTE OU.

     Les congeres etaient jetees au hasard sur toute la texture — quarante-six
     taches de rayon 14 a 52 sur un carre de 256 : mesure faite, elles
     recouvraient tout, et le ruban entier passait pour de la neige. Rendu
     seul, il etait litteralement invisible. C'est la vraie raison pour
     laquelle « ca ne ressemble pas a de l'eau » : il n'y avait pas d'eau a
     voir.

     Un ruisseau gele en decembre ne s'enneige pas uniformement. Le courant a
     travaille au MILIEU, ou la glace reste nue et noire ; la neige s'accroche
     contre les RIVES, ou l'eau ne bougeait plus. Comme la coordonnee v du
     ruban va d'une rive a l'autre, il suffit de peindre la neige en haut et
     en bas de la texture et de laisser la bande centrale a la glace : le
     resultat suit tout seul la forme du cours d'eau, quel que soit son
     meandre. */
  const bord = (ctx, teinte) => {
    const rr = rng(4471);
    // Deux frontieres irregulieres, une par rive.
    for (const haut of [true, false]) {
      const ph = rr() * 6.28, ph2 = rr() * 6.28;
      ctx.beginPath();
      ctx.moveTo(0, haut ? 0 : n);
      for (let x = 0; x <= n; x += 4) {
        const w = x / n * Math.PI * 2;
        const e = 0.21 + Math.sin(w * 3 + ph) * 0.075 + Math.sin(w * 7.3 + ph2) * 0.04;
        ctx.lineTo(x, haut ? e * n : n - e * n);
      }
      ctx.lineTo(n, haut ? 0 : n);
      ctx.closePath();
      ctx.fillStyle = `rgb(${teinte})`;
      ctx.fill();
      // Le bord franc trahirait un decoupage : on l'adoucit par des touches.
      for (let i = 0; i < 70; i++) {
        const x = rr() * n;
        const w = x / n * Math.PI * 2;
        const e = 0.21 + Math.sin(w * 3 + ph) * 0.075 + Math.sin(w * 7.3 + ph2) * 0.04;
        const y = (haut ? e * n : n - e * n) + (rr() - 0.5) * 26;
        const rad = 4 + rr() * 13;
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, `rgba(${teinte},0.92)`);
        g.addColorStop(1, `rgba(${teinte},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Quelques plaques isolees au milieu : la glace n'est jamais propre.
    for (let i = 0; i < 7; i++) {
      const x = rr() * n, y = n * (0.34 + rr() * 0.32), rad = 7 + rr() * 17;
      const g = ctx.createRadialGradient(x, y, rad * 0.2, x, y, rad);
      g.addColorStop(0, `rgba(${teinte},0.88)`);
      g.addColorStop(1, `rgba(${teinte},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    }
  };
  bord(col, '236,244,252');
  bord(rug, '206,206,206');

  const couleur = new THREE.CanvasTexture(cvCol);
  couleur.wrapS = couleur.wrapT = THREE.RepeatWrapping;
  couleur.colorSpace = THREE.SRGBColorSpace;

  // La rugosite est une donnee, pas une image : surtout pas de conversion sRGB.
  const rugosite = new THREE.CanvasTexture(cvRug);
  rugosite.wrapS = rugosite.wrapT = THREE.RepeatWrapping;

  return { couleur, rugosite };
}

export class Ruisseau {
  constructor(scene, chemin, relief, palier, clairieres) {
    this.groupe = new THREE.Group();
    this.groupe.name = 'ruisseau';
    this.passages = [];

    const rand = rng(5150);
    const tex = texGlace();

    /* La glace est LISSE et SOMBRE : c'est l'inverse exact de la neige, et
       c'est ce contraste qui porte tout l'effet. Une glace claire et mate
       passerait pour de la neige tassee et ne servirait a rien. */
    /* La teinte vient desormais entierement des cartes : le materiau reste
       blanc, sinon on assombrit deux fois et on retombe dans le trou noir. */
    /* ET DE LA GLACE QUI REFLECHIT VRAIMENT.

       Une surface gelee se reconnait a une chose avant toutes les autres :
       elle RENVOIE LE CIEL. C'est ce qui la distingue de la neige, qui le
       diffuse. Avec une metallicite de 0,02 et une intensite d'environnement
       de 1,6, la part reflechie etait trop faible pour se voir sur un
       telephone de nuit — il restait une texture bleutee, donc de la peinture.

       La metallicite monte a 0,22 : ce n'est pas physiquement du metal, mais
       c'est le seul reglage qui, dans ce modele, rend la reflexion
       DIRECTIONNELLE plutot que diffuse — et une reflexion directionnelle est
       exactement ce qui fait glisser un reflet quand la camera se deplace.
       C'est ce mouvement du reflet, plus que le reflet lui-meme, qui dit
       « surface dure et lisse ». */
    const mat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF, roughness: 1.0, metalness: 0.22,
      map: tex.couleur, roughnessMap: tex.rugosite, envMapIntensity: 3.0,
      // La glace affleure le sol : sans ce decalage, les deux surfaces se
      // disputent la profondeur la ou elles se rejoignent.
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });
    /* La repetition en v etait a 0,35 : sur une coordonnee qui va d'une rive
       a l'autre, cela ne montrait qu'un tiers de la texture en travers du
       ruisseau, et surtout cela rendait impossible d'y ranger quoi que ce
       soit — la neige des rives ne serait jamais tombee sur les rives. En v
       on prend donc la texture entiere, une fois. */
    mat.map.repeat.set(0.35, 1.0);
    mat.roughnessMap.repeat.set(0.35, 1.0);

    /* LE LIT N'APPARTIENT PLUS AU RUISSEAU, IL APPARTIENT AU TERRAIN.

       On lisait ici le chemin pour placer la traversee, et on posait le ruban
       a plat dessus. C'est le relief qui porte desormais le lit creuse
       (`relief.lits`), donc on se contente de le suivre : memes traversees,
       meme meandre, mais la glace se pose AU FOND d'un vrai creux au lieu
       d'affleurer la neige. Une seule source pour la forme, sinon les deux
       finissent par diverger et la glace ressort du sol. */
    for (const lit of (relief.lits || [])) {
      const { frac, s, demi } = lit;
      const p = { x: lit.px, z: lit.pz };
      const tan = { x: lit.tx, z: lit.tz };
      const cot = { x: lit.cx, z: lit.cz };

      /* Le lit serpente : une bande droite se lirait comme une route. On
         construit un ruban le long de la perpendiculaire au chemin, en le
         faisant onduler et varier de largeur. */
      const N = 26;
      const pos = [], uv = [], idx = [];
      let plusBas = Infinity;
      const sol = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const le = (u - 0.5) * 2 * demi;
        // Meandre, plus marque au milieu ou on le voit de pres. Identique a
        // celui que le terrain a creuse : c'est la meme formule.
        const derive = Math.sin(u * 6.1 + frac * 11) * 3.4 + Math.sin(u * 13.7) * 1.1;
        // Assez etroit pour rester sur le fond plat du lit creuse : si le
        // ruban monte sur le talus, la glace repart en biais vers la neige.
        const larg = 1.86 + Math.sin(u * 4.3 + 1.2) * 0.24 + rand() * 0.16;

        const cx = p.x + cot.x * le + tan.x * derive;
        const cz = p.z + cot.z * le + tan.z * derive;
        const y = relief.hauteur(cx, cz);
        if (y < plusBas) plusBas = y;
        sol.push(y);

        for (const cote of [-1, 1]) {
          pos.push(cx + tan.x * larg * cote, y, cz + tan.z * larg * cote);
          uv.push(u * 9, (cote + 1) * 0.5);
        }
      }

      /* LE RUISSEAU ETAIT ENTERRE.

         La surface de l'eau est plate — c'est vrai, et c'est ce qui la
         distingue du sol. Mais je l'avais aplatie sur QUATRE-VINGT-DOUZE
         METRES d'un seul tenant, a l'altitude du point le plus bas de toute
         la traversee. Sur un terrain qui ondule d'un metre ou deux, cela
         enfouit le ruban partout sauf a cet unique point : la glace
         n'existait nulle part, et il ne restait en surface que les pierres de
         berge — quelques cailloux sombres semes sur une neige intacte, sans
         rien pour les expliquer.

         Un cours d'eau est plat EN TRAVERS et regulier EN LONG. On garde donc
         la platitude d'une rive a l'autre, deja acquise puisque les deux
         bords partagent la meme altitude, et on remplace l'aplatissement en
         long par un profil LISSE : l'eau ignore les bosses de detail mais
         suit la pente generale. Le maximum avec le terrain garantit qu'elle
         n'est jamais engloutie, et le decalage de polygone evite qu'elle
         clignote contre le sol la ou les deux se touchent. */
      /* LISSER, MAIS A PEINE.

         Huit passes de lissage sur vingt-sept points, c'est une moyenne sur
         presque toute la longueur : le ruban redevenait une droite, et la ou
         cette droite passait au-dessus du terrain il en sortait une DALLE
         posee en travers du paysage, avec une arete franche a un demi-metre
         au-dessus de la neige. J'avais remplace un ruisseau enterre par un
         quai de beton.

         Deux passes suffisent a effacer les bosses de detail sans quitter le
         sol. Le ruban colle alors au relief, comme une bande de glace prise
         dans la neige — ce qu'il est. */
      const lisse = sol.slice();
      for (let passe = 0; passe < 2; passe++) {
        const c = lisse.slice();
        for (let i = 1; i < lisse.length - 1; i++) {
          lisse[i] = (c[i - 1] + c[i] * 2 + c[i + 1]) * 0.25;
        }
      }
      for (let i = 0; i <= N; i++) {
        /* ET SURTOUT : IL NE DOIT JAMAIS DECOLLER.

           Le lissage seul ne suffit pas — il ne peut meme pas suffire. Un
           profil lisse passe forcement AU-DESSUS du terrain dans les creux,
           c'est sa definition ; et comme je prenais le maximum des deux pour
           l'empecher de s'enterrer, la glace s'est mise a planer au-dessus de
           chaque cuvette. Sur le telephone d'Antoine cela donnait une dalle
           sombre suspendue en travers du paysage, a hauteur de poitrine, avec
           le bord franc. C'est le pire defaut que cette scene ait eu, et je
           l'ai introduit moi-meme en corrigeant l'exces inverse.

           La regle tient en une ligne : le ruban SUIT le terrain, et le
           lissage n'a le droit de l'en ecarter que de quelques centimetres.
           On garde une surface calme — l'eau ne copie pas les bosses de
           detail — sans jamais qu'elle se detache de ce sur quoi elle pose. */
        const MARGE = 0.08;
        // Le fond du lit est desormais creuse ; la glace se pose dessus avec
        // l'epaisseur qu'aurait une eau prise en gelant, pas a ras du gravier.
        const y = Math.min(Math.max(lisse[i], sol[i] - MARGE), sol[i] + MARGE) + 0.07;
        pos[i * 6 + 1] = y;
        pos[i * 6 + 4] = y;
      }

      for (let i = 0; i < N; i++) {
        const a = i * 2, b = a + 1, c2 = a + 2, d = a + 3;
        idx.push(a, c2, b, b, c2, d);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      geo.computeBoundingSphere();

      const ruban = new THREE.Mesh(geo, mat);
      ruban.receiveShadow = false;
      ruban.castShadow = false;
      this.groupe.add(ruban);

      /* LES BERGES SONT PARTIES — et c'est la correction, pas une perte.

         J'avais tente de les fabriquer ici, en maillage a part : un liseré de
         neige monte de chaque cote du ruban, materiau standard blanc,
         `flatShading`. Mesure faite en eteignant les objets un par un, cela
         donnait deux DALLES GRISES en travers de toute l'image. La raison
         n'est pas la geometrie : c'est que la neige de cette scene n'est pas
         un materiau standard mais un shader avec diffusion sous-surface,
         scintillement et sheen rasant. Mis cote a cote, le standard rend du
         beton. Rien de blanc ne peut voisiner cette neige sans etre fait de
         la meme matiere qu'elle.

         Les berges existent donc maintenant dans le TERRAIN (`Relief._creux`),
         qui les eclaire avec le bon shader — et qui, au passage, met la glace
         reellement en contrebas. */

      /* Des pierres au bord, la ou la neige ne tient pas sur la glace. Elles
         disent que le lit est creuse, ce qu'une bande posee a plat ne peut
         pas dire toute seule. */
      const matRoche = new THREE.MeshStandardMaterial({
        color: 0x4A4E55, roughness: 0.95, flatShading: true,
      });
      const geoRoche = new THREE.IcosahedronGeometry(1, 0);
      const nbP = palier.nom === 'bas' ? 10 : 20;
      const pierres = new THREE.InstancedMesh(geoRoche, matRoche, nbP);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const v = new THREE.Vector3();
      const ech = new THREE.Vector3();
      for (let k = 0; k < nbP; k++) {
        const u = rand();
        const le = (u - 0.5) * 2 * demi;
        const derive = Math.sin(u * 6.1 + frac * 11) * 3.4 + Math.sin(u * 13.7) * 1.1;
        const cote = rand() < 0.5 ? -1 : 1;
        // Sur le talus et la levre : c'est la qu'un galet reste a decouvert,
        // pas au milieu d'un lit que la glace recouvre.
        const d = (1.7 + rand() * 1.7) * cote;
        const x = p.x + cot.x * le + tan.x * (derive + d);
        const z = p.z + cot.z * le + tan.z * (derive + d);
        const r0 = 0.16 + rand() * 0.26;
        e.set(rand() * 3, rand() * 3, rand() * 3);
        q.setFromEuler(e);
        v.set(x, relief.hauteur(x, z) - r0 * 0.35, z);
        ech.set(r0, r0 * (0.6 + rand() * 0.4), r0);
        m.compose(v, q, ech);
        pierres.setMatrixAt(k, m);
      }
      pierres.instanceMatrix.needsUpdate = true;
      pierres.castShadow = palier.ombres;
      pierres.receiveShadow = palier.ombres;
      this.groupe.add(pierres);

      this.passages.push({ s, y: plusBas });
    }

    scene.add(this.groupe);
    this.nb = this.passages.length;
  }

  /* Le cerf franchit-il la glace en ce moment ? Le son s'en sert : un sabot
     sur la glace ne crisse pas, il CLAQUE. */
  surGlace(s) {
    for (const p of this.passages) {
      if (Math.abs(s - p.s) < 2.4) return true;
    }
    return false;
  }
}
