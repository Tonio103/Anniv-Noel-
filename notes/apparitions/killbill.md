# Kill Bill

## État actuel

Combinaison jaune, sabre, un adversaire masqué (façon Crazy 88), et
beaucoup de sang — la plainte la plus insistante et répétée de la session
d'origine (« ne combat personne » plusieurs fois de suite), résolue en
deux temps :

1. **Bug réel trouvé** : sa chorégraphie était calée sur une portion de
   fenêtre (`u` jusqu'à 0,88) que la caméra ne montrait jamais — elle
   bascule en cadrage d'approche de halte dès `u ≈ 0,33` dans ce cas
   précis, parce que la halte suivante est très proche. Tout le combat a
   été recompressé pour finir avant ce seuil.
2. **Le sang a été massivement amplifié** (particules, taille, durée,
   taille de la mare) après un premier correctif jugé encore trop discret.

Cette session, sur la demande explicite d'améliorer chaque apparition
d'au moins mille lignes ET que « ça doit être dingue visuellement » :

- **L'adversaire brandit desormais son propre katana** (le même
  `katana()` qu'elle, réutilisé tel quel) plutôt que d'affronter la lame
  les mains vides — un homme masqué désarmé face à un sabre racontait une
  exécution, pas un duel.
- **Il PERD ce sabre au coup fatal.** Détaché de sa main au moment exact
  du second coup, il tombe en une demi-seconde et se plante lame la
  première dans la neige à ses pieds — le geste que le commentaire de
  `touche1` (« le sabre échappe presque de la main ») annonçait sans
  jamais l'accomplir. La capture de sa position/rotation au moment du
  détachement utilise sa vraie matrice-monde du jour (`updateWorldMatrix`
  explicite, pas une approximation), convertie dans le repère de la scène
  pour pouvoir continuer d'animer sa chute indépendamment du bras qui
  vient de la lâcher.
- **La lame de Kill Bill porte une vraie traînée de mouvement** pendant
  ses deux frappes (`traineeLame`/`majTraineeLame`) : un ruban dynamique
  qui échantillonne la POINTE et la GARDE réelles de l'épée chaque image
  — pas une trajectoire synthétisée — et les relie en un arc lumineux qui
  s'efface avec l'âge. C'est la signature visuelle classique du cinéma de
  sabre, et l'arme, à cette vitesse, se lisait sans elle comme un objet
  qui téléporte d'une pose à l'autre.
- **Une onde de choc au sol** naît au point d'impact à chaque coup et
  s'élargit avant de s'effacer — la même technique que Mugiwara
  (`ondeChoc`/`majOndeChoc`), remontée dans `communs.js` dès que ce
  second fichier en a eu besoin (la règle de ce dossier : partager à
  partir du deuxième usage réel, jamais par anticipation).
- **La monture du katana est enrichie** : habaki (le collier qui cale la
  lame contre la garde), deux seppa (rondelles d'appui), un menuki sur la
  poignée et un pommeau fermé — la lame ne semble plus simplement plantée
  dans un disque.

## Fichiers concernés

- `src/world/apparitions/killbill.js` — `katana()` (habaki/seppa/menuki/
  pommeau ajoutés), `adversaireMasque(palier)` (brandit et expose son
  propre sabre via `g.userData.sabre`), `teinteMasque(...)`,
  `gerbeDeSang(N)`, `fontaineDeSang()`, `killBill(palier)`
  (choréographie de la chute d'arme, déclenchement de l'onde de choc et
  de la traînée de lame)
- `src/world/apparitions/communs.js` — `ondeChoc(...)`/`majOndeChoc(...)`
  (déplacées ici depuis `mugiwara.js` le temps de ce commit, désormais
  partagées entre les deux scènes), `traineeLame(n)`/`majTraineeLame(...)`
  (nées ici, remontées à leur tour dès que le duel de sabres en a eu
  besoin — voir `sabres.md`)

## Comment marche la traînée de lame

`majTraineeLame` lit la matrice-monde RÉELLE du sabre chaque image —
`sabreObj.updateWorldMatrix(true, false)` d'abord, parce que three.js ne
recalcule les matrices du monde qu'à l'intérieur de `renderer.render()`,
après que ce code a déjà tourné ; sans cet appel explicite, la matrice lue
serait celle de l'image précédente. Deux points fixes en repère local du
sabre (la pointe, la garde) sont transformés par cette matrice puis
ramenés dans le repère de la scène englobante (`g`, qui ne bouge jamais
une fois posée — un seul aller-retour de matrices suffit). Un historique
de neuf échantillons est décalé d'un cran par image et reconstruit en
ruban (position + couleur, dans un `BufferGeometry` réécrit chaque image),
avec une plage de dessin qui grandit progressivement tant que l'historique
n'est pas encore plein.

## Comment marche la chute de l'arme

Capturée UNE FOIS, au moment exact du coup fatal : position et rotation
monde réelles du sabre de l'adversaire, converties dans le repère de `g`
(`worldToLocal` pour la position ; `g.quaternion⁻¹ · rotationMonde` pour
l'orientation — valide parce que `g` est un enfant direct d'un groupe
non transformé, lui-même ajouté à une scène non transformée : sa rotation
locale EST sa rotation monde). L'arme est alors détachée de la main et
réattachée directement à `g`, et `jouer()` interpole sa position/rotation
vers un point d'arrivée fixe (planté dans la neige, lame vers le bas) sur
une demi-seconde amortie.

## Problèmes connus / à faire

Aucun signalé par Antoine sur cette scène précisément.

## Idées non explorées

- Un souffle visible dans l'air froid (vapeur d'haleine) aux instants
  d'effort — les deux combattants s'y prêteraient — n'a pas été ajouté :
  ce serait le premier apparition à en avoir besoin, et rien ne dit
  encore qu'une deuxième scène en aurait l'usage, ce qui en ferait un
  helper prématurément partagé plutôt qu'un vrai besoin commun.
- Le pied qui pivote pendant le demi-tour ne soulève aucune poudreuse —
  contrairement à l'impact des coups, ce n'est pas un choc, c'est un
  simple appui, et l'ajouter risquait de multiplier les déclencheurs de
  particules sans gain de lecture proportionnel.
