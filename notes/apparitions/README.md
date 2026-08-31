# Apparitions

Dix références cinéma + culture ado, dans l'ordre où le cerf les
rencontre le long du chemin (`s` croissant). Chacune a sa fiche : ce
qu'elle montre, où elle vit dans le code, ce qui reste perfectible.

Quatre ont été retirées : Kill Bill, le T-Rex (Jurassic Park), les
hamburgers volants et le second passage de Spider-Man (la balançoire) —
trop proches en ton du reste, ou redondants avec l'accroche du premier
Spider-Man. Les dix restantes ont ete RE-REPARTIES sur tout le chemin a
espacement regulier (voir `planApparitions` dans `index.js`) plutot que
laissees dans leur position d'origine, pour ne pas ouvrir de grands trous
silencieux.

| # | Fichier | Référence | `s` (fraction) | Se lève ? |
|---|---|---|---|---|
| 1 | [`police.md`](./police.md) | Poursuite de police | 0.12 | non (mobile) |
| 2 | [`spider1.md`](./spider1.md) | Spider-Man, suspendu | 0.2111 | oui |
| 3 | [`mugiwara.md`](./mugiwara.md) | Luffy — One Piece | 0.3022 | oui |
| 4 | [`et.md`](./et.md) | E.T., la lune | 0.3933 | oui |
| 5 | [`sabres.md`](./sabres.md) | Duel de sabres laser | 0.4844 | oui |
| 6 | [`kevin.md`](./kevin.md) | Seul à la maison | 0.5756 | oui |
| 7 | [`shining.md`](./shining.md) | Shining, l'ascenseur | 0.6667 | oui |
| 8 | [`patronus.md`](./patronus.md) | Harry Potter, le patronus | 0.7578 | oui |
| 9 | [`gargantua.md`](./gargantua.md) | Interstellar, Gargantua | 0.8489 | oui |
| 10 | [`delorean.md`](./delorean.md) | Retour vers le futur | 0.94 | non (trop tard) |

**« Se lève ? »** fait référence au mécanisme ajouté cette session : le cerf
s'arrête et la caméra compose un vrai plan pour la plupart des apparitions
(voir `../systemes/camera-drone.md#l-arret-pour-une-apparition`). Deux
exceptions, chacune pour une raison différente — précisée dans sa fiche :
`police` est chorégraphiée pour un observateur qui avance (l'arrêter la
laisserait s'éloigner dans le vide), et `delorean` est trop proche de la
dernière halte pour que la fenêtre d'arrêt ait la place de se déclencher
avant que la séquence de fin ne prenne la main.

## Mécanique commune

Toutes les apparitions passent par la même classe `Apparitions` dans
`src/world/apparitions/index.js` : `planApparitions(L)` fixe leur position et la
taille de leur fenêtre (`avant`/`apres`, en mètres, avant/après l'ancrage),
`Apparitions.maj()` les fait apparaître/disparaître, gère l'arrêt du cerf,
tire la caméra vers l'action (`drone.regarder`), et relit les hooks
optionnels qu'une scène peut écrire sur son propre `userData` :
`assombritDyn`/`teinteDyn`/`teinteForceDyn`/`distorsionDyn` pour les effets
d'écran ponctuels, `pointRegard` pour les scènes dont la racine ne bouge pas
(voir `../systemes/postfx.md` et `../systemes/camera-drone.md`).
