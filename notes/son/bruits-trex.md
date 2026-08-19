# Le T-Rex ne fait pas de bruit de pas

Plainte d'Antoine, telle quelle : « y a pas de bruit ». À nuancer tout de
suite : le T-Rex **rugit déjà** (voir plus bas) — la plainte vise donc très
probablement l'absence de bruit de PAS pendant sa marche, pas l'absence
totale de son. Non corrigé cette session sur consigne explicite.

## Fichiers concernés

- `src/world/apparitions.js` — `jurassique(...)`, la ligne
  `if (u > 0.02) g.userData.emettre?.('pas');` (le déclenchement existe déjà
  côté scène)
- `src/audio/apparitionsSon.js` — le dispatcher générique `emettre` (chaque
  scène appelle `emettre(quoi, valeur)`, qui cherche une méthode du même nom
  sur le moteur son) ; la méthode `rugir(nom)` existe (ligne ~642) mais
  **aucune méthode `pas(nom)` n'existe**

## Diagnostic

C'est un cas exactement symétrique à celui des empreintes (voir
`empreintes-trex.md`), mais côté son plutôt que visuel — et ici, la moitié
du travail est déjà faite : la scène **émet bien** l'événement `'pas'` à
chaque pas (`g.userData.emettre?.('pas')`), donc le signal existe et arrive
jusqu'au moteur son. Mais `apparitionsSon.js` ne définit aucune fonction
`pas(nom)` : le dispatcher générique
(`if (s && typeof s[quoi]==='function') s[quoi](d.nom, valeur);`) ne trouve
rien à appeler et ne fait donc rien, silencieusement — pas d'erreur, pas de
son. Le rugissement, lui, fonctionne (`rugir(nom)` existe et un réglage de
distance dédié au T-Rex existe déjà à la ligne ~769 du même fichier), ce qui
confirme qu'un seul maillon manque, pas toute la chaîne.

## Pistes, non vérifiées

- Écrire `pas(nom)` dans `apparitionsSon.js`, sur le modèle de `rugir(nom)`
  ou de ce qui existe déjà pour les pas du cerf côté `src/audio/sfx.js`
  (rappel : les bruits de pas du **cerf** ont été explicitement retirés sur
  demande d'Antoine plus tôt dans le projet — donc ne pas réutiliser cette
  fonction telle quelle sans vérifier pourquoi elle a été coupée, un
  théropode de plusieurs tonnes n'a probablement pas le même problème
  qu'un cerf trop bavard au pas).
- Un bruit de pas de théropode veut un impact grave et sourd (poids), très
  différent d'un crissement de sabot dans la neige — sans doute plus proche
  en esprit du grave de `choc(nom)` (déjà dans `apparitionsSon.js`, utilisé
  pour le contact des lames) que d'un pas classique.
- Vérifier le rythme : la marche du T-Rex vient de `marcheTrex()` — le son
  doit correspondre au moment réel où le pied touche le sol, pas à une
  cadence arbitraire, sinon le décalage se verra/s'entendra autant que
  l'absence actuelle.
