/* Les empreintes du cerf.

   C'est le detail qui transforme la balade : sans traces, on marche derriere
   un animal qui glisse sur une nappe intacte ; avec elles, on SUIT quelqu'un.
   Et comme les sabots se posent deja a des endroits calcules (voir deerRig),
   les empreintes tombent exactement la ou il faut.

   PRINCIPE. Les traces vivent dans une texture en coordonnees monde, que le
   shader de neige echantillonne pour assombrir et creuser la surface. Couvrir
   toute la foret d'un seul coup demanderait une texture absurde : le couloir
   fait plus d'un kilometre de long et une empreinte mesure trente
   centimetres. On ne garde donc qu'une FENETRE glissante autour du cerf, de
   soixante-douze metres de cote — bien au-dela de ce que le brouillard laisse
   voir.

   Quand la fenetre se deplace, on redessine l'ancienne texture dans la
   nouvelle a sa vraie place dans le monde : le contenu se decale tout seul,
   sans calcul de decalage. Le centre est cale sur un multiple exact de texel,
   si bien que ce recopiage tombe pile sur la grille et n'introduit aucun
   flou, meme apres des centaines de deplacements.
*/

import * as THREE from 'three';

/* Empreinte de sabot : deux ongles separes par une fente. Dessinee une fois
   sur un canevas, elle sert a tous les pas. */
function tamponSabot() {
  const n = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, n, n);

  /* UNE EMPREINTE EST UN TROU, PAS UN TAMPON.

     La version precedente ajoutait autour des onglons un « halo de neige
     repoussee » a 22 % : combiné a la perturbation de normale, il rattrapait
     la lumiere et chaque pas ressortait en COUSSIN CLAIR pose sur la neige.
     On voyait une file de bosses molles, exactement l'inverse de ce qu'un
     sabot laisse.

     Il n'y a donc plus de halo du tout. Ne restent que les deux onglons,
     nets, plus une amorce de bourrelet TRES faible, uniquement a l'arriere de
     la trace — la ou la neige est reellement chassee par le pied qui pousse.
     Tout le reste de la lecture vient de l'assombrissement, qui est ce que
     produit un creux : il recoit moins de ciel. */
  /* UN DEGRADE VIT DANS LE REPERE OU ON PEINT, PAS DANS CELUI OU ON LE CREE.

     C'est le defaut qui a rendu les empreintes invisibles pendant tout ce
     temps. Le degrade etait construit avec son centre en (cx, cy) AVANT le
     translate/scale, puis peint APRES : le canevas applique la transformation
     courante au degrade comme au reste, si bien que son centre partait a
     (cx + cx·s, cy + cy) — loin du disque qu'il devait remplir. Tout le disque
     tombait donc au-dela du rayon exterieur, ou la couleur est
     `rgba(255,255,255,0)`. Le tampon etait entierement transparent : 0 pixel
     sur 4096. On ajoutait bien une empreinte a chaque poser, on la dessinait
     bien dans la carte — et on dessinait du vide.

     La forme ET son degrade sont maintenant decrits dans le MEME repere : on
     se place au centre de l'onglon, on met le repere a l'echelle, et dans ce
     repere l'onglon est une goutte de rayon 1. Impossible de les desynchroniser. */
  const onglon = (cx, cy, demiLarge, demiLong, incline) => {
    c.save();
    c.translate(cx, cy);
    c.rotate(incline);
    c.scale(demiLarge, demiLong);

    const g = c.createRadialGradient(0, 0.2, 0.05, 0, 0, 1.05);
    g.addColorStop(0.00, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.84, 'rgba(255,255,255,0.60)');
    g.addColorStop(1.00, 'rgba(255,255,255,0)');

    /* Goutte : large et arrondie a l'arriere, effilee vers l'avant (-y).
       C'est ce profil, et non un ovale, qui donne la lecture "cervide" — le
       poids porte sur l'arriere de l'onglon et la pince ouvre devant. */
    c.beginPath();
    c.moveTo(0, -1);
    c.bezierCurveTo(0.66, -0.52, 0.88, 0.42, 0, 1);
    c.bezierCurveTo(-0.88, 0.42, -0.66, -0.52, 0, -1);
    c.closePath();
    c.fillStyle = g;
    c.fill();
    c.restore();
  };

  /* Deux onglons, pointe vers le haut de l'image (soit l'avant du pas), et
     ECARTES EN POINTE : un sabot de cervide s'ouvre vers l'avant. C'est cet
     ecartement en V qui le distingue d'une trace de sanglier ou de chien. */
  onglon(n * 0.385, n * 0.45, n * 0.135, n * 0.255, -0.13);
  onglon(n * 0.615, n * 0.45, n * 0.135, n * 0.255, +0.13);

  /* La neige chassee par le pied qui pousse : un talon tres faible, en
     arriere des deux onglons. Il ne doit pas se lire tout seul — il ne fait
     qu'empecher la trace de finir net, comme decoupee a l'emporte-piece. */
  const talon = c.createRadialGradient(n * 0.5, n * 0.74, 0, n * 0.5, n * 0.74, n * 0.2);
  talon.addColorStop(0, 'rgba(255,255,255,0.30)');
  talon.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = talon;
  c.fillRect(0, n * 0.5, n, n * 0.5);

  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const ETENDUE = 72;          // cote de la fenetre, en metres

