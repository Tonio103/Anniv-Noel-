/* ==========================================================================
   LE CONTENU — dix haltes le long du chemin.

   C'est le seul fichier a modifier pour changer les textes, les prix ou les
   liens. Tout le reste (foret, cerf, camera, son) s'y adapte tout seul :
   le nombre de haltes determine la longueur du parcours.

   Chaque halte porte deux choses :
     · scene  — a quoi ressemble le cadeau enfoui et son ambiance lumineuse
     · card   — ce qu'on lit quand il s'ouvre, en blocs

   Blocs disponibles :
     {t:'lead'}  accroche      {t:'p'}      paragraphe
     {t:'note'}  encadre (tone: 'warn' | 'good' | '')
     {t:'links'} liens sortants
     {t:'countdown'} compte a rebours vivant   {t:'milestones'} jalons de dates
     {t:'checklist'} recapitulatif a cocher    {t:'sources'} provenance des infos
   ========================================================================== */

/* Teintes de la palette de Noel, reprises de la version precedente */
export const HUE = {
  or:     0xF2C14E,
  orClair:0xFFE9A8,
  rouge:  0xD42B3C,
  rose:   0xF4737C,
  vert:   0x5FBF80,
  glace:  0x9FD8F2,
  ambre:  0xFFC98A,
};

