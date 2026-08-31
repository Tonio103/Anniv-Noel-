# Les haltes-cadeaux — machine à états

## Fichiers concernés

- `src/gifts/station.js` — `class Halte`, `export const PHASES` :
  l'orchestration d'une halte (préparer, émerger, ouvrir)
- `src/gifts/emergence.js` — `class Emergence` : le monticule qui tremble
  et laisse jaillir le paquet
- `src/gifts/giftMesh.js` — `creerCadeau(g, palier)` : boîte, ruban, nœud
- `src/main.js` — la machine à états elle-même (`entrerPhase(p)`, et le
  gros `switch (phase)` du pas de simulation)

## À ne pas confondre avec le mécanisme d'arrêt des apparitions

Deux machines à états **distinctes**, qui ne se parlent pas directement :

- celle-ci (`PHASES` de `station.js`) gouverne les **neuf haltes-cadeaux**
  du parcours — le moment où le cerf s'arrête pour de vrai, déterre un
  paquet, et où une carte givrée s'ouvre ;
- celle des apparitions (voir `camera-drone.md`, `sc.enArret` dans
  `Apparitions.maj()`) gouverne l'arrêt cinématique **temporaire** du cerf
  devant une référence cinéma, sans aucun paquet, aucune carte.

Le point de friction entre les deux est le garde-fou de `PHASES.APPROCHE`
documenté dans `camera-drone.md` : un arrêt-apparition qui tombe pendant
la zone d'approche d'une vraie halte pouvait, avant correction, se lire à
tort comme « le cerf est arrivé au cadeau ». Ne pas retoucher la condition
`cerf.s > cible.s - 1.2 || (cerf.vitesse < 0.12 && cerf.s > cible.s - 8)`
(`main.js`, `case PHASES.APPROCHE`) sans revérifier ce cas de figure par
une marche réelle.

## Les huit phases d'une halte, dans l'ordre

`ROUTE → APPROCHE → FOUILLE → PERCEE → ATTENTE → OUVERTURE → LECTURE →
REPRISE` (puis retour à `ROUTE` pour la halte suivante, ou `FIN` après la
dernière). Chacune règle `cerf.vitesseCible`, le cadrage nommé du drone
(`drone.cadrer(...)`), l'arc de caméra (`drone.arc(...)`, sens alterné
d'une halte à l'autre via `sensArc()`), et le point regardé
(`drone.regarder(...)`).

- **ROUTE** — croisière normale (`vitesseCible = 3.3`), cadrage `'route'`,
  aucun arc.
- **APPROCHE**, déclenchée dès `cerf.s > cible.s - 24` — ralentit à `2.3`,
  cadrage `'approche'`, l'arc démarre doucement (`0.045`).
- **FOUILLE**, déclenchée par la garde de distance ci-dessus — vitesse à
  `0`, cadrage `'halte'`. `halte.preparer(...)` place le paquet **toujours
  du même côté que la caméra** (le décalage latéral du drone), pas en
  alternance — sinon le cerf se retrouve pile entre l'objectif et le
  paquet une halte sur deux et le masque au moment où il sort de la
  neige ; la variété vient de l'arc de caméra, pas de la position du
  paquet. Le grondement sonore commence **sous la neige avant que l'image
  ne montre quoi que ce soit** (`sfx.grondement(...)`) — c'est l'attente
  qui fait exister le moment. Si la halte n'a rien à déterrer (clairière),
  saute directement à `ATTENTE`.
- **PERCEE** — `halte.majEmergence(dt, a, t)` fait progresser
  `Emergence` (le monticule qui tremble puis jaillit) ; la gerbe de
  poudreuse déclenche son son une seule fois (`halte._gerbeJouee`).
- **ATTENTE** — le cerf se retourne et attend (`cerf.regard = 0.8`),
  l'arc s'accélère (`0.085`), l'invite diégétique apparaît (« Touchez le
  cadeau »).
- **OUVERTURE** — `halte.majOuverture(dt, t)`, décrite en quatre temps
  précisément chorégraphiés dans `Halte.majOuverture` : le nœud se défait
  (0–22 %) → le couvercle se soulève puis bascule (15–70 %) → la calotte
  de neige glisse et tombe (18–46 %) → la lumière sort, déborde largement
  puis retombe à son niveau de croisière (28–70 %, c'est ce dépassement
  qui donne l'impression que quelque chose était enfermé) → le couvercle
  retombe et s'immobilise de travers (55–100 %, jamais suspendu en l'air).
  La boîte elle-même réagit (léger enfoncement puis rebond) — sans cette
  réaction, on regarderait deux objets indépendants au lieu d'un seul qui
  s'ouvre.
- **LECTURE** — cadrage `'lecture'`, arc à peine perceptible mais non nul
  (« ce qui empêche la carte de se poser sur une image morte, et donc de
  ressembler à une diapositive »). La carte (overlay DOM, voir
  `../visuel/README.md`/`texte-carte-pc.md`) s'ouvre et reste ancrée à la
  projection écran du cadeau — la caméra continue de respirer derrière.
- **REPRISE** — le cerf repart (`vitesseCible = 3.3`), cadrage `'route'`,
  arc remis à zéro. Après `1.4 s`, soit `viser(index+1)` et retour à
  `ROUTE` pour la halte suivante, soit bascule vers `PHASES.FIN` si
  c'était la dernière.

## `PHASES.FIN` — la fin en quatre temps

Écrite pour qu'une expérience qui suit un plan-séquence continu ne
s'interrompe jamais brutalement : `0 s` il ralentit → `2,6 s` il se
retourne (le geste qui compte, tenu) → `6,0 s` **la caméra renonce à le
suivre** et se pose (`drone.figer(ancre, poste)` — c'est le renoncement de
l'appareil qui fait la fin, pas le départ de l'animal) → `9,5 s` le texte
de clôture se pose sur la clairière allumée, sans jamais recouvrir
l'image. Le poste final est calculé, pas laissé à la dérive naturelle du
drone : figer la caméra sur place l'aurait laissée parfois au milieu de
l'arc de bougies, qui aurait alors rempli l'écran.

## Problèmes connus / à faire

Aucun signalé par Antoine sur cette machine à états précisément — les
plaintes portent sur des apparitions individuelles ou sur des systèmes
transverses (texte, T-Rex), pas sur le déroulé des haltes elles-mêmes.

## Idées non explorées

Rien d'identifié cette session.
