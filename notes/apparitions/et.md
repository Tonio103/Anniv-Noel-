# E.T. — la lune

## État actuel

Une lune (disque additif, propre à la scène — la vraie lune du ciel est à
plus de 30° de l'axe caméra en permanence, donc invisible, voir le
commentaire dans le code) devant laquelle passe la silhouette du vélo en
train de décoller. A eu deux régressions successives (« la lune bouge
encore avec la caméra », « ça fait deux lunes ») avant la vraie correction :
la position ne doit **jamais** être recalculée depuis la direction
instantanée de la caméra (instable pendant les transitions de cadrage) —
seulement depuis le chemin, fixe, calculée une fois quand la fenêtre
s'ouvre.

Cette session, sur la demande explicite « vraie 3D, pas juste des carrés
et des triangles » : c'était, de tout ce dossier, la SEULE apparition
construite en image plutôt qu'en géométrie — la silhouette du vélo
vivait entièrement dans une texture peinte au `canvas`, plaquée sur un
plan unique. Un plan texturé reste un plan : vu de travers ou dès qu'une
ombre porterait sur son contour, il se trahit. Elle est donc reconstruite
comme un vrai petit assemblage 3D :

- **Le vélo et ses deux passagers** sont désormais des primitives réelles
  — cylindres orientés par quaternion pour le cadre et les membres (même
  idiome que `tendreFil`/`tendreElastique` ailleurs dans ce dossier),
  tores à rayons pour les deux roues, sphères pour les têtes, boîtes pour
  le panier et la selle. Le CONTOUR reste rigoureusement le même (c'est
  lui qui raconte le plan), mais il porte maintenant une vraie épaisseur.
- **Un halo de contre-jour** englobe la silhouette et la suit : sans lui,
  une silhouette pure se lisait comme une découpe posée SUR le disque
  plutôt que comme un objet qui bloque une vraie lumière venue de
  derrière.
- **Une traînée de poussière d'étoiles** suit le vélo le long de son arc,
  en retard (`etincellesVelo`/`majEtincelles`) — la signature visuelle de
  tout ce que E.T. touche dans le film, et ce qui fait enfin lire le bond
  comme un envol plutôt qu'un simple déplacement géométrique. Aucun
  historique de positions à tenir : la trajectoire étant une fonction
  pure de `av` (l'avancée normalisée), chaque grain échantillonne
  simplement cette fonction à un `av` plus ancien que le vélo.
- **Deux voiles de nuages** traversent lentement le disque en sens
  opposés, en fondu normal (pas additif — ils doivent MASQUER la lueur,
  pas s'y ajouter) : sans eux, une lune parfaitement propre et immobile
  se lisait comme un halo de studio plutôt que comme un vrai ciel
  nocturne.

## Fichiers concernés

- `src/world/apparitions/et.js` — `siluetteVelo()` (reconstruite en
  primitives), `segmentSilhouette(...)`/`roueSilhouette(...)` (nouveaux
  helpers locaux), `etincellesVelo(n)`/`majEtincelles(...)` (nouveau),
  `nuageLune(...)` (nouveau), `etDevantLaLune(chemin)`
- `src/world/apparitions/communs.js` — `halo(...)`, réutilisé tel quel
  pour le contre-jour

## Comment marche la silhouette 3D

`segmentSilhouette` tend un cylindre entre deux points du plan XY local
(le même idiome que `tendreFil` : orientation par
`quaternion.setFromUnitVectors`, pas de calcul d'angle à la main).
`roueSilhouette` compose un tore fin (la jante) et trois rayons construits
avec le même helper. L'ensemble est bâti dans le carré normalisé
`-0.5..0.5` en x (les mêmes proportions que l'ancien plan
`PlaneGeometry(1, 0.62)`), puis mis à l'échelle une seule fois par
`velo.scale.setScalar(13)` au moment de la construction — rien n'a changé
côté appelant. Tous les éléments partagent UN SEUL `MeshBasicMaterial`
(exposé via `g.userData.mat`), pour que faire varier l'opacité de toute
la silhouette reste une seule affectation par image, comme avant.

## Problèmes connus / à faire

Aucun signalé par Antoine sur cette scène précisément. Un bug réel évité
en écrivant l'enrichissement : la boucle `jouer()` mettait à jour
`velo.material.opacity`, valide tant que `velo` était un `Mesh` unique —
devenu un `Group` de primitives, cette ligne aurait silencieusement cessé
de rien faire (un `Group` n'a pas de `.material`). Corrigé en
`velo.userData.mat.opacity`.

## Idées non explorées

- Le vélo ne porte pas de trace de pneus/traînée de neige au sol au
  moment du décollage — non pertinent ici, la scène se joue entièrement
  en l'air devant la lune, jamais au niveau du sol.
- Le passager (la petite tête dans le panier) reste immobile ; un tout
  petit mouvement de tête aurait pu ajouter de la vie, mais à cette
  distance et cette taille à l'écran (quelques pixels), rien n'en serait
  jamais resté lisible.
