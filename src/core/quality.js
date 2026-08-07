/* Paliers de qualite.

   La page sera ouverte sur des appareils inconnus — un telephone de 2019
   comme un PC de jeu. On choisit un palier de depart d'apres ce que la
   machine annonce, puis on surveille le temps de trame et on redescend
   si ca rame. On ne remonte jamais tout seul : une remontee provoquerait
   une oscillation visible, et un a-coup en pleine balade se remarque
   beaucoup plus qu'un rendu legerement plus simple. */

/* LA RESOLUTION EST LE PREMIER POSTE, ET DE TRES LOIN.

   Le palier bas rendait a `dpr: 1`. Sur un telephone dont l'ecran est en
   trois fois — c'est-a-dire n'importe quel telephone recent — cela revient a
   dessiner une image trois fois trop petite puis a l'etirer. Le resultat
   ressemble litteralement a une video basse definition : escaliers enormes
   sur chaque arete, silhouette du cerf en marches d'escalier.

   Aucun autre reglage ne compte tant que celui-la est faux. Un decor moins
   fourni se remarque a peine ; une image floue se remarque immediatement et
   ruine tout le reste. On accepte donc de payer la definition en premier, et
   de retirer des arbres si la machine peine — jamais l'inverse.

   Les EMPREINTES reviennent aussi au palier bas. Elles coutent une cible de
   512 pixels et deux quads par pas : c'est negligeable, et sans elles on
   suit un animal qui glisse sur une nappe intacte, ce qui vide la balade de
   son sujet meme. Les couper etait une fausse economie. */
export const PALIERS = {
  bas: {
    nom: 'bas',
    dpr: 1.6,
    arbres: 1100,
    ombres: false,
    ombreTaille: 512,
    postfx: 'moyen',      // halo + vignette + grain, pas de profondeur de champ
    flocons: 13000,
    empreintes: true,
    segTerrain: 112,
    brancheDetail: 5,
  },
  moyen: {
    nom: 'moyen',
    dpr: 2,
    arbres: 1800,
    ombres: true,
    ombreTaille: 1024,
    postfx: 'moyen',
    flocons: 22000,
    empreintes: true,
    segTerrain: 144,
    brancheDetail: 6,
  },
  haut: {
    nom: 'haut',
    dpr: 2,
    arbres: 3200,
    ombres: true,
    ombreTaille: 2048,
    postfx: 'complet',    // + profondeur de champ
    flocons: 34000,
    empreintes: true,
    segTerrain: 192,
    brancheDetail: 8,
  },
};

/* Detection de depart : on se fie surtout au type d'appareil et au nombre
   de coeurs, faute de mieux. WEBGL_debug_renderer_info donne parfois le nom
   du GPU, mais beaucoup de navigateurs le masquent maintenant. */
export function detecterPalier(gl) {
  const mobile = matchMedia('(hover: none) and (pointer: coarse)').matches;
  const coeurs = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;

  /* UN TELEPHONE N'EST PAS UNE MACHINE FAIBLE.

     La regle precedente disait : mobile → palier le plus bas, sans condition
     et sans exception. Un iPhone recent tient pourtant cette scene a soixante
     images par seconde en pleine definition ; le traiter comme un appareil de
     2019 lui imposait une image trois fois trop petite, aucune empreinte et
     un tiers des arbres. Autrement dit, la grande majorite des visiteurs — la
     famille ouvre ce lien sur son telephone — voyait la plus mauvaise version
     possible, et c'est la seule que personne n'avait regardee.

     On part donc du palier moyen sur mobile, et on ne descend que si
     l'appareil s'annonce vraiment modeste. La vigie, elle, reste la : si ca
     rame, elle retrograde en deux secondes. Il vaut bien mieux commencer trop
     haut et laisser la mesure corriger que de decider a l'avance, a partir
     d'un seul booleen, que tous les telephones se valent. */
  const modeste = coeurs <= 4 || mem <= 3;
  let nom = mobile ? (modeste ? 'bas' : 'moyen') : 'moyen';

  let gpu = '';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
  } catch { /* le navigateur a le droit de refuser */ }

  const logiciel = /swiftshader|llvmpipe|software|microsoft basic/i.test(gpu);
  const costaud = /rtx|radeon rx|geforce (gtx|rtx)|apple m[1-9]|arc a/i.test(gpu);

  /* Le palier haut reste reserve aux machines de bureau.

     Je l'avais ouvert aux telephones a six coeurs en corrigeant l'exces
     inverse. C'etait trop : mesure faite, ce palier envoie 1 070 000
     triangles par image, plus une passe d'ombre en 2048 qui redessine la
     foret une seconde fois, plus la profondeur de champ. Aucun telephone ne
     tient ca a soixante images par seconde, et le budget ainsi gaspille est
     exactement celui qu'il faut pour rendre en pleine definition — qui est,
     lui, ce qui se voit.

     Sur mobile, on prefere donc systematiquement DES PIXELS NETS A DES
     TRIANGLES EN PLUS. C'est le meme arbitrage que partout ailleurs dans ce
     fichier, et c'est celui que l'oeil recompense. */
  if (logiciel) nom = 'bas';
  else if (!mobile && (costaud || (coeurs >= 8 && mem >= 8))) nom = 'haut';

  const p = { ...PALIERS[nom] };
  /* On ne depasse jamais la densite reelle de l'ecran — inutile — mais on ne
     descend pas non plus sous 1,25 quand l'ecran est dense : c'est le seuil
     en dessous duquel l'escalier devient franchement visible. */
  const densite = window.devicePixelRatio || 1;
  p.dpr = Math.min(p.dpr, densite);
  if (densite >= 2 && !logiciel) p.dpr = Math.max(p.dpr, 1.25);
  p.mobile = mobile;
  p.logiciel = logiciel;
  p.gpu = gpu;
  return p;
}

/* Surveillance du temps de trame. On regarde une moyenne glissante plutot
   que des trames isolees : un pic ponctuel (le navigateur qui compile un
   shader) ne doit pas declencher une degradation. */
export class Vigie {
  constructor(palier, surBaisse) {
    this.palier = palier;
    this.surBaisse = surBaisse;
    this.moy = 16.7;
    this.mauvais = 0;
    this.grace = 2.5;       // on laisse la scene se mettre en place
    this.fini = palier.nom === 'bas';
  }

  tic(dt) {
    if (this.fini) return;
    if (this.grace > 0) { this.grace -= dt; return; }

    const ms = dt * 1000;
    this.moy += (ms - this.moy) * 0.06;

    // au-dela de 20 ms de moyenne (moins de 50 im/s) pendant ~2 s, on baisse
    if (this.moy > 20) {
      this.mauvais += dt;
      if (this.mauvais > 2) {
        const suivant = this.palier.nom === 'haut' ? 'moyen' : 'bas';
        this.palier = { ...PALIERS[suivant], mobile: this.palier.mobile };
        this.palier.dpr = Math.min(this.palier.dpr, window.devicePixelRatio || 1);
        this.mauvais = 0;
        this.moy = 16.7;
        this.grace = 2.5;
        this.fini = suivant === 'bas';
        this.surBaisse(this.palier);
      }
    } else {
      this.mauvais = Math.max(0, this.mauvais - dt * 0.5);
    }
  }
}