export class Empreintes {
  constructor(renderer, palier) {
    this.actif = palier.empreintes !== false;
    /* FINESSE DE LA CARTE. La fenetre fait 72 m de cote : a 1024 texels, un
       texel couvre SEPT CENTIMETRES. Une empreinte de vingt-cinq centimetres
       n'y tenait donc que sur trois texels, et le filtrage lineaire la
       ramenait a une tache grise sans forme. C'est une limite de la carte, pas
       du tampon : aussi soigne soit-il, il ne peut pas etre plus fin que la
       grille sur laquelle on le pose. */
    this.taille = palier.nom === 'haut' ? 2048 : (palier.nom === 'moyen' ? 1024 : 512);
    this.texel = ETENDUE / this.taille;

    const opts = {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false,
      generateMipmaps: false,
    };
    this.rtA = new THREE.WebGLRenderTarget(this.taille, this.taille, opts);
    this.rtB = new THREE.WebGLRenderTarget(this.taille, this.taille, opts);

    /* Camera orthographique qui regarde le sol a la verticale. Elle travaille
       en coordonnees MONDE : un tampon pose a (x, z) atterrit au bon endroit
       sans aucune conversion. */
    const h = ETENDUE / 2;
    this.cam = new THREE.OrthographicCamera(-h, h, h, -h, 0.1, 20);
    this.cam.rotation.x = -Math.PI / 2;

    this.scene = new THREE.Scene();

    /* Reserve de tampons : on en pose au plus quelques-uns par image. */
    const tex = tamponSabot();
    this.reserve = [];
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: tex, transparent: true, depthTest: false, depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      this.scene.add(m);
      this.reserve.push(m);
    }

