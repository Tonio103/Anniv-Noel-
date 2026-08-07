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
    this._dernier = -1;
  }

  /* On allume tout jusqu'a i, mais on n'anime QUE le nouveau : rejouer
     l'animation sur toute la ligne ferait clignoter un compteur, ce qu'on
     passe justement tout ce programme a eviter. */
  effacer() {
    for (const p of this.pas) p.classList.remove('on', 'neuf');
    this._dernier = -1;
  }

  marquer(i) {
    for (let k = 0; k <= i && k < this.pas.length; k++) this.pas[k].classList.add('on');
    const neuf = this.pas[i];
    if (neuf && i !== this._dernier) {
      this._dernier = i;
      neuf.classList.remove('neuf');
      // Force le navigateur a recalculer avant de remettre la classe, sinon
      // l'animation ne repart pas quand la meme empreinte est remarquee.
      void neuf.offsetWidth;
      neuf.classList.add('neuf');
      setTimeout(() => neuf.classList.remove('neuf'), 900);
    }
  }
}

/* Le texte de fin, et la porte de retour.

   Il arrive tard et par le bas, sans jamais recouvrir la clairiere : ce
   qu'on doit regarder a ce moment-la, c'est le sapin allume et les seize
   bougies, pas un ecran de generique.

   Le bouton ne recharge pas la page — le contenu est dechiffre en memoire,
   et un rechargement redemanderait le code a la famille. On recommence donc
   la balade sur place. */
export class Fin {
  constructor(surRetour) {
    this.el = document.getElementById('outro');
    this.visible = false;
    this.opacite = 0;
    document.getElementById('outroAgain').addEventListener('click', () => {
      this.cacher();
      surRetour();
    });
  }

  montrer() {
    if (this.visible) return;
    this.visible = true;
    this.el.hidden = false;
  }

  cacher() {
    this.visible = false;
  }

  /* LE FONDU EST PILOTE PAR LA BOUCLE, pas par le navigateur.

     Ni la transition CSS ni l'animation en keyframes ne convenaient : elles
     dependent de la timeline d'animation du document, qui n'avance pas quand
     le compositeur ne commet pas d'image de lui-meme. On observait alors une
     animation "running" avec un currentTime bloque a zero et un texte
     invisible, sans que rien n'indique la panne.

     Or cette page possede deja une horloge fiable, celle du rendu 3D. On s'en
     sert : une opacite ecrite en style en ligne est une valeur statique, donc
     elle s'affiche toujours, quel que soit l'etat du compositeur. C'est aussi
     ce qui rend l'apparition verifiable par capture. */
  maj(dt) {
    const cible = this.visible ? 1 : 0;
    if (Math.abs(this.opacite - cible) < 0.002) {
      if (!this.visible && !this.el.hidden && this.opacite < 0.01) {
        this.el.hidden = true;
        this.el.style.opacity = '0';
      }
      return;
    }
    // Deux secondes pour arriver, une pour partir : on entre dans une fin, on
    // en sort plus vite.
    const v = this.visible ? dt / 2.2 : -dt / 1.0;
    this.opacite = Math.min(1, Math.max(0, this.opacite + v));
    this.el.style.opacity = this.opacite.toFixed(3);
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

  /* FILET DE SECURITE SUR LE SEUIL.

     Les six elements de cet ecran arrivent en fondu par une animation CSS.
     Les passer en `backwards` a deja supprime la dependance a la FIN de
     l'animation — si les animations sont desactivees, tout s'affiche d'un
     coup. Mais il reste un cas que le CSS seul ne peut pas couvrir : une
     animation qui demarre et dont l'horloge n'avance pas. Elle reste alors
     figee dans son delai, donc a l'etat initial, donc invisible — et c'est un
     cas reellement observe ici, ou getAnimations() rapporte « running » avec
     un currentTime bloque a zero.

     Consequence si on ne fait rien : la famille ouvre une page noire, sans
     titre et sans bouton pour entrer. Pour une page dont l'unique fonction
     est d'etre lisible sur des appareils inconnus, c'est inacceptable, meme
     avec une probabilite faible.

     On verifie donc, une seule fois, trois secondes apres l'affichage : si le
     titre est toujours transparent, on coupe les animations et on montre
     tout. Un seul controle, aucun cout, et le pire cas devient « l'entree
     n'est pas animee » au lieu de « personne ne peut entrer ». */
  setTimeout(() => {
    if (entry.hidden) return;
    const titre = entry.querySelector('.entry-title');
    if (!titre || Number(getComputedStyle(titre).opacity) > 0.05) return;
    for (const el of entry.querySelectorAll('*')) {
      el.style.animation = 'none';
      el.style.opacity = '1';
      el.style.transform = 'none';
    }
  }, 3000);

  const partir = () => {
    btn.removeEventListener('click', partir);
    entry.classList.add('out');
    setTimeout(() => { entry.hidden = true; }, 1200);
    surEntree();
  };
  btn.addEventListener('click', partir);
}
