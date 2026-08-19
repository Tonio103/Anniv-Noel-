# Duel de sabres laser (Star Wars)

## État actuel

Deux silhouettes encapuchonnées qui s'affrontent au sabre laser, un vert et
un rouge. Antoine n'avait pas reconnu la référence au premier passage — la
cause trouvée était bête : le cœur de la lame était codé en blanc fixe,
seul le halo autour portait la couleur, donc vert et rouge se ressemblaient
de loin. Corrigé (le cœur utilise vraiment la couleur passée en paramètre).
L'écran s'assombrit aussi et se resserre (vignette) pendant le duel, sur
demande explicite (« l'écran doit s'assombrir pour se sentir dans
l'univers »).

Cette session, sur la demande explicite d'enrichir chaque apparition et
que « ça doit être dingue visuellement » : le duel gagne trois effets qui
manquaient à un combat au sabre laser, tous les trois **partagés avec Kill
Bill** dès cette session (la règle de `communs.js` : partager dès le
deuxième usage réel) :

- **Une traînée de lame** sur chaque sabre (`traineeLame`/
  `majTraineeLame`) : à vingt-cinq mètres et de nuit, une lame qui change
  de pose en trois images se lisait comme un bâton qui saute d'un angle à
  l'autre plutôt que comme une lame qui balaie l'air.
- **Des étincelles au contact** (`gerbeImpact`/`majImpact`, reparamétrées
  en grains blanc-bleu minuscules et très rapides — rien à voir avec les
  éclats de glace de Mugiwara ou le sang de Kill Bill, mais la même
  mécanique de particules).
- **Une onde de choc au sol** (`ondeChoc`/`majOndeChoc`) sous le point de
  contact des lames, à chaque passe.

Un quatrième effet, propre à cette scène : **le grincement du blocage**.
Le corps à corps (le quatrième échange du répertoire, où les deux lames
restent pressées l'une contre l'autre) durait plus d'une demi-passe, mais
un seul éclat au contact s'éteignait bien avant la fin du blocage. Une
seconde gerbe, plus fine, se redéclenche maintenant à un rythme rapide et
fixe (22 fois par seconde) pendant tout le cœur du blocage — c'est le
redéclenchement, plus que l'intensité d'un seul éclat, qui fait « deux
lames qui grincent en continu » plutôt que « une deuxième étincelle ».

## Fichiers concernés

- `src/world/apparitions/sabres.js` — `duelSabres(palier)`,
  `lame(couleur, halos)`, `halolame(...)`
- `src/world/encapuchonne.js` — `creerDuelliste(palier, opts)`, `GARDES`,
  `ECHANGES` (le corps et la chorégraphie, réutilisables si une autre scène
  de duel était voulue)
- `src/world/apparitions/communs.js` — `traineeLame`/`majTraineeLame`
  (déplacées ici depuis `killbill.js` cette session, désormais partagées
  entre les deux duels), `gerbeImpact`/`majImpact` (déplacées depuis
  `mugiwara.js`), `ondeChoc`/`majOndeChoc` (déjà partagées)
- `src/core/postfx.js` — `PostFX.assombrir(force, dt)`, branché depuis
  `Apparitions.maj()` via le champ `assombrit` de l'entrée `sabres` dans
  `planApparitions`

## Comment marche le grincement du blocage

`indexBlocage` identifie une fois pour toutes, à la construction, quel
élément de `ECHANGES` contient la pose `'blocage'` — jamais un index
codé en dur, pour ne pas se désynchroniser si l'ordre du répertoire
change un jour. Chaque image, si l'échange courant EST le blocage et que
le temps de passe normalisé (`passe`) se trouve entre les deux temps clés
`blocage` de la piste (0,40 à 0,58), un compteur `Math.floor(t * 22)`
détecte le changement de tranche de temps et redéclenche la micro-gerbe
à une nouvelle position légèrement aléatoire — c'est ce jitter de
position, en plus du redéclenchement, qui empêche l'effet de se lire
comme un point fixe qui clignote.

## Problèmes connus / à faire

Aucun signalé depuis les deux correctifs précédents. Le chemin vers le
fichier des scènes dans ce document était resté `src/world/cinema.js`
depuis le découpage en fichiers par apparition (voir `notes/ROADMAP.md`) —
corrigé.

## Idées non explorées

- Les étincelles du blocage restent au point fixe (0, 1,55, 0) — le vrai
  point de contact des lames se déplace legèrement pendant le combat au
  corps à corps (les duellistes poussent, le point de blocage dérive).
  Non suivi dynamiquement : à cette distance de caméra, le jitter aléatoire
  déjà en place suffit à masquer la fixité du point moyen.