export const STATIONS = [
  /* ---------------------------------------------------------------- 0 */
  {
    id: 'seuil',
    kind: 'intro',
    chapter: 'La lisière',
    /* Pas de cadeau ici : c'est le depart, le cerf se montre puis s'enfonce. */
    scene: { gift: null, light: 'crepuscule' },
    card: null,
  },

  /* ---------------------------------------------------------------- 1 */
  {
    id: 'merci',
    kind: 'gift',
    chapter: 'Déjà offert',
    /* Celui-la n'est pas enfoui : il est deja sorti, ouvert, et il brille.
       C'est la difference visuelle qui dit "celui-ci est regle". */
    scene: { gift: { size: 0.9, box: HUE.vert, ribbon: HUE.orClair, glow: HUE.orClair },
             buried: false, light: 'crepuscule' },
    prompt: 'Approchez-vous',
    card: {
      kicker: 'Avant tout le reste',
      title: 'Merci',
      blocks: [
        { t: 'lead', h: 'Le concert d’Orelsan est <strong>déjà offert</strong>. Il ne reste plus qu’à attendre.' },
        { t: 'note', tone: 'good', h: '<b>Dimanche 27&nbsp;décembre 2026</b>' },
        { t: 'p', h: 'C’est déjà le plus beau cadeau de la liste, et il est réglé. Le reste de cette balade, c’est juste au cas où.' },
        { t: 'p', h: 'Vraiment, merci pour ça&nbsp;✦' },
      ],
      next: 'Suivre le cerf',
    },
  },

  /* ---------------------------------------------------------------- 2 */
  {
    id: 'led',
    kind: 'gift',
    chapter: 'Le bandeau LED',
    scene: { gift: { size: 0.62, box: 0x2E6B47, ribbon: HUE.ambre, glow: HUE.ambre },
             buried: true, light: 'crepuscule' },
    prompt: 'Touchez le cadeau',
    card: {
      kicker: 'Pour le bureau',
      title: 'Un bandeau LED',
      price: { amount: '10 €', note: 'environ' },
      blocks: [
        { t: 'lead', h: 'À coller <strong>derrière le bureau</strong>, pour éclairer le mur en douceur. C’est tout bête, mais le soir ça change complètement la pièce.' },
        { t: 'p', h: '<strong>Le modèle repéré&nbsp;:</strong> ShineBurky Ruban LED COB USB 2&nbsp;m, blanc chaud — autour de 9,99 € sur Amazon. Il se branche en USB (5&nbsp;V) et a un gradateur tactile pour régler la luminosité. Deux mètres couvrent la largeur du bureau.' },
        { t: 'note', h: '<b>Petit truc&nbsp;:</b> l’adhésif d’origine tient rarement. Un rouleau de double-face en plus et c’est réglé.' },
        { t: 'p', h: 'C’est l’idée la moins chère de toute la liste — et honnêtement <em>une de celles qui me feraient le plus sourire</em>.' },
        { t: 'links', items: [
          { href: 'https://www.amazon.fr/s?k=ruban+LED+COB+USB+2m+blanc+chaud',
            label: 'Chercher sur Amazon', sub: 'ruban LED COB USB 2&nbsp;m blanc chaud' },
        ]},
      ],
      next: 'Suivre le cerf',
    },
  },

  /* ---------------------------------------------------------------- 3 */
  {
    id: 'deco',
    kind: 'gift',
    chapter: 'La déco',
    scene: { gift: { size: 0.74, box: 0x8E2B3A, ribbon: HUE.rose, glow: HUE.rose },
             buried: true, light: 'soir' },
    prompt: 'Touchez le cadeau',
    card: {
      kicker: 'Pour la chambre',
      title: 'De la déco',
      price: { amount: '20 €', note: 'et plus si envie' },
      blocks: [
        { t: 'lead', h: 'Deux choses pour habiller la chambre&nbsp;: un <strong>poster</strong> et une ou deux <strong>plantes</strong>.' },
        { t: 'p', h: '<strong>Le poster&nbsp;:</strong> <em>Spider-Man&nbsp;: Brand New Day</em> — le film est sorti le 31&nbsp;juillet 2026, donc les affiches officielles existent. En A2 de préférence, l’effet est bien plus fort qu’en A3. Compter 15 à 25 € sur papier épais.' },
        { t: 'p', h: '<strong>Les plantes&nbsp;:</strong> pothos, sansevieria ou zamioculcas — celles qui survivent quand on les oublie. Un pothos coûte environ 4 € en jardinerie, une sansevieria entre 8 et 30 € selon la taille.' },
        { t: 'note', h: '<b>Pour accrocher le poster&nbsp;:</b> des pastilles repositionnables plutôt que du scotch — ça ne décolle pas la peinture au démontage.' },
        { t: 'links', items: [
          { href: 'https://www.allposters.fr/-search/spider-man', label: 'Posters Spider-Man', sub: 'AllPosters' },
          { href: 'https://www.europosters.fr/recherche?q=spider-man', label: 'Europosters', sub: 'livraison France' },
          { href: 'https://www.google.com/search?q=pothos+sansevieria+zamioculcas+plante+interieur', label: 'Les plantes', sub: 'pothos, sansevieria, zamioculcas' },
        ]},
      ],
      next: 'Suivre le cerf',
    },
  },

  /* ---------------------------------------------------------------- 4 */
  {
    id: 'manette',
    kind: 'gift',
    chapter: 'La manette',
    scene: { gift: { size: 0.86, box: 0x1F5C3A, ribbon: HUE.vert, glow: HUE.vert },
             buried: true, light: 'soir' },
    prompt: 'Touchez le cadeau',
    card: {
      kicker: 'Pour jouer',
      title: 'Une manette',
      price: { amount: '40 €', note: 'environ' },
      blocks: [
        { t: 'lead', h: 'Une manette <strong>pour le PC</strong>. Beaucoup de jeux se jouent bien mieux à la manette qu’au clavier, et ça permet aussi de jouer à deux.' },
        { t: 'p', h: '<strong>Le modèle repéré&nbsp;:</strong> GameSir Nova&nbsp;2 Lite — sous les 40 €, considérée comme l’une des meilleures manettes PC à petit prix en 2026. Sans fil 2,4&nbsp;GHz (à 1000&nbsp;Hz), mais aussi Bluetooth et filaire. Deux boutons arrière personnalisables.' },
        { t: 'p', h: '<strong>Une alternative encore moins chère&nbsp;:</strong> la 8BitDo Ultimate&nbsp;2C, autour de 30 €, avec sticks et gâchettes à effet Hall — la technologie qui empêche la dérive des sticks avec le temps.' },
        { t: 'note', tone: 'good', h: '<b>Une des meilleures cibles du Black Friday.</b> Les manettes font partie des produits les plus régulièrement remisés fin novembre. Attendre le 27&nbsp;novembre peut faire économiser 10 à 15 €.' },
        { t: 'links', items: [
          { href: 'https://www.amazon.fr/s?k=GameSir+Nova+2+Lite', label: 'GameSir Nova&nbsp;2 Lite', sub: 'sur Amazon' },
          { href: 'https://www.gamesir.hk/', label: 'Site GameSir', sub: 'officiel' },
          { href: 'https://www.amazon.fr/s?k=8BitDo+Ultimate+2C', label: '8BitDo Ultimate&nbsp;2C', sub: 'sticks à effet Hall' },
        ]},
      ],
      next: 'Suivre le cerf',
    },
  },

  /* ---------------------------------------------------------------- 5 */
  {
    id: 'gta',
    kind: 'gift',
    chapter: 'GTA 6',
    scene: { gift: { size: 0.95, box: 0x6E1420, ribbon: HUE.rouge, glow: HUE.rouge },
             buried: true, light: 'nuit' },
    prompt: 'Touchez le cadeau',
    card: {
      kicker: 'Le jeu de l’année',
      title: 'GTA 6',
      price: { amount: '80 €', note: 'édition standard' },
      blocks: [
        { t: 'lead', h: 'Le seul jeu que je demande. <strong>Sur PC</strong> — c’est là que je joue. Mais il y a une vraie complication de calendrier, et autant la connaître.' },
        { t: 'note', tone: 'warn', h: 'Le 19&nbsp;novembre 2026, il ne sort que sur <b>PS5 et Xbox Series</b>. Rockstar n’a annoncé <b>ni version PC, ni date PC, ni configuration requise</b>.' },
        { t: 'p', h: 'La version PC arrivera sûrement — Rockstar l’a toujours fait — mais plus tard. Une fuite parle de février 2027&nbsp;; <em>rien d’officiel, à ne pas prendre pour argent comptant</em>. Donc à Noël 2026, le jeu PC n’existera pas encore.' },
        { t: 'note', tone: 'good', h: '<b>La solution&nbsp;:</b> une carte cadeau Steam ou Rockstar mise de côté, que j’utiliserai le jour de la sortie PC.' },
        { t: 'note', tone: 'warn', h: '<b>N’achetez surtout pas une «&nbsp;clé PC GTA&nbsp;6&nbsp;» en ligne.</b> Il n’en existe aucune d’officielle aujourd’hui — tout ce qui se vend sous ce nom est une arnaque.' },
      ],
      next: 'Suivre le cerf',
    },
  },

  /* ---------------------------------------------------------------- 6 */
  {
    id: 'ecran',
    kind: 'gift',
    chapter: 'L’écran',
    scene: { gift: { size: 1.28, box: 0x1B3A55, ribbon: HUE.glace, glow: HUE.glace },
             buried: true, light: 'nuit' },
    prompt: 'Touchez le cadeau',
    card: {
      kicker: 'Le gros morceau',
      title: 'Un écran',
      price: { amount: '150 €', note: 'en occasion' },
      blocks: [
        { t: 'lead', h: 'Le gros morceau&nbsp;: de la <strong>4K en 120&nbsp;Hz minimum</strong>, branchée sur le PC. Et j’ai trouvé comment y arriver pour 150 €.' },
        { t: 'p', h: '<strong>La solution&nbsp;: l’occasion ou le reconditionné.</strong> En neuf, la 4K haute fréquence commence vers 280 €. Mais d’occasion, on trouve des écrans 4K 144&nbsp;Hz autour de 150 à 175 €.' },
        { t: 'p', h: '<strong>Où chercher&nbsp;:</strong> leboncoin pour l’occasion entre particuliers, ou Back Market et Rakuten pour du reconditionné — <em>avec 12&nbsp;mois de garantie</em>, ce qui rassure davantage.' },
        { t: 'p', h: '<strong>Les modèles à guetter&nbsp;:</strong> ASUS ROG Strix XG27UQR (27&nbsp;″, 4K 144&nbsp;Hz), Gigabyte M28U (28&nbsp;″, 4K 144&nbsp;Hz) ou Samsung Odyssey G7 S28AG700 (28&nbsp;″, 4K 144&nbsp;Hz). Tous ont le DisplayPort qu’il faut pour le PC.' },
        { t: 'p', h: '<strong>Si vous préférez du neuf&nbsp;:</strong> l’AOC U27G4R (4K 160&nbsp;Hz) tourne autour de 280 € — une belle cible pour le Black Friday si plusieurs personnes se regroupent.' },
        { t: 'note', h: '<b>Avant d’acheter d’occasion&nbsp;:</b> demander une photo de l’écran allumé <b>sur fond blanc</b> et <b>sur fond noir</b> — c’est ce qui révèle les pixels morts et les fuites de lumière.' },
        { t: 'note', tone: 'good', h: '<b>La plus grosse économie possible du Black Friday.</b>' },
        { t: 'links', items: [
          { href: 'https://www.leboncoin.fr/recherche?text=ecran%204K%20144Hz', label: 'Écrans d’occasion', sub: 'leboncoin' },
          { href: 'https://www.backmarket.fr/fr-fr/search?q=ecran%204k%20144hz', label: 'Reconditionné', sub: 'Back Market, garanti 12&nbsp;mois' },
          { href: 'https://www.amazon.fr/s?k=AOC+U27G4R', label: 'AOC U27G4R neuf', sub: '4K 160&nbsp;Hz, ≈ 280 €' },
        ]},
      ],
      next: 'Suivre le cerf',
    },
  },

  /* ---------------------------------------------------------------- 7 */
  {
    id: 'bf-date',
    kind: 'clearing',
    chapter: 'La clairière des dates',
    /* Une clairiere : le ciel s'ouvre, des lanternes plantees dans la neige
       marquent les dates. Pas de cadeau a deterrer ici. */
    scene: { gift: null, lanterns: true, light: 'clairiere' },
    prompt: 'Lire les dates',
    card: {
      kicker: 'La date à retenir',
      title: 'Black Friday',
      blocks: [
        { t: 'lead', h: '<strong>Vendredi 27&nbsp;novembre 2026.</strong> Une seule journée, et elle tombe juste avant <strong>mes 16 ans</strong>, un mois avant Noël. Une seule date à retenir pour les deux.' },
        { t: 'countdown', to: 'bf' },
        { t: 'milestones', items: [
          { d: '19 nov.', s: 'Sortie de GTA&nbsp;6 (consoles)' },
          { d: '27 nov.', s: 'Black Friday', hot: true },
          { d: '30 nov.', s: 'Cyber Monday' },
          { d: 'fin nov.', s: '<b>Mes 16 ans</b>', hot: true },
          { d: '25 déc.', s: 'Noël' },
        ]},
        { t: 'note', tone: 'good', h: '<b>L’essentiel&nbsp;:</b> acheter le 27&nbsp;novembre, offrir un mois plus tard — c’est le conseil le plus utile de toute la balade.' },
      ],
      next: 'Continuer',
    },
  },

  /* ---------------------------------------------------------------- 8 */
  {
    id: 'bf-viser',
    kind: 'clearing',
    chapter: 'Quoi viser',
    scene: { gift: null, lanterns: true, light: 'clairiere' },
    prompt: 'Lire la suite',
    card: {
      kicker: 'Ce qu’il faut viser, ce qu’il faut éviter',
      title: 'Le bon plan',
      blocks: [
        { t: 'note', tone: 'good', h: '<b>✓ L’écran — deux stratégies.</b> Soit une bonne occasion 4K 144&nbsp;Hz vers 150 € (disponible toute l’année, pas besoin d’attendre), soit du neuf en promotion&nbsp;: l’AOC U27G4R à 280 € pourrait descendre autour de 230–250 € fin novembre.' },
        { t: 'note', tone: 'good', h: '<b>✓ La manette — très souvent remisée.</b> Les manettes font partie des grands classiques des promotions de fin novembre.' },
        { t: 'note', tone: 'warn', h: '<b>✗ GTA&nbsp;6 — aucune remise à espérer.</b> Le jeu sort le 19&nbsp;novembre, soit huit jours avant le Black Friday. Un jeu majeur sorti la semaine précédente n’est jamais soldé. Et de toute façon la version PC n’existera pas encore.' },
        { t: 'p', h: '<strong>Relever les prix maintenant.</strong> Sans prix de référence noté avant novembre, impossible de savoir si une «&nbsp;remise&nbsp;» en est vraiment une. Un outil de suivi comme Keepa montre la courbe des mois précédents sur Amazon.' },
        { t: 'p', h: '<strong>Et si quelque chose est raté&nbsp;?</strong> Il reste le Cyber Monday du 30&nbsp;novembre, puis les soldes d’hiver de janvier — pratique pour ce qui n’aurait pas été pris à Noël.' },
        { t: 'sources', h: '<b>D’où viennent ces informations.</b> GTA&nbsp;6&nbsp;: sortie le 19&nbsp;novembre 2026 sur PS5 et Xbox Series X|S uniquement, 79,99 € en édition Standard — dates et prix annoncés par Rockstar à l’ouverture des précommandes le 25&nbsp;juin 2026. Aucune version PC, aucune date PC et aucune configuration requise n’ont été annoncées à ce jour&nbsp;; l’hypothèse de février 2027 provient d’une fuite non confirmée et ne doit pas être considérée comme fiable. Le Black Friday tombe le lendemain de Thanksgiving, soit le quatrième jeudi de novembre. Prix d’entrée des écrans 4K à haute fréquence (environ 300 €)&nbsp;: guides d’achat de la presse spécialisée française, 2026. Les modèles et prix cités (ShineBurky, GameSir Nova&nbsp;2 Lite, 8BitDo Ultimate&nbsp;2C, plantes, poster) ont été relevés début août 2026 et vont bouger d’ici novembre — à revérifier au moment de l’achat. Plusieurs des comparatifs consultés sont des sites affiliés, rémunérés sur les ventes. Aucun pourcentage de remise n’est annoncé ici&nbsp;: il ne pourra être constaté qu’au moment venu.' },
      ],
      next: 'Suivre le cerf',
    },
  },

  /* ---------------------------------------------------------------- 9 */
  {
    id: 'final',
    kind: 'final',
    chapter: 'La clairière',
    /* Les cinq cadeaux reunis sous un grand sapin, la maison eclairee au loin. */
    scene: { gift: null, tree: true, light: 'maison' },
    prompt: 'Ouvrir la liste',
    card: {
      kicker: 'Merci d’avoir suivi jusqu’au bout',
      title: 'Joyeux Noël',
      blocks: [
        { t: 'lead', h: 'Une seule idée suffit largement. <strong>Cochez ce que vous prenez</strong> pour éviter les doublons — la coche reste sur votre appareil.' },
        { t: 'checklist' },
        { t: 'note', h: '<b>Dates à retenir&nbsp;:</b> 19&nbsp;nov. — sortie de GTA&nbsp;6 (consoles) · <b>27&nbsp;nov. — Black Friday</b> · 30&nbsp;nov. — Cyber Monday · fin nov. — mon anniversaire · 25&nbsp;déc. — Noël.' },
        { t: 'note', tone: 'good', h: 'Le Black Friday est le bon moment pour <b>l’écran</b> et <b>la manette</b>. Pas pour GTA&nbsp;6, sorti huit jours avant.' },
        { t: 'p', h: 'Prix relevés début août 2026, à revérifier avant d’acheter. Pour un achat d’occasion, demander une photo de l’écran allumé sur fond blanc <em>et</em> sur fond noir&nbsp;: c’est ce qui révèle les pixels morts.' },
        { t: 'p', h: 'À très vite&nbsp;✦' },
      ],
      next: 'Refermer la forêt',
    },
  },
];

