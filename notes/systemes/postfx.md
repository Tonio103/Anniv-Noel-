# La post-production — `PostFX`

## Fichiers concernés

- `src/core/postfx.js` — `class PostFX` : toute la chaîne d'image
- `src/world/apparitions.js` — `Apparitions.maj()` : agrège les hooks
  dynamiques par scène et appelle les méthodes de pulsation
- `src/main.js` — appelle `postfx.viser(...)` chaque image (point-tiré)

## La chaîne, dans l'ordre

Un seul triangle plein écran, pas de quad (évite la couture diagonale).
Rendu en cinq passes : (0) la scène en HDR flottant (`rtScene`, sans
écrêtage — condition pour que le halo ait quelque chose à diffuser), (1)
extraction des hautes lumières (seuil `2.1`, au-dessus de la neige
éclairée qui dépasse déjà 1 en linéaire), (2) flou séparable croisé, deux
fois, avec un pas qui s'élargit, (3) la scène entière refloutée (pour la
profondeur de champ), (4) composition finale — halo, exposition, courbe
ACES, aberration chromatique, vignettage, teinte, grain, encodage sRGB.
**L'ordre compte** : le halo s'ajoute avant la courbe de tonalité (sinon
il sature), le grain vient après (sinon la courbe l'écrase dans les
ombres où il est le plus utile).

`this.actif = palier.postfx !== 'leger'` — le palier bas rend en direct,
sans aucune de ces passes (voir `desactiver()`, qui restaure le tone
mapping natif du moteur si la surveillance de cadence retrograde vers ce
palier en cours de route).

## Le motif générique des pulsations ponctuelles

Trois méthodes suivent exactement le même patron, établi cette session
pour `assombrir` puis recopié pour `teinter` et `distordre` :

1. une valeur de base est capturée une fois au constructeur
   (`this._expoBase`, `this._vignetteBase`, `this._aberrBase`) ;
2. la méthode reçoit `force` (0 au repos, jusqu'à 1 en plein effet) et
   `dt`, calcule une cible = base ± `force * ECHELLE`, et l'atteint par
   `damp(valeurActuelle, cible, tauxDeLissage, dt)` (`core/noise.js`) ;
3. **l'appelant ne lisse jamais rien lui-même** — même un saut brutal de
   `force` d'une image à l'autre ne doit jamais se voir comme une coupe,
   donc le lissage vit dans `PostFX`, pas chez qui l'appelle.

- `assombrir(force, dt)` — ferme l'exposition (`uExpo -= f*0.46`) et
  resserre la vignette (`uVignette += f*0.42`). Écrit pour le duel de
  sabres (Star Wars) : « ailleurs que dans la balade paisible ».
- `teinter(couleur, force, dt)` — impose une couleur par-dessus l'image
  entière (`uTeinte`/`uTeinteForce`), plus mordante sur les bords que le
  centre (`mix(0.35, 1.0, smoothstep(0,0.7,r2))` dans le shader, un fluide
  qui cerne le regard plutôt qu'un filtre plat). Écrit pour le sang de
  l'ascenseur de Shining. `couleur` n'est relue que si `force > 0.01` :
  un flash qui s'éteint ne doit pas faire dériver la teinte cible vers du
  noir au passage.
- `distordre(force, dt)` — plie l'aberration chromatique existante
  (réglage discret d'objectif, quelques centièmes de pixel) vers une
  vraie distorsion (`uAberr` monte jusqu'à `+0.032`, contre un réglage
  nominal de l'ordre de `0.007`). Écrit pour Gargantua : une lentille
  gravitationnelle est littéralement la même texture visuelle qu'une
  aberration chromatique poussée. **Retombe toujours à sa base**, jamais
  en dessous — nul sur les paliers qui n'activent pas l'aberration.

**Piège déjà rencontré** : la première valeur de `distordre` (`0.09`)
avait été calculée après coup sans repasser par un calcul de déplacement
en pixels réel, et se voyait comme un défaut d'image plutôt qu'un effet
d'objectif. Toute nouvelle échelle doit être vérifiée en pixels de
décalage à mi-rayon et en coin, pas seulement « à l'œil » sur une capture.

## Comment une scène déclenche une pulsation

Une scène individuelle **n'appelle jamais** `postfx.assombrir/teinter/
distordre` directement. Elle écrit sa propre intention dans
`sc.objet.userData.assombritDyn` / `teinteDyn` / `teinteForceDyn` /
`distorsionDyn`, à chaque frame de son `jouer()`, pour un minutage fin
propre à la scène (le pic de sang de Shining, la fenêtre de visibilité du
disque de Gargantua). `Apparitions.maj()` lit ces hooks après chaque
appel à `jouer()`, agrège **par `Math.max()`** sur toutes les scènes
actives, puis appelle les trois méthodes une seule fois par frame avec le
résultat agrégé. Ajouter un effet à une nouvelle scène = écrire dans son
`userData` chaque frame, rien de plus à connecter.

## Le point-tiré de mise au point (`viser`)

`postfx.viser(distance)` amortit en douceur (`+= (d - actuel) * 0.12`) le
plan de netteté vers la distance caméra→sujet. Cette session : la
distance transmise devient `apparitions.cibleFocus` (le point regardé par
la scène retenue) quand une apparition tient le cerf, au lieu de toujours
la distance au cerf — voir `camera-drone.md`. Borné à `[2, 90]` mètres :
une distance aberrante (sujet pas encore placé, téléportation) figerait
sinon le plan de netteté hors du monde et noierait toute l'image.

## Problèmes connus / à faire

Aucun signalé par Antoine sur ce système précisément (contrairement au
texte de carte — voir `../visuel/texte-carte-pc.md` — qui est un système
DOM séparé, pas du post-traitement 3D).

## Idées non explorées

Les trois pulsations (`assombrir`/`teinter`/`distordre`) sont écrites
pour être génériques mais ne sont utilisées aujourd'hui que par une
poignée de scènes (sabres, Shining, Gargantua). Rien n'empêche une
nouvelle apparition d'en combiner plusieurs à la fois (teinte + distorsion
simultanées, par exemple) — non tenté, aucune scène actuelle n'en a eu
besoin.
