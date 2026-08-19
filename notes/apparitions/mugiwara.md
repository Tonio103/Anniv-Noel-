# Luffy — One Piece

## État actuel

Ajoutée il y a deux sessions, sur demande explicite (« je veux one piece »,
et que ce ne soit pas une référence cinéma). Cette session, la scène est
passée d'un unique coup de poing élastique à un véritable enchaînement en
trois temps, choisi pour reprendre le geste le plus reconnaissable de la
série ET la reprise explicitement demandée par Antoine : « je veux que tu
les améliores une par une [...] avec au moins 1000 lignes de modification »
et, dans la foulée, « ça doit être dingue visuellement ».

1. **Le crochet droit** — un grand geste, lancé, qui porte loin (c'était
   déjà le seul coup de la version précédente).
2. **Le direct gauche** — le même geste en miroir, décalé dans le temps :
   un vrai enchaînement, jamais un miroir joué au même instant.
3. **« Gomu Gomu no Gatling »** — la signature ultime du personnage, une
   rafale de neuf coups courts et rapides, alternant les deux poings. Elle
   n'existait pas du tout avant cette session, et c'est précisément la
   chose qu'un spectateur qui connaît la série attend de voir.

Chacun des trois temps se conclut par un vrai IMPACT plutôt que par un
poing qui s'arrête dans le vide : une gerbe de neige/glace qui gicle au
point d'extension maximale (`gerbeImpact`/`majImpact`, déjà présente),
une onde de choc additive qui naît sous les pieds du personnage et
s'élargit (`ondeChoc`/`majOndeChoc`, nouvelle cette session), et un choc
caméra via le canal générique `emettre` — déjà utilisé par le duel de
sabres et Kill Bill, et cette fois avec une force réduite (0,40 au lieu du
défaut 0,6) pour les coups de la rafale, afin que neuf secousses à la
suite se lisent comme un tambourinement plutôt que comme un séisme.

Une petite montée en puissance (`aura`, un simple halo des helpers
partagés) grimpe juste avant la rafale et retombe d'un coup à son
déclenchement — le temps de charge classique de l'animé, qui fait lire le
Gatling comme une TECHNIQUE plutôt que comme une simple accélération des
coups précédents.

Chaque poing porte désormais une petite traînée de mouvement
(`traineeElastique`/`majTrainee`, cinq fantômes additifs qui s'effacent
avec l'âge) : à la vitesse où le poing traverse le cadre, un solide plein
sans traînée se lit comme un objet qui téléporte d'une image à l'autre.

Détails de personnage ajoutés cette session, indépendants du combat : une
cicatrice peinte sous l'œil gauche, un chapeau de paille dont le bord est
maintenant effrangé (seize brins irréguliers) avec un cordon de menton, un
liseret qui marque l'ouverture du gilet (sans lui, gilet et peau se
confondaient en un seul aplat rouge), une ceinture de corde nouée à la
place de l'ancien aplat uni, et un temps d'arrivée silencieux — un tout
petit tassement dans la neige au tout premier instant, sans choc caméra,
qui réutilise la même gerbe d'impact que les coups.

Un habitant de plus, jamais au centre du cadre : un Den Den Mushi
(l'escargot-téléphone de la série), posé dans une congère à côté du
personnage, dont les deux tiges oculaires sursautent à chaque impact
récent — la même logique de « petit témoin qui réagit sans faire
concurrence » que le hibou et le moineau de `spider1.js`.

Enfin, le tube de chaque bras élastique porte désormais une légère
ondulation radiale (torsion visible, quatre pour cent du rayon, calculée
en coordonnées normalisées avant l'étirement) plutôt qu'une surface
parfaitement lisse : un cylindre nu se lit comme un tuyau, pas comme un
membre étiré.

## Fichiers concernés

- `src/world/apparitions/mugiwara.js` — tout le fichier : `mugiwara(palier)`,
  `chapeauPaille()`, `detailCostume(os)` (nouveau), `busteElastique(couleur)`
  (tube désormais ondulé), `tendreElastique(el, origine, cible)`,
  `traineeElastique(n, couleur)`/`majTrainee(...)` (nouveau),
  `denDenMushi()`/`majDenDenMushi(...)` (nouveau),
  `monticuleNeige(rayon)` (nouveau), `teinteLuffy(...)`
- `src/world/apparitions/communs.js` — `halo(...)`, réutilisé tel quel
  pour la montée en puissance ; `gerbeImpact(n)`/`majImpact(...)` et
  `ondeChoc()`/`majOndeChoc(...)`, nées dans ce fichier puis remontées ici
  dès que Kill Bill (et, pour la seconde, le duel de sabres) en ont eu
  besoin à leur tour — voir `killbill.md`/`sabres.md`

## Comment marche le bras élastique

Ce n'est **pas** un os étiré (déformerait affreusement la peau skinnée
implicite) : c'est un cylindre séparé (`busteElastique`), redimensionné et
réorienté chaque image via `tendreElastique(el, origine, cible)` pour
relier un point fixe près de l'épaule à un poing qui s'éloigne selon une
courbe (`sin`) le temps du coup. Réutilisable tel quel si une autre scène
avait besoin d'un membre qui s'étire.

## Comment s'articulent les trois temps dans la fenêtre

La scène ne dispose que de treize mètres de fenêtre (8 avant, 5 après),
donc chaque temps est resserré et ils ne se chevauchent jamais dans le
temps :

- crochet droit : armement en `u ∈ [0,06 ; 0,24]`, tir en `[0,15 ; 0,34]` ;
- direct gauche : armement en `[0,26 ; 0,44]`, tir en `[0,35 ; 0,54]` ;
- Gatling : enveloppe en `[0,56 ; 0,93]`, neuf coups répartis sur un temps
  local `uf` recalculé à l'intérieur de cette seule fenêtre ;
- la caméra s'estompe en `[0,95 ; 1,0]`, après un court silence qui laisse
  le dernier coup de la rafale se lire avant la sortie de champ.

Un seul minuteur (`derniereImpactT`) porte l'horloge de la gerbe
d'impact, quel que soit le déclencheur — l'arrivée, un des deux gros
coups, ou un jab de la rafale — ce qui évite d'avoir à dupliquer la
logique de repositionnement/relance pour chacun.

## Problèmes connus / à faire

Aucun signalé par Antoine sur cette scène précisément. Un bug trouvé et
corrigé en écrivant la montée en puissance cette session : `aura.scale.
setScalar(1 + charge * 0.5)` écrasait l'échelle de base du halo (2,4)
posée par `halo()` à sa construction au lieu de la moduler — le halo
rétrécissait au lieu de grossir. Corrigé en multipliant par la taille de
base (`2.4 * (1 + charge * 0.5)`).

## Idées non explorées

- Le Gatling ne porte pas sa propre traînée de mouvement (contrairement
  aux deux gros coups) : à ce rythme et cette portée réduite, l'effet
  aurait probablement fusionné les neuf fantômes en un unique halo flou
  plutôt que de rester lisible coup par coup. Non tenté, pour ne pas
  risquer de brouiller la lecture de la rafale plutôt que de l'accentuer.
- Le Den Den Mushi reste muet — la vraie créature de la série est un
  téléphone, et une scène qui la fait sonner brièvement au moment de
  l'arrivée serait cohérente. Pas ajouté : la scène a déjà quatre
  déclencheurs sonores (arrivée silencieuse mise à part) via `emettre`, et
  un cinquième canal alourdirait `apparitionsSon.js` pour un gain
  marginal sur une créature qui n'est déjà qu'un détail de décor.
