/* Les rares elements d'interface qui restent a l'ecran.

   Regle : le moins possible. Pas de pager, pas de fleches, pas de barre de
   progression — ce sont eux qui transforment n'importe quoi en diaporama.
   Il ne reste donc que trois choses :

   · l'invite, un anneau qui respire sur le paquet, avec deux mots ;
   · la trace : une empreinte par halte franchie. C'est la seule mesure de
     progression, et elle est diégetique ;
   · le reglage du son.
*/

export class Invite {
  constructor() {
    this.el = document.getElementById('prompt');
    this.txt = this.el.querySelector('.prompt-txt');
    this.visible = false;
  }

  montrer(texte) {
    this.txt.textContent = texte || 'Touchez le cadeau';
    this.el.hidden = false;
    this.el.classList.remove('out');
    this.visible = true;
  }

  cacher() {
    if (!this.visible) return;
    this.el.classList.add('out');
    this.visible = false;
    setTimeout(() => { if (!this.visible) this.el.hidden = true; }, 520);
  }

  /* Suit la projection du paquet a l'ecran. */
  ancrer(point3D, camera) {
    if (!this.visible) return;
    const p = point3D.clone().project(camera);
    document.documentElement.style.setProperty('--card-x', ((p.x * 0.5 + 0.5) * 100).toFixed(2) + '%');
    document.documentElement.style.setProperty('--card-y', ((-p.y * 0.5 + 0.5) * 100).toFixed(2) + '%');
  }
}

export class Trace {
  constructor(nb) {
    this.el = document.getElementById('trail');
    this.el.innerHTML = Array.from({ length: nb }, () => '<i></i>').join('');
    this.pas = [...this.el.children];
  }

  marquer(i) {
    for (let k = 0; k <= i && k < this.pas.length; k++) this.pas[k].classList.add('on');
  }
}

export class PanneauSon {
  constructor(son) {
    this.son = son;
    this.hud = document.getElementById('hud');
    this.panneau = document.getElementById('soundPanel');
    this.bouton = document.getElementById('soundBtn');

    this.bouton.addEventListener('click', () => {
      this.panneau.hidden = !this.panneau.hidden;
    });
    document.getElementById('panelClose').addEventListener('click', () => {
      this.panneau.hidden = true;
    });

    const vol = document.getElementById('vol');
    vol.addEventListener('input', () => {
      const v = Number(vol.value) / 100;
      son.reglerVolume(v);
      this.bouton.classList.toggle('muted', v < 0.02);
    });

    for (const [id, nom] of [['swWind', 'vent'], ['swBells', 'grelots'], ['swSnow', 'neige']]) {
      document.getElementById(id).addEventListener('change', (e) => {
        son.basculer(nom, e.target.checked);
      });
    }
  }

  montrer() { this.hud.hidden = false; }

  /* Pendant la lecture d'une carte, on efface presque l'interface. */
  attenuer(oui) { this.hud.classList.toggle('dim', oui); }
}

/* Le seuil. Il ne masque pas la scene : le decor tourne deja derriere, et
   c'est le premier geste de l'utilisateur qui autorise le son. */
export function brancherSeuil(surEntree) {
  const entry = document.getElementById('entry');
  const btn = document.getElementById('enterBtn');

  const partir = () => {
    btn.removeEventListener('click', partir);
    entry.classList.add('out');
    setTimeout(() => { entry.hidden = true; }, 1200);
    surEntree();
  };
  btn.addEventListener('click', partir);
}
