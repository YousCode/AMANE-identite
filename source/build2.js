const fs = require('fs');
const S = (n, cls = 'lg') => fs.readFileSync('../logos/svg/' + n, 'utf8').replace(/<svg /, `<svg class="${cls}" `);
const PAT = n => 'data:image/svg+xml;base64,' + Buffer.from(fs.readFileSync('../logos/svg/' + n)).toString('base64');
const patB = PAT('amane-motif-arcades-bordeaux.svg'), patP = PAT('amane-motif-arcades-pierre.svg');
const Asvg = fs.readFileSync('../logos/svg/amane-A-bordeaux.svg', 'utf8');
// planche de construction : A + repères
const anat = Asvg.replace('<svg ', '<svg class="lg" ').replace('</svg>', `
 <g fill="none" stroke="#B8955C" stroke-width="3" stroke-dasharray="10 10">
  <line x1="40" y1="0" x2="980" y2="0"/><line x1="40" y1="1000" x2="980" y2="1000"/><line x1="40" y1="640" x2="980" y2="640"/>
  <circle cx="457" cy="636" r="58"/><line x1="452" y1="-60" x2="452" y2="1060"/></g></svg>`);

const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Amane — Identité de marque</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;1,6..96,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<style>
:root{--bx:#5B1622;--lie:#3B0C15;--bxc:#7A2232;--pierre:#EFE7DA;--creme:#F6F1E8;--noir:#15110F;--or:#B8955C;--zinc:#7E858C}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--creme);color:var(--noir);font-family:Jost,sans-serif;font-weight:300;font-size:16px;line-height:1.65;-webkit-font-smoothing:antialiased}
.lg{display:block;width:100%;height:auto}
section{padding:120px 8vw;position:relative}
.wrap{max-width:1180px;margin:0 auto}
.k{font-weight:400;font-size:11px;letter-spacing:.42em;text-transform:uppercase;color:var(--zinc);margin-bottom:28px;display:flex;gap:18px;align-items:center}
.k:before{content:"";width:36px;height:1px;background:currentColor;opacity:.6}
h2{font-family:'Bodoni Moda',serif;font-weight:400;font-size:clamp(34px,4.6vw,62px);line-height:1.08;margin-bottom:34px;max-width:17ch}
h3{font-family:'Bodoni Moda',serif;font-weight:500;font-size:22px;margin-bottom:10px}
p{max-width:62ch}p+p{margin-top:14px}
em{font-family:'Bodoni Moda',serif;font-style:italic;font-weight:400}
.bx{background:var(--bx);color:var(--pierre)}.lie{background:var(--lie);color:var(--pierre)}.dark{background:var(--noir);color:var(--pierre)}.pierre{background:var(--pierre)}
.bx .k,.lie .k,.dark .k{color:var(--or)}
.grid{display:grid;gap:28px}.g2{grid-template-columns:repeat(2,1fr)}.g3{grid-template-columns:repeat(3,1fr)}.g4{grid-template-columns:repeat(4,1fr)}
@media(max-width:820px){.g2,.g3,.g4{grid-template-columns:1fr}section{padding:80px 6vw}}
.tile{display:flex;align-items:center;justify-content:center;padding:44px;aspect-ratio:4/3}
.cap{font-size:11px;letter-spacing:.28em;text-transform:uppercase;margin-top:14px;color:var(--zinc);line-height:1.7}
.bx .cap,.lie .cap{color:rgba(239,231,218,.55)}
.cover{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bx) url(${patB}) center/520px;}
.cover .plate{background:var(--bx);padding:70px 80px 60px;box-shadow:0 0 0 1px rgba(184,149,92,.35),0 0 0 14px var(--bx),0 0 0 15px rgba(184,149,92,.25)}
.cover .plate .lg{width:min(440px,66vw)}
.cover .meta{position:absolute;bottom:34px;left:0;right:0;text-align:center;font-size:11px;letter-spacing:.42em;text-transform:uppercase;color:var(--or)}
.chg{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-top:1px solid rgba(21,17,15,.14)}
@media(max-width:820px){.chg{grid-template-columns:1fr 1fr}}
.chg div{padding:26px 22px 26px 0;border-right:1px solid rgba(21,17,15,.1)}.chg div:last-child{border:0}
.chg b{display:block;font-family:'Bodoni Moda';font-weight:400;font-size:42px;color:var(--bx);line-height:1;margin-bottom:12px}
.anat{display:grid;grid-template-columns:1fr 1.1fr;gap:80px;align-items:center}
@media(max-width:820px){.anat{grid-template-columns:1fr}}
.note{display:grid;grid-template-columns:30px 1fr;gap:14px;padding:16px 0;border-top:1px solid rgba(239,231,218,.16)}
.note i{font-style:normal;font-family:'Bodoni Moda';color:var(--or);font-size:20px;line-height:1.1}
.sw{padding:22px;display:flex;flex-direction:column;justify-content:flex-end;font-size:12px;letter-spacing:.06em;min-height:220px}
.sw h4{font-family:'Bodoni Moda';font-weight:400;font-size:24px;letter-spacing:0;margin-bottom:6px}
.big{grid-column:span 2;grid-row:span 2;min-height:460px}
.ratio{display:flex;height:22px;margin-top:30px}.ratio div{height:100%}
.spec{border-top:1px solid rgba(21,17,15,.14);padding:34px 0;display:grid;grid-template-columns:220px 1fr;gap:40px;align-items:baseline}
@media(max-width:820px){.spec{grid-template-columns:1fr;gap:10px}}
.spec .lab{font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--zinc)}
.dB{font-family:'Bodoni Moda';font-size:clamp(28px,3.4vw,42px);line-height:1.15}
.dC{font-weight:400;font-size:13px;letter-spacing:.42em;text-transform:uppercase}
.mock{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;aspect-ratio:4/3;background:linear-gradient(160deg,#ddd3c2,#cbc0ac)}
.card{width:50%;aspect-ratio:85/55;box-shadow:0 18px 40px -18px rgba(0,0,0,.5),0 2px 4px rgba(0,0,0,.12);display:flex;align-items:center;justify-content:center;position:absolute;flex-direction:column}
.card.a{background:var(--bx) url(${patB}) center/180px;transform:translate(-12%,-9%) rotate(-6deg)}
.card.a .m{background:var(--bx);padding:7% 6%;width:30%}
.card.b{background:#f5efe4;transform:translate(14%,12%) rotate(4deg);color:var(--bx);text-align:center}
.card.b .w{width:60%}.card.b small{font-size:6.5px;letter-spacing:.3em;text-transform:uppercase;margin-top:8px}
.wax{position:relative;z-index:1;width:42%;aspect-ratio:1;border-radius:47% 53% 50% 50%/52% 48% 52% 48%;background:radial-gradient(circle at 38% 32%,#8b2a3b,#5B1622 45%,#3B0C15 80%);box-shadow:0 16px 30px -10px rgba(0,0,0,.55),inset 0 -6px 14px rgba(0,0,0,.35),inset 0 5px 10px rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center}
.wax .lg{width:80%;filter:drop-shadow(0 -1px 0 rgba(0,0,0,.5)) drop-shadow(0 1px 0 rgba(255,255,255,.18))}
.env{position:absolute;inset:14% 10%;background:#f4eee2;box-shadow:0 18px 40px -20px rgba(0,0,0,.4)}
.env:before{content:"";position:absolute;left:0;right:0;top:0;height:52%;background:linear-gradient(to bottom right,transparent 49.6%,rgba(0,0,0,.08) 50%),linear-gradient(to bottom left,transparent 49.6%,rgba(0,0,0,.08) 50%);background-size:50% 100%;background-position:left,right;background-repeat:no-repeat}
.box{width:52%;aspect-ratio:1;background:var(--bx) url(${patB}) center/150px;box-shadow:0 30px 50px -20px rgba(0,0,0,.6),inset 0 0 0 1px rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;transform:perspective(900px) rotateX(18deg)}
.box .lg{width:52%}
.ribbon{position:absolute;left:0;right:0;top:0;bottom:0;margin:auto;width:52%;aspect-ratio:1;pointer-events:none}
.tag{width:22%;aspect-ratio:1/1.9;background:linear-gradient(145deg,#6a1c29,#4a0f19);border-radius:48% 48% 10px 10px/26% 26% 10px 10px;box-shadow:0 22px 40px -16px rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;position:relative}
.tag:before{content:"";position:absolute;top:9%;width:12%;aspect-ratio:1;border-radius:50%;background:#cbc0ac;box-shadow:inset 0 2px 3px rgba(0,0,0,.4)}
.tag:after{content:"";position:absolute;inset:6px;border-radius:inherit;border:1px dashed rgba(239,231,218,.3)}
.tag .lg{width:58%;margin-top:30%;filter:drop-shadow(0 -1px 0 rgba(0,0,0,.5)) drop-shadow(0 1px 0 rgba(255,255,255,.12))}
.ig{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;max-width:560px;margin:0 auto}
.ig>div{aspect-ratio:4/5;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:12%;text-align:center}
.ig .t{font-family:'Bodoni Moda';font-size:clamp(11px,1.4vw,17px);line-height:1.2}
.ig .t em{color:var(--or)}
.ig .s{font-size:6px;letter-spacing:.35em;text-transform:uppercase;margin-top:12px;color:var(--or)}
.rules li{list-style:none;padding:14px 0 14px 34px;border-top:1px solid rgba(239,231,218,.14);position:relative}
.rules li:before{position:absolute;left:0;top:13px;font-family:'Bodoni Moda'}
.rules.y li:before{content:"✓";color:#9fbf9a}.rules.n li:before{content:"✕";color:#e08a98}
.steps li{list-style:none;counter-increment:s;padding:20px 0 20px 64px;border-top:1px solid rgba(239,231,218,.16);position:relative}
.steps li:before{content:counter(s,decimal-leading-zero);position:absolute;left:0;top:16px;font-family:'Bodoni Moda';font-size:28px;color:var(--or)}
.steps b{font-weight:500}
footer{padding:50px 8vw;text-align:center;font-size:11px;letter-spacing:.42em;text-transform:uppercase;color:var(--or);background:var(--lie)}
</style></head><body>

<section class="cover"><div class="plate">${S('amane-logo-principal-pierre.svg')}</div>
 <div class="meta">Identité de marque · Édition 02 · Novembre 2026</div></section>

<section>
 <div class="wrap">
  <div class="k">00 — Ce qui change en édition 02</div>
  <h2>Le même A, poussé jusqu'au bout.</h2>
  <div class="chg">
   <div><b>A</b>Le A est redessiné de zéro : empattements à congés, plein et délié plus contrastés, serrure à base arrondie.</div>
   <div><b>II</b>Le logotype utilise ce A. Dans « AMANE », le premier A porte la serrure, le second une barre filiforme.</div>
   <div><b>◎</b>Deux nouveaux signes : un sceau pour la cire, la dorure et le packaging, et le motif « Arcades » pour les fonds et doublures.</div>
   <div><b>•</b>Le bordeaux devient la couleur maîtresse, avec trois tons, et l'or ne sert qu'à la dorure.</div>
  </div>
 </div>
</section>

<section class="lie">
 <div class="wrap anat">
  <div style="background:var(--pierre);padding:50px">${anat}</div>
  <div>
   <div class="k">01 — Le A</div>
   <h2>Une lettre, une porte, une clé.</h2>
   <p>Le A est la seule pièce dessinée à la main de toute l'identité. Tout le reste en découle.</p>
   <div style="margin-top:28px">
    <div class="note"><i>I</i><span><b>Plein et délié.</b> Le fût droit est près de quatre fois plus épais que le gauche : c'est le rapport des enseignes et des plaques émaillées du Paris haussmannien.</span></div>
    <div class="note"><i>II</i><span><b>Barre à 64 %.</b> La barre est placée plus haut que dans un A classique pour laisser la place à la serrure sous elle. La serrure est centrée dans le vide intérieur de la lettre, pas sur la lettre elle-même : c'est ce qui la rend stable à l'œil.</span></div>
    <div class="note"><i>III</i><span><b>Serrure.</b> Un anneau et un panneton évasé, comme une entrée de serrure de porte cochère. Le bas est arrondi pour se détacher des empattements, qui sont droits.</span></div>
    <div class="note"><i>IV</i><span><b>Empattements à congés.</b> Les pieds du A s'élargissent en courbe vers le sol, comme une base de colonne.</span></div>
   </div>
  </div>
 </div>
</section>

<section>
 <div class="wrap">
  <div class="k">02 — Système de signes</div>
  <h2>Six signes, du plus solennel au plus discret.</h2>
  <div class="grid g3">
   <div><div class="tile pierre">${S('amane-logo-principal-bordeaux.svg')}</div><div class="cap">Logo principal — couverture, signalétique, site</div></div>
   <div><div class="tile bx"><div style="width:100%">${S('amane-logo-horizontal-pierre.svg')}</div></div><div class="cap">Horizontal — en-têtes, e-mail, factures</div></div>
   <div><div class="tile lie"><div style="width:44%">${S('amane-sceau-or.svg')}</div></div><div class="cap">Sceau — cire, dorure, coffrets, certificats</div></div>
   <div><div class="tile" style="background:#fff"><div style="width:100%">${S('amane-logotype-bordeaux.svg')}</div></div><div class="cap">Logotype — quand le symbole est déjà présent</div></div>
   <div><div class="tile bx"><div style="width:26%">${S('amane-monogramme-or.svg')}</div></div><div class="cap">Monogramme — cuir, avatar, favicon ≥ 32 px</div></div>
   <div><div class="tile pierre"><div style="width:30%">${S('amane-A-bordeaux.svg')}</div></div><div class="cap">A seul — gaufrage, très petites tailles, filigrane</div></div>
  </div>
 </div>
</section>

<section class="pierre">
 <div class="wrap">
  <div class="k">03 — Couleurs</div>
  <h2>Le bordeaux en maître, la pierre en écrin.</h2>
  <div class="grid g4" style="gap:12px">
   <div class="sw big" style="background:var(--bx);color:var(--pierre)"><h4 style="font-size:40px">Velours Garnier</h4>#5B1622 · CMJN 20 95 70 65 · Pantone ≈ 7421 C<br>Couleur maîtresse : couverture, cartes, packaging, fonds</div>
   <div class="sw" style="background:var(--lie);color:var(--pierre)"><h4>Lie-de-vin</h4>#3B0C15<br>Ton sur ton, ombres, cuir</div>
   <div class="sw" style="background:var(--bxc);color:var(--pierre)"><h4>Bordeaux clair</h4>#7A2232<br>Motif, survols web</div>
   <div class="sw" style="background:var(--creme);color:var(--bx);outline:1px solid rgba(0,0,0,.08)"><h4>Pierre de Paris</h4>#EFE7DA · #F6F1E8<br>Papier, texte sur bordeaux</div>
   <div class="sw" style="background:var(--noir);color:var(--pierre)"><h4>Noir laqué</h4>#15110F<br>Nuit, réseaux, voitures</div>
  </div>
  <div class="grid g2" style="margin-top:12px;gap:12px">
   <div class="sw" style="min-height:130px;background:linear-gradient(120deg,#cfac72,#a8834a 50%,#dcbd86);color:var(--lie)"><h4>Or Garnier</h4>#B8955C — dorure à chaud et laiton uniquement</div>
   <div style="padding:6px 4px"><p><b style="font-weight:500">Dosage.</b> Une pièce Amane se reconnaît de loin à son bordeaux. La pierre sert d'écrin, le noir est réservé à la nuit et aux réseaux, l'or au métal.</p>
    <div class="ratio"><div style="flex:45;background:var(--bx)"></div><div style="flex:12;background:var(--lie)"></div><div style="flex:28;background:var(--creme);outline:1px solid rgba(0,0,0,.08)"></div><div style="flex:12;background:var(--noir)"></div><div style="flex:3;background:var(--or)"></div></div>
    <div class="cap">Bordeaux 57 % · Pierre 28 % · Noir 12 % · Or 3 %</div></div>
  </div>
 </div>
</section>

<section class="bx" style="background:var(--bx) url(${patB}) center/420px">
 <div class="wrap" style="background:var(--bx);padding:60px;max-width:760px;box-shadow:0 0 0 1px rgba(184,149,92,.3)">
  <div class="k">04 — Motif « Arcades »</div>
  <h2>Les arcades de la rue de Rivoli, en papier peint.</h2>
  <p>Une rangée d'arches décalées, avec une serrure toutes les trois portes. Il sert en ton sur ton bordeaux : intérieur de coffret, doublure de pochette, fond de carte, papier de soie, fond de site. Il ne contient ni lettre ni logo, donc on peut le recadrer librement.</p>
  <p style="opacity:.7">Toujours en ton sur ton. Jamais en or sur bordeaux : ça ferait papier cadeau.</p>
 </div>
</section>

<section>
 <div class="wrap">
  <div class="k">05 — Typographie</div>
  <h2>Un didone, un géométrique.</h2>
  <div class="spec"><div class="lab">Logotype<br>Dessiné, A sur-mesure</div><div style="max-width:520px">${S('amane-logotype-bordeaux.svg')}</div></div>
  <div class="spec"><div class="lab">Bodoni Moda 400 / italique<br>Titres</div><div class="dB">Une voiture vous attend <em>rue du Faubourg</em>, à vingt heures.</div></div>
  <div class="spec"><div class="lab">Jost 400, capitales +42 %<br>Labels</div><div class="dC">Conciergerie · Chauffeur · Personal shopping</div></div>
  <div class="spec"><div class="lab">Jost 300<br>Texte courant</div><p>Chaque demande est confiée à un seul interlocuteur, joignable à toute heure. Nous ne publions ni tarifs ni catalogue.</p></div>
 </div>
</section>

<section class="pierre">
 <div class="wrap">
  <div class="k">06 — Applications</div>
  <h2>Le bordeaux en situation.</h2>
  <div class="grid g2">
   <div><div class="mock"><div class="card a"><div class="m">${S('amane-monogramme-or.svg')}</div></div><div class="card b"><div class="w">${S('amane-logotype-bordeaux.svg')}</div><small>Sur rendez-vous — Paris VIII</small></div></div><div class="cap">Carte — recto motif Arcades + monogramme dorure or · verso coton 700 g, letterpress bordeaux</div></div>
   <div><div class="mock" style="background:linear-gradient(160deg,#cbc0ac,#b9ad97)"><div class="env"></div><div class="wax">${S('amane-sceau-bordeaux.svg').replace(/#5B1622/g, '#4a1019')}</div></div><div class="cap">Cachet de cire — sceau Ø 30 mm, cire bordeaux, sur chaque enveloppe remise au client</div></div>
   <div><div class="mock" style="background:linear-gradient(160deg,#e6ddcd,#d3c8b5)"><div class="box">${S('amane-sceau-or.svg')}</div></div><div class="cap">Coffret — papier bordeaux grainé, motif ton sur ton, sceau doré à chaud</div></div>
   <div><div class="mock" style="background:linear-gradient(160deg,#cbc0ac,#b9ad97)"><div class="tag">${S('amane-A-bordeaux.svg').replace(/#5B1622/g, '#3B0C15')}</div></div><div class="cap">Porte-clés cuir — A à serrure embossé à sec, remis avec chaque véhicule</div></div>
  </div>
  <div style="margin-top:70px">
   <div class="cap" style="text-align:center;margin-bottom:22px">Instagram — les 9 premières cases (photos = série Higgsfield)</div>
   <div class="ig">
    <div style="background:var(--bx)"><div style="width:62%">${S('amane-monogramme-pierre.svg')}</div></div>
    <div style="background:#2a2420;color:var(--pierre)"><div class="t">photo<br><em>porte cochère</em></div></div>
    <div style="background:var(--noir);color:var(--pierre)"><div class="t">Certaines portes ne s'ouvrent <em>qu'une fois.</em></div><div class="s">Amane · Paris</div></div>
    <div style="background:#3a302a;color:var(--pierre)"><div class="t">photo<br><em>remise de clé</em></div></div>
    <div style="background:var(--bx) url(${patB}) center/90px"><div style="width:70%;background:var(--bx);padding:10%">${S('amane-sceau-or.svg')}</div></div>
    <div style="background:#2a2420;color:var(--pierre)"><div class="t">photo<br><em>Garnier, 23 h</em></div></div>
    <div style="background:var(--creme);color:var(--bx)"><div class="t">Toutes les portes <em style="color:var(--bx)">de Paris.</em></div></div>
    <div style="background:#3a302a;color:var(--pierre)"><div class="t">photo<br><em>salon privé</em></div></div>
    <div style="background:var(--bx);color:var(--pierre)"><div class="t">Sur rendez-vous.</div><div class="s">Lien en bio</div></div>
   </div>
  </div>
 </div>
</section>

<section class="dark">
 <div class="wrap">
  <div class="k">07 — Direction photo</div>
  <h2>Une touche de bordeaux dans chaque image.</h2>
  <div class="grid g2" style="gap:60px">
   <ul class="rules y"><li>Chaque photo contient au moins un élément bordeaux : porte, velours, cravate, cuir, cire.</li><li>Heure bleue, aube, nuit de pluie. Lumière rasante.</li><li>Des mains, des matières, des portes. Pas de visages.</li><li>Le véhicule est partiel : une portière, un reflet.</li><li>Rendu film moyen format, grain fin.</li></ul>
   <ul class="rules n"><li>Bordeaux saturé façon filtre : il vient de l'objet, jamais de l'étalonnage.</li><li>Voitures de face sous néons, jantes, liasses, champagne.</li><li>Logos constructeurs visibles.</li><li>Tour Eiffel carte postale.</li></ul>
  </div>
 </div>
</section>

<section class="bx">
 <div class="wrap">
  <div class="k">08 — Mise en œuvre</div>
  <h2>Les prochaines étapes.</h2>
  <ol class="steps">
   <li><b>Antériorités.</b> Chercher « AMANE » sur data.inpi.fr et TMview, classes 39 et 45. Si c'est libre : dépôt du nom seul et du logo, à faire valider par l'avocat.</li>
   <li><b>Graver le sceau.</b> Commander un cachet de cire en laiton de 30 mm à partir de amane-sceau-bordeaux.svg (artisans Etsy ou graveur à Paris, 40 à 90 €). Faire un test sur une enveloppe crème.</li>
   <li><b>Épreuve des cartes.</b> Recto : motif Arcades en sérigraphie ton sur ton + monogramme doré à chaud. Verso : coton 700 g, letterpress bordeaux. Demander une épreuve physique et la comparer au Pantone 7421 C.</li>
   <li><b>Test de taille.</b> Le monogramme reste lisible jusqu'à 32 px. En dessous, ou en favicon, utiliser le A seul.</li>
   <li><b>Grille Instagram.</b> Publier les 9 cases dans l'ordre ci-dessus, en remplaçant les cases « photo » par la série Higgsfield.</li>
  </ol>
 </div>
</section>
<footer>Amane · Conciergerie · Paris — Édition 02</footer>
</body></html>`;
fs.writeFileSync('../brandbook/index.html', html);
console.log('ok', (html.length / 1024).toFixed(0) + 'KB');
