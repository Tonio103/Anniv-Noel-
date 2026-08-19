# La carte de lecture est moche sur PC

Plainte d'Antoine, telle quelle : « sur PC le texte est moche ». Non corrigé
cette session sur consigne explicite — ce fichier documente un vrai
diagnostic, pas juste la plainte reformulée, pour qu'une prochaine session
puisse attaquer directement.

## Fichiers concernés

- `src/ui/card.js` — la classe `Carte`, notamment `ancrer(point3D, camera)`
  (ligne ~260)
- `src/styles.css` — bloc `@media (min-width:900px)` (ligne ~388) pour le
  positionnement desktop, et tout le bloc « TYPOGRAPHIE DE LA CARTE »
  juste après (ligne ~400+)

## Ce qu'on sait avec certitude

La carte a **deux présentations complètement différentes**, choisies par
largeur d'écran (`window.innerWidth < 900` dans `ancrer()`) :

- **Mobile** (< 900px) : une feuille fixée en bas de l'écran
  (`position:fixed; left:0;right:0;bottom:0`), hauteur plafonnée, dégradé de
  fin de contenu, indicateur « suite ↓ ». Cette présentation a visiblement
  reçu **beaucoup** d'itérations — les commentaires du CSS racontent
  plusieurs cycles de correction (cartes coupées sans le dire, indicateur
  mal placé, dégradé mal accroché...).
- **Desktop** (≥ 900px) : un panneau flottant, positionné par
  `--card-x`/`--card-y` — deux variables CSS calculées en projetant la
  position 3D du cadeau ouvert sur l'écran (`point3D.clone().project(camera)`
  dans `ancrer()`), puis centré dessus avec `transform:translate(-50%,-50%)`.
  Le code borne la position (`x` entre 24 % et 76 %, `y` entre 28 % et
  72 %) donc la carte ne devrait pas sortir de l'écran — mais **ce chemin de
  code n'a, à première vue, reçu aucune itération comparable** : un seul
  bloc `@media`, pas de commentaire de correction, rien qui indique qu'il a
  été regardé avec un vrai écran large plutôt que supposé fonctionner par
  analogie avec le mobile.

**Limite importante de cette session** : je n'ai, à aucun moment, vérifié
visuellement le rendu desktop. Tous mes contrôles caméra/cadrage ont utilisé
des viewports étroits (390 à 500px de large, en portrait) qui simulent un
téléphone — jamais un vrai viewport large. `build/parcours.mjs` prend
pourtant déjà des captures nommées `shots/pc-carte-*.png` (viewport large) —
je les ai regardées cette fois, mais **le panneau `.card-in` n'apparaît pas
du tout** dessus, alors que la balade est bien en phase `lecture`. Cause la
plus probable : `backdrop-filter:blur()` (utilisé sur `.card-in`) ne se
rend pas correctement dans Chromium piloté par `--use-angle=swiftshader`
(rendu logiciel) — donc ces captures ne prouvent rien sur l'apparence réelle
en navigateur normal, seulement que la scène 3D derrière est correcte.

## Pistes, non vérifiées

- Reprendre le panneau desktop avec le même niveau de soin que le mobile :
  contraste du texte sur le fond dégradé + flou, largeur/hauteur en
  situation réelle (pas juste en théorie), peut-être une transition moins
  brutale quand `--card-x/--card-y` sautent d'une halte à l'autre.
- Vérifier si la position projetée « saute » de façon disgracieuse pendant
  que la caméra fait son arc lent autour du cadeau (`drone.arc()`) — la
  carte est repositionnée à chaque `ancrer()`, donc si elle est appelée
  chaque image pendant que le point 3D bouge légèrement, le panneau pourrait
  trembler au lieu de rester stable.
- Tester avec un vrai Chromium en rendu GPU (pas `swiftshader`) pour obtenir
  une capture fiable de `backdrop-filter`, ou passer temporairement
  `backdrop-filter` en `none` dans un test pour isoler si c'est lui qui
  bloque le rendu logiciel.
