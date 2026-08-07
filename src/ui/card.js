/* La carte givree.

   Le contenu est dense : des prix, des references de modeles, des liens, des
   sources. Du texte flottant dans une foret serait illisible, surtout sur un
   telephone. La carte est donc du VRAI HTML — texte net, selectionnable,
   liens cliquables — mais elle est ANCREE sur la projection a l'ecran du
   paquet ouvert. Elle appartient donc a la scene et non a une couche posee
   par-dessus, et la camera continue de respirer derriere pendant la lecture.

   Sur un ecran etroit, elle devient une feuille basse : c'est la seule
   disposition ou un texte long reste confortable au pouce. */

import { CHECKLIST } from '../content/stations.js';

/* --- dates ---------------------------------------------------------------- */
function vendrediNoir(annee) {
  // Le Black Friday tombe le lendemain de Thanksgiving,
  // soit le quatrieme jeudi de novembre.
  let jeudis = 0;
  for (let j = 1; j <= 30; j++) {
    const d = new Date(annee, 10, j);
    if (d.getDay() === 4) { jeudis++; if (jeudis === 4) return new Date(annee, 10, j + 1); }
  }
  return new Date(annee, 10, 27);
}

export function prochainVendrediNoir() {
  const a = new Date().getFullYear();
  let bf = vendrediNoir(a);
  if (Date.now() > bf.getTime() + 86400000) bf = vendrediNoir(a + 1);
  return bf;
}

export function joursAvantNoel() {
  const now = new Date();
  let noel = new Date(now.getFullYear(), 11, 25);
  if (now > noel) noel = new Date(now.getFullYear() + 1, 11, 25);
  return Math.ceil((noel - now) / 86400000);
}

/* --- rendu d'un bloc ------------------------------------------------------ */
function bloc(b) {
  switch (b.t) {
    case 'lead': return `<p class="c-lead">${b.h}</p>`;
    case 'p': return `<p class="c-body">${b.h}</p>`;
    case 'note': return `<div class="c-note ${b.tone || ''}">${b.h}</div>`;
    case 'sources': return `<div class="c-sub">${b.h}</div>`;

    /* LES FAITS, SORTIS DE LA PROSE.

       Un cadeau se decrit avec des donnees : un nom de modele, un prix, une
       longueur, une frequence, un connecteur. Elles etaient noyees dans des
       paragraphes — « ShineBurky Ruban LED COB USB 2 m, blanc chaud — autour
       de 9,99 € sur Amazon. Il se branche en USB (5 V) et a un gradateur
       tactile » — ou personne ne les cherche ni ne les retient. C'est le pave
       de texte qu'Antoine ne veut plus : non pas parce qu'il est long, mais
       parce qu'il faut le LIRE EN ENTIER pour en extraire trois chiffres.

       En tableau libelle/valeur, l'oeil saute directement a ce qu'il cherche,
       et l'ecart entre deux modeles se lit par comparaison de lignes au lieu
       de demander qu'on retienne le premier paragraphe en lisant le second. */
    case 'faits':
      return `<dl class="c-faits">${b.items.map((i) => `
        <div><dt>${i.k}</dt><dd>${i.v}</dd></div>`).join('')}</dl>`;

    case 'links':
      return `<div class="c-links">${b.items.map((i) => `
        <a class="c-link" href="${i.href}" target="_blank" rel="noopener noreferrer">
          <i>↗</i><u><b>${i.label}</b><s>${i.sub}</s></u>
        </a>`).join('')}</div>`;

    case 'milestones':
      return `<div class="c-mile">${b.items.map((i) => `
        <div class="c-mi ${i.hot ? 'hot' : ''}"><b>${i.d}</b><span>${i.s}</span></div>`).join('')}</div>`;

    case 'countdown':
      return `<div class="c-count" data-cd="${b.to}">
        <div class="c-cd"><b data-u="j">—</b><span>jours</span></div>
        <div class="c-cd"><b data-u="h">—</b><span>heures</span></div>
        <div class="c-cd"><b data-u="m">—</b><span>min</span></div>
        <div class="c-cd"><b data-u="s">—</b><span>sec</span></div>
      </div>`;

    case 'checklist':
      return `<div class="c-check">${CHECKLIST.map((i) => `
        <label class="c-ck" data-ck="${i.id}">
          <input type="checkbox">
          <u><span class="ck-t">${i.t}</span><span class="ck-d">${i.d}</span></u>
          <span class="ck-p">${i.p}</span>
        </label>`).join('')}</div>`;

    default: return '';
  }
}

