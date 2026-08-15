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
    // Jamais d'anneau deja plein sur une invite qui vient d'apparaitre.
    this.jauger(0);
  }

  cacher() {
    if (!this.visible) return;
    this.el.classList.add('out');
    this.visible = false;
    setTimeout(() => { if (!this.visible) this.el.hidden = true; }, 520);
  }

  /* Suit la projection du paquet a l'ecran.

     MAIS RESTE DANS LE CADRE. L'invite etait posee exactement sur la
     projection du paquet, sans borne. Quand le paquet se trouve pres d'un
     bord — ce qui arrive tout le temps, puisqu'on le place volontairement du
     cote de la camera — l'etiquette debordait : sur un ecran de 390 points,
     « Touchez le cadeau » commencait hors ecran et se lisait tronquee.

     On borne donc la position a une marge qui tient compte de la LARGEUR
     REELLE de l'etiquette, mesuree, et pas d'une valeur au jugé : le texte
     change (« Touchez le paquet », « Approchez »), et une marge fixe serait
     juste pour l'un et fausse pour l'autre. L'invite reste ainsi accrochee au
     paquet tant qu'elle le peut, et se contente de longer le bord sinon. */
  ancrer(point3D, camera) {
    if (!this.visible) return;
    const p = point3D.clone().project(camera);

    const L = window.innerWidth || 1, H = window.innerHeight || 1;

    /* On mesure L'ANNEAU ET LE TEXTE separement, et c'est le texte qui
       commande. Le libelle est en `position:absolute` sous l'anneau : il est
       donc HORS FLUX, et le rectangle de l'invite ne fait que la taille de
       l'anneau — soixante-quatorze pixels. En bornant sur cette valeur je
       laissais deborder les soixante-quinze pixels de texte de chaque cote,
       et « Touchez le cadeau » restait coupe exactement comme avant. Un
       element absolu ne dit rien de sa taille a son parent : il faut aller le
       lui demander. */
    const r = this.el.getBoundingClientRect();
    const rt = this.txt.getBoundingClientRect();
    const margeX = Math.max(r.width, rt.width) / 2 + 14;
    // Le texte pend SOUS l'anneau : la garde du bas doit l'englober.
    const margeY = r.height / 2 + rt.height + 22;

    const x = Math.min(L - margeX, Math.max(margeX, (p.x * 0.5 + 0.5) * L));
    const y = Math.min(H - margeY, Math.max(margeY, (-p.y * 0.5 + 0.5) * H));

    document.documentElement.style.setProperty('--card-x', (x / L * 100).toFixed(2) + '%');
    document.documentElement.style.setProperty('--card-y', (y / H * 100).toFixed(2) + '%');
  }

  /* MAINTENIR POUR OUVRIR — l'anneau devient sa propre jauge.

     Rien n'a ete ajoute a l'ecran : le cercle qui invitait deja a toucher le
     paquet se remplit maintenant pendant qu'on maintient, d'un filet d'or qui
     fait tout le tour a l'appui plein. C'est le meme element, une seule
     variable CSS de plus — pas une barre de progression separee, qui aurait
     ete exactement le genre de chrome que cette interface refuse partout
     ailleurs. */
  jauger(v) {
    this.el.style.setProperty('--appui', String(Math.max(0, Math.min(1, v))));
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

    /* COUPER LE SON EN UN GESTE.

       Le seul moyen de faire taire la page etait d'ouvrir un panneau et de
       tirer un curseur jusqu'a zero. C'est trop demander : quelqu'un qui
       ouvre ce lien dans un lieu public a besoin de couper MAINTENANT, pas
       de trouver un reglage. Le volume precedent est memorise, si bien que
       reactiver rend exactement ce qu'on avait. */
    this.muet = document.getElementById('muteBtn');
    this._volAvant = son.volume;
    this.muet.addEventListener('click', () => {
      const coupe = !this.muet.classList.contains('muted');
      if (coupe) { this._volAvant = son.volume || 0.62; son.reglerVolume(0); }
      else son.reglerVolume(this._volAvant);
      this.muet.classList.toggle('muted', coupe);
      this.muet.setAttribute('aria-label', coupe ? 'Remettre le son' : 'Couper le son');
      const vol = document.getElementById('vol');
      if (vol) vol.value = String(Math.round((coupe ? 0 : this._volAvant) * 100));
    });
    document.getElementById('panelClose').addEventListener('click', () => {
      this.panneau.hidden = true;
    });

    const vol = document.getElementById('vol');
    vol.addEventListener('input', () => {
      const v = Number(vol.value) / 100;
      son.reglerVolume(v);
      // C'est le bouton de coupure qui porte l'etat, pas celui des reglages.
      this.muet.classList.toggle('muted', v < 0.02);
      if (v >= 0.02) this._volAvant = v;
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
