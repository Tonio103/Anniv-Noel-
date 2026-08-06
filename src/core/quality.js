/* Paliers de qualite.

   La page sera ouverte sur des appareils inconnus — un telephone de 2019
   comme un PC de jeu. On choisit un palier de depart d'apres ce que la
   machine annonce, puis on surveille le temps de trame et on redescend
   si ca rame. On ne remonte jamais tout seul : une remontee provoquerait
   une oscillation visible, et un a-coup en pleine balade se remarque
   beaucoup plus qu'un rendu legerement plus simple. */

export const PALIERS = {
  bas: {
    nom: 'bas',
    dpr: 1,
    arbres: 620,
    ombres: false,
    ombreTaille: 512,
    postfx: 'leger',      // bloom seul, pas de profondeur de champ
    flocons: 2600,
    empreintes: false,
    segTerrain: 96,
    brancheDetail: 4,
  },
  moyen: {
    nom: 'moyen',
    dpr: 1.35,
    arbres: 1500,
    ombres: true,
    ombreTaille: 1024,
    postfx: 'moyen',      // bloom + vignette + grain
    flocons: 5200,
    empreintes: true,
    segTerrain: 144,
    brancheDetail: 6,
  },
  haut: {
    nom: 'haut',
    dpr: 1.75,
    arbres: 3000,
    ombres: true,
    ombreTaille: 2048,
    postfx: 'complet',    // + profondeur de champ et rais de lumiere
    flocons: 9000,
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

  let nom = mobile ? 'bas' : 'moyen';

  let gpu = '';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
  } catch { /* le navigateur a le droit de refuser */ }

  const logiciel = /swiftshader|llvmpipe|software|microsoft basic/i.test(gpu);
  const costaud = /rtx|radeon rx|geforce (gtx|rtx)|apple m[1-9]|arc a/i.test(gpu);

  if (logiciel) nom = 'bas';
  else if (!mobile && (costaud || (coeurs >= 8 && mem >= 8))) nom = 'haut';

  const p = { ...PALIERS[nom] };
  p.dpr = Math.min(p.dpr, window.devicePixelRatio || 1);
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