const CLEF = 'foret-du-cerf-pris';

export class Carte {
  constructor(surFermeture) {
    this.el = document.getElementById('card');
    this.scroll = document.getElementById('cardScroll');
    this.bouton = document.getElementById('cardNext');
    this.visible = false;
    this._cd = null;

    this.revue = false;
    this.bouton.addEventListener('click', () => {
      const etaitRevue = this.revue;
      this.fermer();
      // Une relecture ne fait pas avancer la balade : on referme, c'est tout.
      surFermeture?.(etaitRevue);
    });
  }

  /* `revue` : on relit une carte deja vue, a la demande. Le bouton change
     alors de libelle — proposer « Suivre le cerf » alors qu'on est deja plus
     loin sur le chemin serait un mensonge sur ce qui va se passer. */
  ouvrir(card, revue = false) {
    /* La lisiere n'a pas de carte : `STATIONS[0].card` vaut null, et rien ici
       ne s'en protegeait. Le geste n'y est pas propose en jeu normal, donc le
       plantage ne s'est jamais produit — mais une carte absente est un etat
       parfaitement legitime et il ne doit pas dependre du parcours qu'il ne
       soit jamais atteint. */
    if (!card) return;
    this.revue = revue;
    /* LE TITRE ET LE PRIX SUR LA MEME LIGNE.

       Le prix flottait sous le titre dans une pastille a lui, ce qui faisait
       trois blocs empiles pour une seule information : "voici l'idee, voici
       ce qu'elle coute". Mis en vis-a-vis sur une meme ligne de base, ils se
       lisent d'un coup — c'est la mise en page d'une fiche produit, et c'est
       exactement ce qu'est cette carte.

       Un filet sous l'ensemble separe l'entete du corps. Un filet coute un
       pixel et remplace avantageusement une boite. */
    const prix = card.price
      ? `<p class="c-price"><b>${card.price.amount}</b>${
          card.price.note ? `<span>${card.price.note}</span>` : ''}</p>`
      : '';

    /* LES LIENS REMONTENT AU-DESSUS DE LA LIGNE DE FLOTTAISON.

       Mesure : zero lien d'achat sur dix etait visible sans faire defiler.
       Ils sont tous ecrits en fin de carte — ce qui est logique quand on
       redige, et desastreux quand on affiche, parce que la fin de carte est
       precisement ce qu'on ne voit pas.

       On les hisse donc juste apres le paragraphe d'accroche. C'est aussi le
       bon endroit dans la lecture : la personne vient d'apprendre de quoi il
       s'agit et combien ca coute ; « ou l'acheter » est exactement la
       question suivante. Le reste du texte explique ensuite. */
    const blocs = [...card.blocks];
    const iLiens = blocs.findIndex((b) => b.t === 'links');
    if (iLiens > 0) {
      const apresAccroche = blocs.findIndex((b) => b.t === 'lead') + 1;
      if (apresAccroche > 0 && apresAccroche < iLiens) {
        blocs.splice(apresAccroche, 0, blocs.splice(iLiens, 1)[0]);
      }
    }

    this.scroll.innerHTML =
      `<header class="c-head">
         ${card.kicker ? `<p class="c-kicker">${card.kicker}</p>` : ''}
         <div class="c-head-ligne">
           <h2 class="c-title" id="cardTitle">${card.title}</h2>
           ${prix}
         </div>
       </header>
       ${blocs.map(bloc).join('')}`;

    this.bouton.textContent = revue ? 'Fermer' : (card.next || 'Continuer');
    this.el.hidden = false;
    // Un cycle d'affichage avant d'animer, sinon la transition est sautee.
    requestAnimationFrame(() => this.el.classList.add('in'));
    this.visible = true;
    this.scroll.scrollTop = 0;

    this._brancherCases();
    this._brancherCompte();
    this._jauger();
  }

