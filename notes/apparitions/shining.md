# Shining — l'ascenseur

## État actuel

Ajoutée cette session, en deux temps. D'abord les jumelles (robe bleue,
immobiles, qui tournent la tête ensemble d'un seul mouvement) — pas assez
pour Antoine, qui a demandé l'image la plus citée du film : un ascenseur
qui sort du sol, des portes qui s'ouvrent sur un déluge de sang continu.
Reconstruite en conséquence : un vrai ascenseur (cadre, portes en laiton
coulissantes, cage qui monte du sous-sol), un déluge de sang en boucle
(pas une seule gerbe — des particules qui rebouclent en continu tant que
les portes restent ouvertes), une mare qui grandit, et l'écran qui
s'assombrit + se teinte de rouge au moment du jaillissement.

## Fichiers concernés

- `src/world/cinema.js` — `shining(palier)`, `ascenseurOverlook()`,
  `delugeSang(N)`, `jumelle(palier)`, `teinteJumelle(...)`
- `src/core/postfx.js` — `PostFX.teinter(couleur, force, dt)`, branché via
  `userData.teinteDyn`/`teinteForceDyn` écrits par la scène elle-même
  chaque image (pas par la fenêtre entière — voir le commentaire dans
  `Apparitions.maj()` pour pourquoi cette scène a besoin de ce niveau de
  contrôle plutôt que l'enveloppe générique)

## Problèmes connus / à faire

Aucun signalé depuis la reconstruction. Fenêtre volontairement courte et
sans amorce (12 m avant, 6 m après) — c'est une scène qu'on est censé
« tomber dessus », pas voir arriver.

## Idées non explorées

Rien d'identifié.
