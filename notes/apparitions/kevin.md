# Seul à la maison (Kevin McCallister)

## État actuel

La pose la plus reconnaissable du film — les deux mains sur les joues,
bouche ouverte — sur un enfant seul dans la neige. A remplacé une scène de
trois Spider-Man qui pointaient du doigt (jugée redondante avec les deux
autres apparitions Spider-Man déjà présentes). La pose a demandé trois
essais pour bien tomber (les bras partaient trop sur les côtés au début).

Cette session, sur la demande d'enrichir chaque apparition et que « ça
doit être dingue visuellement » : le titre du film dit « à la maison »,
et jusqu'ici rien dans le décor ne le racontait — un enfant seul dans la
neige, sans plus de contexte, aurait tout aussi bien pu être perdu en
forêt. La scène gagne donc :

- **Un fragment de façade** derrière lui (`porcheMaison`) : un pan de
  bardage, une porte encadrée avec poignée, une couronne de Noël, trois
  marches de perron, une fenêtre allumée à croisée (avec son propre halo
  et un léger vacillement de poste de télévision allumé seul dans une
  pièce vide), un auvent et sa guirlande de neuf ampoules qui scintillent
  chacune sur son propre rythme.
- **Un pull rayé** plutôt qu'un aplat beige uniforme (`teinteKevin`
  étendue) — deux bandes peintes par position, sans aucun coût de plus.
- **De la buée** devant sa bouche (`buee`/`majBuee`), qui se déclenche sur
  une séquence d'intervalles irréguliers mais **fixe** (jamais un vrai
  tirage aléatoire — deux visites de la balade doivent montrer le même
  souffle au même instant). « Il tremble de froid » était déjà écrit dans
  ce fichier avant cette session, mais rien ne le PROUVAIT visuellement :
  un enfant qui tremble sans jamais souffler un nuage, par une nuit
  visiblement glaciale, contredisait ce que la scène racontait déjà.

## Fichiers concernés

- `src/world/apparitions/kevin.js` — `seulALaMaison(palier)`,
  `teinteKevin(...)` (pull rayé ajouté), `POSE_KEVIN`,
  `porcheMaison()`/`majPorche(...)` (nouveau), `buee()`/`majBuee(...)`
  (nouveau)
- `src/world/apparitions/communs.js` — `halo(...)`, réutilisé tel quel
  pour la lueur de la fenêtre

## Comment marche le rythme du souffle

`INTERVALLES_SOUFFLE` est une séquence FIXE d'intervalles irréguliers
(0,85 s, 1,35 s, 0,65 s...), pas un tirage aléatoire — la même règle que
l'ordre des échanges du duel de sabres : deux visites de la balade
doivent montrer la même scène, sans quoi rien de ce qui touche au temps
n'est plus vérifiable à l'image. Le premier souffle est ancré au moment
où la scène devient effectivement visible (`souffleAmorce`, remis à zéro
par `reinit`), pas depuis un instant zéro du chemin — sans cette ancre,
la scène rejouerait un souffle déjà entamé si l'horloge globale n'est
plus à zéro au moment où le cerf approche.

## Problèmes connus / à faire

Aucun signalé.

## Idées non explorées

- Des empreintes de pas supplémentaires menant vers le porche (une
  référence discrète aux cambrioleurs du film) : non ajoutées — cette
  scène ne reçoit ni `chemin` ni `relief` en paramètre (contrairement à
  Kill Bill ou au duel de sabres), donc aucune empreinte ne pourrait
  épouser le terrain réel sans changer la signature de la fonction pour
  un gain incertain.
- Une ondulation « cri silencieux » partant de sa bouche a été envisagée
  (dans le même esprit que l'onde de choc de Mugiwara/Kill Bill/le duel
  de sabres) puis écartée : `ondeChoc` est bâtie à plat sur le plan XZ
  pour un anneau AU SOL, et l'orienter face à la caméra aurait demandé une
  geometrie séparée pour un gain marginal sur une scène qui n'a pas de
  choc à proprement parler.
