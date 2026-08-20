# Le terrain et la forêt

## Fichiers concernés

- `src/world/forest.js` — `class Forest` (ou équivalent) : semis des
  sapins/bouleaux, dégagements, densité croissante
- `build/collisions.mjs` — vérifie que rien ne pousse sur une scène
  statique, **exclut explicitement** les scènes mobiles de ce contrôle
- `src/world/relief.js` (relief/hauteur du sol, lu par `Halte.preparer`,
  `Forest`, etc. — non détaillé ici, consulter directement si besoin)

## Les trois règles du semis (résumées en tête de `forest.js`)

1. **on dégage un couloir de marche**, sinon le cerf traverse les troncs ;
2. la forêt s'épaissit à mesure qu'on s'enfonce (`densite = 0.52 +
   avancee * 0.48`, `avancee = pr.s / chemin.longueur`) ;
3. les arbres se rassemblent en bosquets plutôt que de se répartir
   régulièrement (un bruit 2D module la probabilité de conserver chaque
   candidat — « quelques trouées, quelques massifs »).

## Les dégagements de scène (`this.degagements`)

Un tableau de `{x, z, r}` — un cercle par scène statique qui a besoin
d'espace autour d'elle (voir le champ `degage` dans `planApparitions(L)`,
`src/world/apparitions.js`). Le rayon effectif testé au semis est **augmenté
de la demi-envergure de l'arbre candidat** (`d.r + hauteurVoulue * 0.22`) :
un sapin dont le tronc tombe juste hors zone étale quand même ses branches
dessus, et c'est le feuillage qu'on verrait traverser un personnage, pas
seulement le tronc.

`this.refusDegagement` compte les candidats effectivement rejetés à cause
d'un dégagement — pas de la curiosité : un dégagement qui ne refuse jamais
rien est indiscernable d'un dégagement qui ne s'exécute pas. C'est ce
compteur, lu par `build/collisions.mjs`, qui prouve que la règle mord
réellement plutôt que de passer au vert par accident (le semis est assez
clairsemé pour qu'aucun arbre ne tombe sur une scène par hasard, avec la
graine du jour — un test qui se contenterait de vérifier « zéro collision »
sans ce compteur passerait tout aussi bien si le mécanisme entier était
supprimé).

## L'exclusion des scènes mobiles — la source du bug T-Rex

```js
if (sc.objet.userData.suitChemin) { mobiles.push(sc.nom); continue; }
```

`build/collisions.mjs` **saute entièrement** la vérification pour toute
scène marquée `suitChemin` (aujourd'hui : `police`, `trex`). Le
commentaire du fichier est explicite : « un dégagement fixe autour d'un
point n'a aucun sens pour eux » — une scène mobile n'a pas de position
unique à dégager, elle en traverse des centaines le long de sa trajectoire.

**Conséquence directe, documentée dans `../visuel/trex-visibilite.md`** :
il n'existe aujourd'hui **aucune garantie** que le T-Rex ne traverse pas
visuellement un sapin pendant sa marche — le contrôle qui existe pour
toutes les scènes statiques est structurellement absent pour lui. C'est
très probablement exactement ce qu'Antoine a vu (« il va dans les
arbres »).

## Problèmes connus / à faire

Voir `../visuel/trex-visibilite.md` pour le diagnostic complet côté
T-Rex. Résumé du point terrain : le semis de `forest.js` est totalement
indifférent à la « voie » que suit le théropode (calée sur la tangente du
chemin, dans `jurassique()`/`trex.js`) — rien ne les met en relation.

## Idées non explorées

- Écrire un vrai contrôle de collision pour les scènes mobiles :
  échantillonner la position de la scène tout au long de sa marche simulée
  (comme le fait déjà `build/apparitions.mjs` pour trouver le meilleur
  instant de capture) et vérifier la distance aux troncs les plus proches
  sur tout l'intervalle, pas seulement à un ancrage fixe.
- Une vraie « clairière mobile » : un couloir dégagé d'arbres calé sur la
  voie du T-Rex plutôt qu'un semis complètement indifférent à son passage
  — demanderait de faire connaître au semis (`forest.js`) la trajectoire
  d'une scène mobile, pas seulement un point fixe comme aujourd'hui.