    /* Quad de recopiage : il porte l'ancienne texture et occupe exactement
       l'ancienne fenetre, exprimee en monde. */
    this.copie = new THREE.Mesh(
      new THREE.PlaneGeometry(ETENDUE, ETENDUE),
      new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false, transparent: false })
    );
    this.copie.rotation.x = -Math.PI / 2;
    this.copie.visible = false;
    this.scene.add(this.copie);

    /* LE VOILE.

       Une trace qui ne s'efface jamais est une trace fausse : il neige, et
       une empreinte de sabot se comble en quelques minutes. Sans effacement,
       le couloir finissait laboure d'un bout a l'autre — ce qui, en plus
       d'etre faux, effacait justement l'information qu'on veut lire, a savoir
       que les traces FRAICHES sont juste derriere l'animal.

       On repasse donc un voile noir tres faible sur toute la fenetre. La
       trace s'estompe du plus vieux au plus recent, exactement comme la neige
       la recouvre. Constante de temps d'environ cinquante secondes : assez
       long pour qu'on suive la piste sur toute la traversee d'une clairiere,
       assez court pour que le sillage ait une fin visible. */
    this.voile = new THREE.Mesh(
      new THREE.PlaneGeometry(ETENDUE, ETENDUE),
      new THREE.MeshBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.05,
        depthTest: false, depthWrite: false,
      })
    );
    this.voile.rotation.x = -Math.PI / 2;
    this.voile.visible = false;
    this.scene.add(this.voile);
    this._depuisVoile = 0;

    this.centre = new THREE.Vector2(0, 0);
    this.premier = true;
    this.file = [];
  }

  get texture() { return this.rtA.texture; }

  /* Emprise courante, telle que le shader de neige doit la connaitre. */
  emprise() {
    const h = ETENDUE / 2;
    return {
      xmin: this.centre.x - h, xmax: this.centre.x + h,
      zmin: this.centre.y - h, zmax: this.centre.y + h,
    };
  }

  /* Un sabot vient de se poser. On enregistre, le rendu suivra. */
  ajouter(x, z, angle, force = 1) {
    if (!this.actif) return;
    if (this.file.length < this.reserve.length) {
      this.file.push({ x, z, angle, force, alea: Math.random() });
    }
  }

  /* A appeler dans la boucle de rendu, avant de dessiner la scene. */
  rendre(renderer, suivi, dt = 0) {
    if (!this.actif) return;

    /* Le voile est applique par bouffees plutot qu'a chaque image : une passe
       pleine fenetre par frame serait du remplissage pur pour un effet qui,
       de toute facon, ne se voit qu'a l'echelle de la dizaine de secondes. */
    this._depuisVoile += dt;
    const voiler = this._depuisVoile > 0.4 && !this.premier;

    const cible = this.centre;
    // Cale sur la grille de texels : le recopiage tombe alors pile sur les
    // texels existants et ne floute jamais les traces.
    const nx = Math.round(suivi.x / this.texel) * this.texel;
    const nz = Math.round(suivi.z / this.texel) * this.texel;
    const bouge = this.premier || Math.abs(nx - cible.x) > 3 || Math.abs(nz - cible.y) > 3;
    if (!bouge && !this.file.length && !voiler) return;

    const ancienCentre = { x: cible.x, z: cible.y };
    if (bouge) { cible.set(nx, nz); }

    const precAuto = renderer.autoClear;
    const precCible = renderer.getRenderTarget();
    const precFond = renderer.getClearColor(new THREE.Color());
    const precAlpha = renderer.getClearAlpha();

    this.cam.position.set(cible.x, 10, cible.y);
    this.cam.updateMatrixWorld();

    if (bouge) {
      /* Nouvelle fenetre : on repart d'un fond noir et on y replace
         l'ancienne texture a sa position dans le monde. */
      renderer.autoClear = true;
      renderer.setClearColor(0x000000, 1);
      this.copie.visible = !this.premier;
      this.copie.material.map = this.rtA.texture;
      this.copie.position.set(ancienCentre.x, 0, ancienCentre.z);
      for (const m of this.reserve) m.visible = false;

      renderer.setRenderTarget(this.rtB);
      renderer.render(this.scene, this.cam);

      const t = this.rtA; this.rtA = this.rtB; this.rtB = t;
      this.copie.visible = false;
      this.premier = false;
    }

    /* Le voile, puis les nouveaux pas : dans cet ordre, sinon l'empreinte
       qu'on vient de poser serait aussitot attenuee. */
    if (voiler) {
      // Proportionnelle au temps ecoule : le rythme d'effacement ne depend
      // donc pas de la cadence d'images.
      this.voile.material.opacity = Math.min(0.10, this._depuisVoile / 50);
      this.voile.position.set(cible.x, 0, cible.y);
      this.voile.visible = true;
      renderer.autoClear = false;
      renderer.setRenderTarget(this.rtA);
      renderer.render(this.scene, this.cam);
      this.voile.visible = false;
      this._depuisVoile = 0;
    }

    if (this.file.length) {
      for (let i = 0; i < this.file.length; i++) {
        const e = this.file[i];
        const m = this.reserve[i];
        /* Un sabot ne fait jamais deux fois la meme marque : la taille, le
           cap et l'appui varient d'un pas a l'autre. Sans ce desordre, la
           piste devient une frise de tampons identiques — l'oeil repere le
           motif immediatement et toute la credibilite du sol s'effondre. */
        /* CE QU'ON VOIT N'EST PAS LE SABOT, C'EST LE TROU.

           Le sabot d'un cerf mesure huit a neuf centimetres, et j'avais cale
           le tampon dessus — d'ou une trace de douze centimetres, plus fine
           qu'un texel et demi de la carte. Mais dans vingt centimetres de
           poudreuse on ne voit jamais le sabot : on voit le puits que la patte
           creuse en s'enfoncant, dont la neige se referme autour. Ce puits
           fait bel et bien vingt-cinq centimetres. Se caler dessus est a la
           fois plus juste et assez large pour que la carte le porte. */
        const taille = (0.20 + e.force * 0.09) * (0.88 + e.alea * 0.24);
        m.visible = true;
        m.position.set(e.x, 0, e.z);
        m.scale.set(taille, taille * (1.30 + e.alea * 0.18), 1);
        m.rotation.z = -e.angle + (e.alea - 0.5) * 0.34;
        // Franche : c'est l'assombrissement qui porte toute la lecture.
        m.material.opacity = (0.78 + e.force * 0.22) * (0.88 + e.alea * 0.14);
      }
      renderer.autoClear = false;
      renderer.setRenderTarget(this.rtA);
      renderer.render(this.scene, this.cam);
      for (const m of this.reserve) m.visible = false;
      this.file.length = 0;
    }

    renderer.setRenderTarget(precCible);
    renderer.autoClear = precAuto;
    renderer.setClearColor(precFond, precAlpha);
  }
}