  /* Y a-t-il quelque chose sous le bord, et l'a-t-on atteint ?

     C'est mesure plutot que suppose : selon la halte, la langue du systeme et
     la taille de police choisie par la personne, la meme carte tient ou ne
     tient pas. On regarde donc la hauteur reelle, a chaque ouverture et a
     chaque redimensionnement. */
  _jauger() {
    const dedans = this.el.querySelector('.card-in');
    if (!dedans) return;
    const relire = () => {
      const reste = this.scroll.scrollHeight - this.scroll.clientHeight;
      dedans.classList.toggle('deborde', reste > 12);
      dedans.classList.toggle(
        'aBout', this.scroll.scrollTop >= reste - 14);
    };
    // Deux images d'attente : la carte arrive avec une transition, et sa
    // hauteur n'est pas encore la sienne au moment ou on l'ouvre.
    requestAnimationFrame(() => requestAnimationFrame(relire));
    if (!this._jauge) {
      this._jauge = relire;
      this.scroll.addEventListener('scroll', relire, { passive: true });
      window.addEventListener('resize', () => setTimeout(relire, 120));
    }
  }

  fermer() {
    this.el.classList.remove('in');
    this.visible = false;
    if (this._cd) { clearInterval(this._cd); this._cd = null; }
    setTimeout(() => { if (!this.visible) this.el.hidden = true; }, 650);
  }

  /* Les cases cochees restent sur l'appareil : plusieurs personnes peuvent
     consulter la liste sans se marcher dessus, et rien ne part ailleurs. */
  _brancherCases() {
    const boites = this.scroll.querySelectorAll('.c-ck');
    if (!boites.length) return;
    let pris = {};
    try { pris = JSON.parse(localStorage.getItem(CLEF) || '{}'); } catch { /* stockage refuse */ }

    for (const b of boites) {
      const id = b.dataset.ck;
      const input = b.querySelector('input');
      input.checked = !!pris[id];
      b.classList.toggle('done', !!pris[id]);
      input.addEventListener('change', () => {
        pris[id] = input.checked;
        b.classList.toggle('done', input.checked);
        try { localStorage.setItem(CLEF, JSON.stringify(pris)); } catch { /* tant pis */ }
      });
    }
  }

  _brancherCompte() {
    const zone = this.scroll.querySelector('[data-cd]');
    if (!zone) return;
    const bf = prochainVendrediNoir();

    const tic = () => {
      let d = bf - Date.now();
      if (d < 0) d = 0;
      const j = Math.floor(d / 86400000); d -= j * 86400000;
      const h = Math.floor(d / 3600000); d -= h * 3600000;
      const m = Math.floor(d / 60000); d -= m * 60000;
      const s = Math.floor(d / 1000);
      const p = (n) => String(n).padStart(2, '0');
      zone.querySelector('[data-u=j]').textContent = j;
      zone.querySelector('[data-u=h]').textContent = p(h);
      zone.querySelector('[data-u=m]').textContent = p(m);
      zone.querySelector('[data-u=s]').textContent = p(s);
    };
    tic();
    this._cd = setInterval(tic, 1000);
  }

  /* Ancrage : on suit la projection du paquet a l'ecran. Sur mobile la carte
     est une feuille basse et n'a pas besoin d'etre positionnee. */
  ancrer(point3D, camera) {
    if (!this.visible || window.innerWidth < 900) return;
    const p = point3D.clone().project(camera);
    const x = (p.x * 0.5 + 0.5) * 100;
    const y = (-p.y * 0.5 + 0.5) * 100;
    // On garde la carte du cote oppose au paquet, pour ne pas le masquer.
    const cx = x < 50 ? Math.min(x + 32, 76) : Math.max(x - 32, 24);
    document.documentElement.style.setProperty('--card-x', cx.toFixed(2) + '%');
    document.documentElement.style.setProperty(
      '--card-y', Math.max(28, Math.min(72, y)).toFixed(2) + '%'
    );
  }
}