/* Le recapitulatif a cocher de la derniere halte. */
export const CHECKLIST = [
  { id: 'led', t: 'Bandeau LED pour le bureau', p: '≈ 10 €',
    d: 'Ruban COB USB 2&nbsp;m, blanc chaud, avec gradateur. amazon.fr → «&nbsp;ruban LED COB USB 2m blanc chaud&nbsp;»' },
  { id: 'deco', t: 'Déco : poster + plantes', p: '≈ 20 €',
    d: 'Poster <i>Spider-Man : Brand New Day</i> en A2 (15–25&nbsp;€) · pothos ≈ 4 €, sansevieria 8–30 €. allposters.com · europosters.fr' },
  { id: 'manette', t: 'Manette PC', p: '≈ 40 €',
    d: 'GameSir Nova&nbsp;2 Lite (&lt; 40 €) ou 8BitDo Ultimate&nbsp;2C (≈ 30 €, sticks à effet Hall).' },
  { id: 'gta', t: 'GTA 6', p: '80 €',
    d: '<b>Attention :</b> sortie le 19&nbsp;novembre 2026 sur PS5 et Xbox Series seulement. Aucune version PC annoncée — prévoir une carte cadeau Steam ou Rockstar.' },
  { id: 'ecran', t: 'Écran 4K 120 Hz', p: '150 €',
    d: 'Occasion vers 150–175 € (leboncoin, Back Market — 12&nbsp;mois de garantie). ASUS ROG Strix XG27UQR, Gigabyte M28U, Samsung Odyssey G7 S28AG700. Neuf : AOC U27G4R ≈ 280 €.' },
];

/* Signature affichee sur le seuil et dans le repli sans WebGL. */
export const META = {
  de: 'Antoine',
  pour: 'Pour vous tous',
  occasion: 'Mes 16 ans — fin novembre  ·  Noël — 25 décembre',
  intro:
    'Un mois d’écart entre les deux, alors je mets tout ensemble. ' +
    'Rien n’est attribué à l’une ou à l’autre occasion : ' +
    'piochez ce qui vous plaît, quand ça vous arrange.',
};
