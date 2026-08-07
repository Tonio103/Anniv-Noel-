/* Repli sans WebGL.

   La page sera ouverte par des gens dont on ne connait ni le telephone ni le
   navigateur. Si la 3D ne demarre pas, il est hors de question qu'ils
   tombent sur un ecran noir : on leur sert le contenu, en clair et en entier.
   C'est moins beau, mais c'est le contenu qui compte. */

import { STATIONS, CHECKLIST, META } from '../content/stations.js';

export function afficherRepli(erreur) {
  const el = document.getElementById('fallback');
  if (!el || !el.hidden === false) { /* deja affiche */ }

  const sections = STATIONS
    .filter((st) => st.card)
    .map((st) => {
      const c = st.card;
      const corps = c.blocks.map((b) => {
        switch (b.t) {
          case 'lead': return `<p style="font-size:15.5px;line-height:1.6;margin-bottom:12px">${b.h}</p>`;
          case 'p': return `<p style="font-size:14px;line-height:1.6;color:#B9C9D6;margin-bottom:11px">${b.h}</p>`;
          case 'note': return `<p class="c-note ${b.tone || ''}">${b.h}</p>`;
          case 'sources': return `<p class="c-sub">${b.h}</p>`;
          case 'links':
            return `<ul style="list-style:none;margin:12px 0">${b.items.map((i) =>
              `<li style="margin-bottom:7px"><a href="${i.href}" target="_blank" rel="noopener noreferrer"
                 style="color:#F2C14E">${i.label}</a>
                 <span style="color:rgba(233,242,248,.5);font-size:12px"> — ${i.sub}</span></li>`).join('')}</ul>`;
          case 'milestones':
            return `<ul style="list-style:none;margin:12px 0">${b.items.map((i) =>
              `<li style="margin-bottom:5px;font-size:13.5px"><b style="color:#FFE9A8">${i.d}</b>
                 <span style="color:#B9C9D6"> — ${i.s}</span></li>`).join('')}</ul>`;
          case 'checklist':
            return `<ul style="list-style:none;margin:12px 0">${CHECKLIST.map((i) =>
              `<li style="margin-bottom:10px;font-size:13.5px">
                 <b>${i.t}</b> <span style="color:#FFE9A8">${i.p}</span><br>
                 <span style="color:rgba(233,242,248,.55);font-size:12.5px">${i.d}</span></li>`).join('')}</ul>`;
          default: return '';
        }
      }).join('');

      const prix = c.price
        ? `<span style="color:#FFE9A8;font-family:Fraunces,serif;font-size:19px"> · ${c.price.amount}</span>` : '';

      return `<section class="fb-sec">
        <p style="font-family:Caveat,cursive;color:#F2C14E;font-size:16px">${c.kicker || ''}</p>
        <h2 style="font-family:Fraunces,serif;font-size:24px;margin:2px 0 12px">${c.title}${prix}</h2>
        ${corps}
      </section>`;
    }).join('');

  el.innerHTML = `<div class="fb-in">
    <h1>La liste d’${META.de}</h1>
    <p>${META.pour} — ${META.occasion}.<br>${META.intro}</p>
    <p style="color:rgba(233,242,248,.5);font-size:12.5px;margin-bottom:24px">
      La balade en 3D n’a pas pu démarrer sur cet appareil, voici la liste telle quelle.
    </p>
    ${sections}
  </div>`;

  el.hidden = false;
  document.getElementById('boot')?.setAttribute('hidden', '');
  document.getElementById('entry')?.setAttribute('hidden', '');
  if (erreur) console.error(erreur);
}
