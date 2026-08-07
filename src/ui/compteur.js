/* Le compteur d'images.

   C'EST LA SEULE MESURE QUE JE N'AI JAMAIS PU FAIRE. Tout le reste de ce
   projet a ete verifie en chiffres — empreintes calees au sabot pres, arbres
   qui apparaissent a 251 m, cartes qui cachaient 64 % de leur texte. La
   fluidite, non : je rends en logiciel sur une machine sans carte graphique,
   et le nombre d'images par seconde que j'y mesure ne dit rien de ce que fait
   un telephone. J'ai donc regle la qualite a l'aveugle, en raisonnant sur des
   triangles et des appels de dessin, ce qui est une approximation et pas une
   preuve.

   Ce compteur retourne le probleme : il ne mesure rien ici, il mesure CHEZ
   CELUI QUI REGARDE. On l'active en ajoutant `?fps=1` a l'adresse, et il
   affiche de quoi diagnostiquer sans avoir a brancher quoi que ce soit :

   · les images par seconde, en moyenne glissante — un nombre instantane
     saute trop pour etre lisible ;
   · le CENTILE 5 des temps d'image sur les deux dernieres secondes. C'est lui
     qui compte vraiment : une balade a 55 images par seconde ponctuee de
     chutes a 20 se ressent comme une balade qui saccade, alors que la moyenne
     reste flatteuse. La moyenne dit le confort, le centile dit la gene ;
   · le palier retenu et la densite de rendu, pour savoir sur quelle branche
     de la detection l'appareil est tombe ;
   · les triangles et les appels de dessin de la derniere image.

   Il n'existe pas du tout quand le drapeau est absent : aucun element, aucun
   travail par image. La famille ne peut pas tomber dessus par accident. */

export class Compteur {
  constructor(renderer, palier) {
    this.renderer = renderer;
    this.palier = palier;

    this.el = document.createElement('div');
    this.el.className = 'fps';
    this.el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.el);

    // Fenetre glissante de temps d'image, en millisecondes.
    this.fenetre = new Float32Array(180);
    this.n = 0;
    this.curseur = 0;
    this._depuis = 0;

    // Sans cela, three.js remet les compteurs a zero a chaque rendu et on ne
    // lit jamais que la derniere passe de post-traitement.
    renderer.info.autoReset = false;
  }

  /* Appele une fois par image, avec le pas de temps REEL — surtout pas le pas
     lisse de la boucle, qui est justement construit pour gommer les a-coups
     qu'on cherche a mesurer. */
  maj(dtReel) {
    const ms = dtReel * 1000;
    this.fenetre[this.curseur] = ms;
    this.curseur = (this.curseur + 1) % this.fenetre.length;
    if (this.n < this.fenetre.length) this.n++;

    this._depuis += dtReel;
    if (this._depuis < 0.5) return;
    this._depuis = 0;

    const tries = Array.prototype.slice.call(this.fenetre, 0, this.n).sort((a, b) => a - b);
    const moyenne = tries.reduce((s, v) => s + v, 0) / tries.length;
    // Centile 95 des temps = centile 5 des images par seconde : le pire vecu.
    const lent = tries[Math.min(tries.length - 1, Math.floor(tries.length * 0.95))];

    const info = this.renderer.info;
    const tris = info.render.triangles;
    const appels = info.render.calls;

    const ips = 1000 / moyenne;
    const ipsBas = 1000 / lent;
    // Vert au-dessus de cinquante, orange au-dessus de trente, rouge en deca :
    // ce sont les seuils ou la gene devient perceptible, puis penible.
    const teinte = ipsBas >= 50 ? '#5FBF80' : ipsBas >= 30 ? '#F2C14E' : '#E4564A';

    this.el.innerHTML =
      `<b style="color:${teinte}">${ips.toFixed(0)}</b> ips`
      + `<i>creux ${ipsBas.toFixed(0)}</i>`
      + `<i>${this.palier.nom} · ${(this.palier.dpr || 1).toFixed(2)}x</i>`
      + `<i>${(tris / 1000).toFixed(0)}k tri · ${appels} appels</i>`;
  }

  /* A appeler juste apres le rendu : les compteurs de three.js sont cumules
     tant qu'on ne les remet pas a zero soi-meme. */
  apresRendu() {
    this.renderer.info.reset();
  }
}
