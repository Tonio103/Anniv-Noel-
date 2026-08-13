/* Ce que je n'avais jamais verifie.

   Trois fonctions de la balade existent depuis le debut, sont ecrites, sont
   branchees — et n'ont jamais ete vues fonctionner une seule fois : le compte
   a rebours, la persistance de la liste a cocher, et le repli quand le WebGL
   manque. Ce sont pourtant les trois seules choses qui restent si tout le
   reste tombe.

   S'y ajoute le controle de nettete, qui n'existait pas non plus : c'est
   precisement pour cela que l'absence totale d'antialiasing a pu survivre a
   toute la construction. On mesure donc aussi le multi-echantillonnage et la
   densite de pixels effective. */
import { chromium } from 'playwright-core';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await build();
const url = 'file://' + join(root, 'dist/experience.html');
const nav = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const ok = [], ko = [];
const dire = (bon, quoi) => (bon ? ok : ko).push(quoi);

/* ============================ 1. NETTETE ================================= */
{
  const page = await nav.newPage({ viewport: { width: 900, height: 600 } });
  page.on('pageerror', (e) => ko.push('erreur page : ' + e.message));
  await page.goto(url + '?debug=1&q=moyen', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__scene!==undefined', { timeout: 240000 });
  const n = await page.evaluate(() => ({
    samples: window.__scene.postfx.rtScene?.samples ?? 0,
    actif: window.__scene.postfx.actif,
    dpr: window.__scene.renderer.getPixelRatio(),
    dprEcran: window.devicePixelRatio,
  }));
  console.log('nettete :', JSON.stringify(n));
  dire(!n.actif || n.samples >= 2, `multi-echantillonnage actif (samples=${n.samples})`);
  dire(n.dpr >= Math.min(1.5, n.dprEcran), `densite de rendu suffisante (${n.dpr})`);
  await page.close();
}

/* ====================== 2. COMPTES A REBOURS ============================== */
{
  const page = await nav.newPage({ viewport: { width: 900, height: 600 } });
  page.on('pageerror', (e) => ko.push('erreur page : ' + e.message));
  await page.goto(url + '?debug=1&q=bas', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__scene!==undefined', { timeout: 240000 });
  await page.click('#enterBtn');

  /* La halte du Black Friday porte le compte a rebours. On s'y rend, on
     ouvre la carte, et on regarde si les chiffres se remplissent VRAIMENT —
     un compteur qui reste sur des tirets est un compteur mort. */
  /* On DESIGNE LA HALTE PAR SON CONTENU, jamais par son numero. Ce test
     cherchait la halte 7 ; le jour ou une halte a ete retiree de la liste,
     tout s'est decale d'un cran et le compte a rebours a disparu du test sans
     que rien ne soit casse dans la page. Un numero d'index n'est pas une
     identite. */
  await page.evaluate(() => {
    const s2 = window.__scene;
    const i = s2.stations.findIndex(
      (st) => st.card?.blocks?.some((b2) => b2.t === 'countdown'));
    s2.aller(i, 'attente');
  });
  await page.evaluate(() => document.getElementById('gl').dispatchEvent(new PointerEvent('pointerdown')));
  await page.evaluate(() => window.__scene.simuler(3));
  await page.waitForTimeout(1600);

  const cd = await page.evaluate(() => {
    const el = document.querySelector('.c-count');
    if (!el) return { present: false };
    const lire = (u) => el.querySelector(`[data-u="${u}"]`)?.textContent?.trim() ?? null;
    return { present: true, cible: el.dataset.cd, j: lire('j'), h: lire('h'), m: lire('m'), s: lire('s') };
  });
  console.log('compte a rebours :', JSON.stringify(cd));
  dire(cd.present, 'le compte a rebours est bien dans la carte');
  const vivant = cd.present && [cd.j, cd.h, cd.m, cd.s].every((v) => v && v !== '—' && /^\d+$/.test(v));
  dire(vivant, 'le compte a rebours affiche de vrais chiffres');

  /* Il doit aussi AVANCER : un rendu unique au moment de l'ouverture, fige
     ensuite, serait invisible a l'oeil mais faux. */
  const s1 = cd.s;
  await page.waitForTimeout(2200);
  const s2 = await page.evaluate(() => document.querySelector('.c-count [data-u="s"]')?.textContent?.trim());
  dire(vivant && s1 !== s2, `il s'ecoule (${s1} -> ${s2})`);
  await page.close();
}

/* ================== 3. LISTE A COCHER, ET SA PERSISTANCE ================== */
{
  const page = await nav.newPage({ viewport: { width: 900, height: 600 } });
  page.on('pageerror', (e) => ko.push('erreur page : ' + e.message));
  await page.goto(url + '?debug=1&q=bas', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__scene!==undefined', { timeout: 240000 });
  await page.click('#enterBtn');
  await page.evaluate(() => {
    const s2 = window.__scene;
    const i = s2.stations.findIndex(
      (st) => st.card?.blocks?.some((b2) => b2.t === 'checklist'));
    s2.aller(i, 'attente');
  });
  await page.evaluate(() => document.getElementById('gl').dispatchEvent(new PointerEvent('pointerdown')));
  await page.evaluate(() => window.__scene.simuler(3));
  await page.waitForTimeout(1400);

  const cases = await page.evaluate(() => document.querySelectorAll('.c-ck').length);
  dire(cases > 0, `la liste a cocher s'affiche (${cases} entrees)`);

  if (cases > 0) {
    await page.evaluate(() => {
      document.querySelector('.c-ck input').click();
    });
    await page.waitForTimeout(300);
    const stock = await page.evaluate(() => localStorage.getItem('foret-du-cerf-pris'));
    dire(!!stock && stock !== '{}', 'cocher ecrit bien dans le stockage local');

    /* Le vrai test : on recharge la page et on regarde si la coche revient.
       C'est tout l'interet de la fonction — eviter les doublons entre
       plusieurs personnes de la famille sur plusieurs visites. */
    await page.reload({ waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction('window.__scene!==undefined', { timeout: 240000 });
    await page.click('#enterBtn');
    await page.evaluate(() => {
    const s2 = window.__scene;
    const i = s2.stations.findIndex(
      (st) => st.card?.blocks?.some((b2) => b2.t === 'checklist'));
    s2.aller(i, 'attente');
  });
    await page.evaluate(() => document.getElementById('gl').dispatchEvent(new PointerEvent('pointerdown')));
    await page.evaluate(() => window.__scene.simuler(3));
    await page.waitForTimeout(1400);
    const revenue = await page.evaluate(() => document.querySelector('.c-ck input')?.checked === true);
    dire(revenue, 'la coche revient apres rechargement');
  }
  await page.close();
}

/* ========================= 4. REPLI SANS WEBGL ============================ */
{
  const page = await nav.newPage({ viewport: { width: 900, height: 600 } });
  page.on('pageerror', (e) => ko.push('erreur page (repli) : ' + e.message));
  /* On coupe WebGL avant tout script de la page : c'est la situation d'un
     vieil appareil, ou d'un navigateur ou l'acceleration est desactivee. */
  await page.addInitScript(() => {
    const vrai = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...r) {
      if (String(type).indexOf('webgl') === 0) return null;
      return vrai.call(this, type, ...r);
    };
  });
  await page.goto(url + '?debug=1', { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(2500);
  const repli = await page.evaluate(() => {
    const el = document.getElementById('fallback');
    const t = (el?.textContent || '').replace(/\s+/g, ' ').trim();
    return { visible: el && !el.hidden, longueur: t.length, debut: t.slice(0, 70),
             prix: /€/.test(t), liens: document.querySelectorAll('#fallback a').length };
  });
  console.log('repli :', JSON.stringify(repli));
  dire(repli.visible, 'le repli s\'affiche quand le WebGL manque');
  dire(repli.longueur > 400, `le repli contient le contenu (${repli.longueur} caracteres)`);
  dire(repli.prix, 'le repli contient bien les prix');
  await page.screenshot({ path: join(root, 'shots/repli.png') });
  await page.close();
}

console.log('\n  OK  : ' + ok.join('\n        · '));
if (ko.length) console.log('\n  KO  : ' + ko.join('\n        · '));
console.log('\nechecs :', ko.length);
await nav.close();
process.exit(ko.length ? 1 : 0);
