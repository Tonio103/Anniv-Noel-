# Apparitions

Douze références cinéma + culture ado, dans l'ordre où le cerf les
rencontre le long du chemin (`s` croissant). Chacune a sa fiche : ce
qu'elle montre, où elle vit dans le code, ce qui reste perfectible.

| # | Fichier | Référence | `s` (fraction) | Se lève ? |
|---|---|---|---|---|
| 1 | [`police.md`](./police.md) | Poursuite de police | 0.12 | non (mobile) |
| 2 | [`spider1.md`](./spider1.md) | Spider-Man, suspendu | 0.20 | oui |
| 3 | [`mugiwara.md`](./mugiwara.md) | Luffy — One Piece | 0.2212 | oui |
| 4 | [`killbill.md`](./killbill.md) | Kill Bill | 0.28 | oui |
| 5 | [`et.md`](./et.md) | E.T., la lune | 0.36 | oui |
| 6 | [`sabres.md`](./sabres.md) | Duel de sabres laser | 0.44 | oui |
| 7 | [`kevin.md`](./kevin.md) | Seul à la maison | 0.52 | oui |
| 8 | [`trex.md`](./trex.md) | Jurassic Park | 0.61 | non (mobile) |
| 9 | [`shining.md`](./shining.md) | Shining, l'ascenseur | 0.6522 | oui |
| 10 | [`patronus.md`](./patronus.md) | Harry Potter, le patronus | 0.70 | oui |
| 11 | [`hamburgers.md`](./hamburgers.md) | Hamburgers volants | 0.7189 | oui |
| 12 | [`gargantua.md`](./gargantua.md) | Interstellar, Gargantua | 0.78 | oui |
| 13 | [`spider2.md`](./spider2.md) | Spider-Man, en balançoire | 0.86 | oui |
| 14 | [`delorean.md`](./delorean.md) | Retour vers le futur | 0.94 | non (trop tard) |

**« Se lève ? »** fait référence au mécanisme ajouté cette session : le cerf
s'arrête et la caméra compose un vrai plan pour la plupart des apparitions
(voir `../systemes/camera-drone.md#l-arret-pour-une-apparition`). Trois
exceptions, chacune pour une raison différente — précisée dans sa fiche :
`police` et `trex` sont chorégraphiées pour un observateur qui avance (les
arrêter les laisserait s'éloigner dans le vide), et `delorean` est trop
proche de la dernière halte pour que la fenêtre d'arrêt ait la place de se
déclencher avant que la séquence de fin ne prenne la main.

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
