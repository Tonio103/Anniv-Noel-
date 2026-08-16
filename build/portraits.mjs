/* LE PORTRAIT DE CHAQUE APPARITION.

   Le banc `apparitions.mjs` repond a une question binaire — est-ce allume,
   est-ce dans le champ — et c'est tout ce qu'on lui demande. Mais il cadre
   la scene comme le drone la cadre : de loin, de biais, souvent derriere un
   tronc. On ne peut pas JUGER une apparition sur cette image-la, seulement
   constater qu'elle existe.

   Ce banc-ci fait l'inverse : il pose la camera devant chaque scene, a la
   distance qu'on choisit, et photographie. C'est un outil de regard, pas de
   controle : il sert a voir si le costume tient, si la flaque de gyrophare
   se pose vraiment sur la neige, si le fil de toile part bien de la main.

   Le monde reste celui de la balade — meme nuit, meme brouillard, meme
   post-traitement — sans quoi on jugerait d'un rendu qui n'existe pas. */
import { chromium } from 'playwright-core';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await build();

/* Distance, hauteur et instant de la fenetre, choisis scene par scene : une
   voiture de police se juge de loin et d'en haut, un costume de pres. */
const CADRES = {
  police:   { d: 15, h: 6.0, u: 0.55, laterale: 7 },
  spider1:  { d: 5.0, h: 2.6, u: 0.55, laterale: 1.6 },
  et:       { d: 40, h: 8, u: 0.50, laterale: 0 },
  sabres:   { d: 9, h: 2.4, u: 0.50, laterale: 3 },
  trio:     { d: 6.5, h: 2.2, u: 0.50, laterale: 2.5 },
  patronus: { d: 12, h: 3.2, u: 0.45, laterale: 5 },
  spider2:  { d: 11, h: 5.5, u: 0.66, laterale: 4 },
  delorean: { d: 17, h: 4.5, u: 0.30, laterale: 6 },
};

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--disable-dev-shm-usage'] });
const page = await nav.newPage({ viewport: { width: 760, height: 560 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('  [ERREUR PAGE]', e.message));
await page.goto('file://' + join(root, 'dist/experience.html') + '?debug=1&q=moyen',
                { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction('window.__scene !== undefined', { timeout: 180000 });
await page.click('#enterBtn');
await page.waitForTimeout(400);

const noms = await page.evaluate(() => window.__scene.apparitions.scenes.map((x) => x.nom));

for (const nom of noms) {
  const cadre = CADRES[nom] || { d: 12, h: 3, u: 0.5, laterale: 4 };
  const info = await page.evaluate(({ nom, cadre }) => {
    const s = window.__scene, THREE = window.__THREE;
    // La cinematique d'ouverture epingle la camera : on la laisse finir.
    let secours = 0;
    while (s.drone.enCinematique && secours++ < 900) s.simuler(1 / 60);
    s.boucle.pause();
    s.drone.liberer();

    const sc = s.apparitions.scenes.find((x) => x.nom === nom);
    /* On amene le cerf a l'abscisse voulue pour que le terrain et la foret
       soient charges autour, puis on cadre a la main. */
    const sVue = sc.s - sc.avant + (sc.avant + sc.apres) * cadre.u;
    s.cerf.s = sVue;
    s.cerf.placer(sVue);
    for (let i = 0; i < 3; i++) { s.relief.maj(s.camera, s.ciel.actuel); s.foret.maj(s.camera); }
    for (let i = 0; i < 40; i++) s.apparitions.maj(1 / 60, 8 + i / 60, sVue, s.camera);

    const o = sc.objet;
    const b = new THREE.Box3().setFromObject(o);
    const c = b.getCenter(new THREE.Vector3());
    /* Pour les scenes du ciel, le centre est deja devant la camera : on ne
       la deplace pas, on se contente de regarder. */
    if (!o.userData.suitCamera) {
      const versChemin = new THREE.Vector3();
      s.chemin.point(sVue, versChemin);
      const dir = new THREE.Vector3().subVectors(versChemin, c).setY(0);
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
      dir.normalize();
      const cote = new THREE.Vector3(-dir.z, 0, dir.x);
      s.camera.position.copy(c)
        .addScaledVector(dir, cadre.d)
        .addScaledVector(cote, cadre.laterale);
      s.camera.position.y = s.relief.hauteur(s.camera.position.x, s.camera.position.z) + cadre.h;
    }
    s.camera.lookAt(c);
    s.camera.updateMatrixWorld();
    for (let i = 0; i < 3; i++) { s.relief.maj(s.camera, s.ciel.actuel); s.foret.maj(s.camera); }
    s.apparitions.maj(1 / 60, 9, sVue, s.camera);
    s.postfx.rendre(s.scene, s.camera, s.boucle.t);
    return {
      taille: [+(b.max.x - b.min.x).toFixed(2), +(b.max.y - b.min.y).toFixed(2), +(b.max.z - b.min.z).toFixed(2)],
      solSousLaScene: +s.relief.hauteur(c.x, c.z).toFixed(2),
      basDeLaScene: +b.min.y.toFixed(2),
    };
  }, { nom, cadre });
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(root, `shots/portrait-${nom}.png`) });
  console.log(`  ${nom.padEnd(9)} taille=${info.taille.join('x')}  bas=${info.basDeLaScene}  sol=${info.solSousLaScene}`);
}
await nav.close();
