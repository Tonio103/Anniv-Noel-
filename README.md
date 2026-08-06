# La forêt du cerf

Une balade en 3D dans une forêt enneigée. Un cerf ouvre le chemin, un drone le
suit, et à chaque halte un cadeau se déterre de la neige. Le tout en **un seul
plan-séquence**, sans coupe ni fondu — c'est la contrainte qui structure tout le
reste, et ce qui empêche l'ensemble de retomber dans le diaporama.

Le fichier publié, `index.html`, est **auto-suffisant et chiffré** : il ne charge
aucun modèle 3D, aucune texture, aucun son. Tout est généré par le code.

---

## Ce qu'il faut savoir avant de toucher au code

**Le contenu est dans un seul fichier :** `src/content/stations.js`. Textes,
prix, liens, sources, liste à cocher — tout s'y trouve. Le reste de la balade
s'y adapte tout seul : le nombre de haltes détermine la longueur du chemin, la
densité de la forêt et le rythme de la descente vers la nuit.

**Le mot de passe n'est jamais écrit dans le dépôt.** Il est passé au moment de
la construction par une variable d'environnement.

---

## Construire

```bash
npm install
NOEL_CODE="VOTRE-CODE" npm run build      # → index.html, chiffré, prêt à publier
```

Pendant le développement, pour éviter de rechiffrer à chaque essai :

```bash
npm run dev            # http://localhost:5173, en clair, reconstruit à chaque F5
```

Paramètres d'URL utiles en développement :
`?debug=1` (journal), `?q=bas|moyen|haut` (forcer un palier de qualité).

---

## Vérifier le rendu

Le rendu se contrôle à l'œil, pas au jugé :

```bash
npm run shots                                    # captures le long du parcours
PLAN='[["a",2],["b",8],["c",4],["d",3],["e",3]]' IDX=2 npm run apercu
```

Les images sortent dans `shots/`. Le rendu se fait en logiciel (SwiftShader),
donc lentement : la simulation avance en temps simulé (`__scene.simuler(s)`) et
non en temps réel, sinon rien n'a le temps de se mettre en place.

---

## Comment c'est organisé

```
index.html              publié — coffre + charge chiffrée (généré)
build/                  assemblage, chiffrement, serveur local, captures
src/
  shell.html            squelette · styles.css   habillage
  main.js               enchaînement des moments de la balade
  content/stations.js   ← TOUT LE CONTENU
  core/                 rendu, paliers de qualité, boucle, bruit
  world/                ciel, lumière, relief, neige, forêt, chute de neige
  deer/                 maillage du cerf, démarche et cinématique inverse
  camera/               chemin (la colonne vertébrale) et caméra-drone
  gifts/                paquet, déterrement, orchestration d'une halte
  audio/                synthèse temps réel — aucun fichier son
  ui/                   carte givrée, invite, trace, repli sans WebGL
```

## Quelques partis pris, et pourquoi

**Le chemin commande tout.** `camera/path.js` définit une courbe unique. Le cerf
la suit, la caméra suit le cerf, les arbres sont semés autour d'elle et le
relief est aplani sur son passage. Comme tout en dérive, il n'existe nulle part
où « couper ».

**Les sabots ne glissent jamais.** On ne fait pas tourner des pattes en espérant
que ça colle : on décide où chaque sabot se pose *dans le monde*, et la
cinématique inverse amène la patte à ce point. Pendant l'appui, le sabot est
immobile par rapport au sol — le glissement est donc impossible par
construction, à n'importe quelle vitesse.

**La neige est la surface héroïne.** Elle occupe le plus de pixels, donc elle
porte le plus d'efforts : scintillement des cristaux dépendant du regard,
diffusion sous la surface (les zones à contre-jour ne sont jamais noires),
ombres bleues venant du ciel, ondulations sculptées par le vent.

**Pas de musique, du bruitage.** Du bruit filtré plutôt que des notes. Même la
floraison sonore d'un paquet qui s'ouvre est faite de partiels *inharmoniques* :
on entend de la lumière, jamais un accord.

**Zéro chrome.** Pas de pager, pas de flèches, pas de barre de progression. La
progression se lit dans le décor — la forêt s'épaissit, le jour tombe — et dans
une trace d'empreintes, une par halte franchie.

**Personne ne doit tomber sur un écran noir.** La page sera ouverte sur des
appareils inconnus. Si le WebGL manque ou échoue, `ui/fallback.js` sert le
contenu en clair et en entier. C'est moins beau, mais c'est le contenu qui
compte.

## Qualité adaptative

Trois paliers (`core/quality.js`). Le palier de départ vient de l'appareil ; en
cas de ralentissement durable, on redescend automatiquement. On ne remonte
jamais tout seul : une oscillation de qualité se remarque bien plus qu'un rendu
légèrement plus simple.
