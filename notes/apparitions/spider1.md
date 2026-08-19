# Spider-Man — suspendu à un fil

## État actuel

Cette fiche a été entièrement revue en même temps que le code cette
session : la scène est passée d'un personnage seul suspendu à un fil à
une petite scène peuplée, avec deux habitants distincts de la forêt et
un décor hivernal plus détaillé, sans jamais faire concurrence au
personnage principal.

Spider-Man suspendu par un fil à une branche, un tronc complet construit
autour de lui (pas juste une touffe) pour que l'accroche se lise bien.
La scène s'ouvre désormais sur une arrivée « fraîche » : le fil oscille
plus fort qu'en régime de croisière et s'amortit vite, comme s'il venait
tout juste de se poser — sans retoucher au minutage déjà réglé.

Le tronc porte maintenant un évasement de racines, une branche cassée au
bois exposé, de la mousse sur le flanc à l'abri du vent, et des glaçons à
deux hauteurs plutôt qu'au seul point d'accroche. Deux petits habitants
de la forêt observent la scène sans jamais rivaliser avec le personnage :
un hibou perché qui tourne la tête pour le suivre puis se détourne, et un
moineau bas sur le tronc qui s'enfuit en vol dès que le personnage
s'agite pour de bon — deux réactions animales différentes à la même
apparition, l'une curieuse, l'autre craintive.

Le personnage lui-même respire légèrement entre les gestes, cligne des
yeux sur son propre rythme (resserré pendant qu'il regarde la caméra), et
tend l'oreille vers la forêt après le salut, juste avant de repartir —
un dernier battement qui le relie visuellement au hibou — et son propre
« sens arachnéen » trouve un léger écho chez le hibou lui-même, comme
si les deux repéraient la même chose au même instant. Ses yeux
s'écarquillent aussi brièvement — un seul pincement, pas un tic répété —
au tout premier instant où il repère la caméra : le réflexe classique du
personnage. Le hibou, lui, frissonne très légèrement tant qu'il ne suit
pas activement le personnage, comme un animal qui se recroqueville
contre le froid entre deux moments d'attention — et avant même de
réagir au personnage, il commence par scruter la forêt de son propre
chef, un très léger balayage de tête qui s'efface dès que le
personnage capte réellement son attention. C'est ce guet initial qui
évite qu'il paraisse figé en attendant sa réplique. Son décollage lui-même
commence par une très brève compression — le ressort qu'un oiseau
comprime toujours avant de quitter une branche — superposée au tout début
du vol plutôt que de retarder son déclenchement.

## Fichiers concernés

- `src/world/apparitions/spider1.js` — `spiderSuspendu(palier)`,
  `troncAccroche()`, `touffeExtremite()` (déplacées de `communs.js` cette
  session : elles n'étaient en réalité utilisées que par cette scène),
  `hibouPerche()`, `moineauEffraye()`, `glacons()`
- `src/world/spider.js` — `creerSpider(palier, opts)`, `POSES` (le corps
  générique, réutilisé aussi par `spider2`), `poserYeux()` (expose
  désormais les lentilles via `os.tete.userData.yeux` pour le clignement),
  `poserLanceToiles()` (le petit boîtier de lance-toile sur chaque
  poignet, visible sur les deux apparitions du personnage)
- `src/world/apparitions/communs.js` — `filDeToile()`/`tendreFil()`
  restent ici, réellement partagées avec `spider2.js` (voir
  `spider2.md` pour la fiche de la seconde apparition du personnage)

## Problèmes connus / à faire

Aucun signalé par Antoine. Un bug réel trouvé et corrigé en écrivant les
glaçons cette session : un cône `THREE.ConeGeometry` a sa pointe en +Y et
sa base large en -Y (même convention que `faisceau()` dans
`vehicules.js`) — sans rotation, les premiers glaçons se dressaient
pointe en l'air, base large en bas, comme des piquants plutôt que des
glaçons qui pendent. Corrigé par une rotation de 180° avant de les poser
(`glacon.rotation.x = Math.PI`), dans `glacons()` et dans le second jeu
de glaçons directement posé sur le tronc.

## Idées non explorées

- Le moineau, lui, reste parfaitement immobile jusqu'à son envol — le
  hibou a désormais son frisson d'ambiance (voir ci-dessus), mais un
  moineau perché a aussi de petits mouvements de tête réels ; non
  ajouté, pour ne pas multiplier les détails d'ambiance sur un
  personnage qui ne reste dans le cadre que quelques secondes avant de
  s'enfuir.
- `troncAccroche()` ne sway plus jamais (voir le commentaire dans le
  code : c'est une décision délibérée, pas un oubli) — une vraie
  vibration de la fourche au moment de l'arrivée serait plus juste
  physiquement, mais demanderait de synchroniser la rotation du tronc
  avec le calcul du point d'accroche du fil, actuellement supposé fixe.
