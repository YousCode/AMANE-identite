const fs = require('fs');
const S = n => fs.readFileSync('out/' + n, 'utf8').replace(/<svg /, '<svg class="lg" ');
const C = { noir: '#15110F', pierre: '#EAE3D6', bordeaux: '#5B1622', or: '#B48E55', zinc: '#7E858C', creme: '#F5F1EA' };

const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Amane — Identité de marque</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;1,6..96,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<style>
:root{--noir:${C.noir};--pierre:${C.pierre};--bx:${C.bordeaux};--or:${C.or};--zinc:${C.zinc};--creme:${C.creme}}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--creme);color:var(--noir);font-family:Jost,sans-serif;font-weight:300;font-size:16px;line-height:1.65;-webkit-font-smoothing:antialiased}
.lg{display:block;width:100%;height:auto}
section{padding:120px 8vw;position:relative}
.wrap{max-width:1180px;margin:0 auto}
.k{font-family:Jost;font-weight:400;font-size:11px;letter-spacing:.42em;text-transform:uppercase;color:var(--zinc);margin-bottom:28px;display:flex;gap:18px;align-items:center}
.k:before{content:"";width:36px;height:1px;background:currentColor;opacity:.6}
h2{font-family:'Bodoni Moda',serif;font-weight:400;font-size:clamp(34px,4.6vw,62px);line-height:1.08;letter-spacing:-.01em;margin-bottom:34px;max-width:16ch}
h3{font-family:'Bodoni Moda',serif;font-weight:500;font-size:22px;margin-bottom:10px}
p{max-width:62ch}
p+p{margin-top:14px}
em{font-family:'Bodoni Moda',serif;font-style:italic;font-weight:400}
.dark{background:var(--noir);color:var(--pierre)}
.bx{background:var(--bx);color:var(--pierre)}
.pierre{background:var(--pierre)}
.dark .k,.bx .k{color:var(--or)}
.grid{display:grid;gap:28px}
.g2{grid-template-columns:repeat(2,1fr)}.g3{grid-template-columns:repeat(3,1fr)}.g4{grid-template-columns:repeat(4,1fr)}
@media(max-width:820px){.g2,.g3,.g4{grid-template-columns:1fr}section{padding:80px 6vw}}
.tile{border-radius:2px;display:flex;align-items:center;justify-content:center;padding:48px}
.cap{font-size:11px;letter-spacing:.3em;text-transform:uppercase;margin-top:14px;color:var(--zinc)}
/* couverture */
.cover{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bx);color:var(--pierre);text-align:center}
.cover .lg{width:min(520px,78vw)}
.cover .meta{position:absolute;bottom:40px;left:0;right:0;font-size:11px;letter-spacing:.42em;text-transform:uppercase;color:var(--or)}
.cover .meta span{margin:0 18px}
/* diagnostic */
.diag{display:grid;grid-template-columns:1fr 1.25fr;gap:64px;align-items:start}
@media(max-width:820px){.diag{grid-template-columns:1fr}}
.verdict li{list-style:none;padding:18px 0;border-top:1px solid rgba(21,17,15,.14);display:grid;grid-template-columns:110px 1fr;gap:18px}
.verdict b{font-weight:500;font-size:11px;letter-spacing:.3em;text-transform:uppercase;padding-top:3px}
.verdict .no{color:var(--bx)}.verdict .ok{color:#4d6b52}
.old{background:#4a0f17;aspect-ratio:2/3;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#2b070c;position:relative}
.old svg{width:44%}
.old .t{font-family:'Bodoni Moda';font-size:42px;letter-spacing:.06em;color:#2e070d;text-shadow:0 1px 0 rgba(255,255,255,.08)}
.old .lbl{position:absolute;top:16px;left:16px;font-size:10px;letter-spacing:.3em;color:#c99;text-transform:uppercase}
/* concept */
.concept{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center}
@media(max-width:820px){.concept{grid-template-columns:1fr}}
.anat{position:relative}
.anat .lg{max-width:360px;margin:0 auto}
.note{display:grid;grid-template-columns:28px 1fr;gap:14px;padding:16px 0;border-top:1px solid rgba(234,227,214,.16)}
.note i{font-style:normal;font-family:'Bodoni Moda';color:var(--or);font-size:20px;line-height:1}
.sig{font-family:'Bodoni Moda';font-style:italic;font-size:clamp(28px,3.4vw,44px);line-height:1.2;margin:8px 0 4px}
/* palette */
.sw{aspect-ratio:3/4;padding:22px;display:flex;flex-direction:column;justify-content:flex-end;font-size:12px;letter-spacing:.08em}
.sw h4{font-family:'Bodoni Moda';font-weight:400;font-size:24px;letter-spacing:0;margin-bottom:6px}
.ratio{display:flex;height:22px;margin-top:36px}
.ratio div{height:100%}
/* typo */
.spec{border-top:1px solid rgba(21,17,15,.14);padding:36px 0;display:grid;grid-template-columns:220px 1fr;gap:40px;align-items:baseline}
@media(max-width:820px){.spec{grid-template-columns:1fr;gap:10px}}
.spec .lab{font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--zinc)}
.dA{font-family:'Bodoni Moda';font-weight:500;font-size:clamp(46px,7vw,96px);letter-spacing:.16em;line-height:1}
.dB{font-family:'Bodoni Moda';font-size:clamp(28px,3.4vw,42px);line-height:1.15}
.dC{font-family:Jost;font-weight:400;font-size:13px;letter-spacing:.42em;text-transform:uppercase}
.dD{font-family:Jost;font-weight:300;font-size:17px;max-width:60ch}
/* applications vectorielles */
.mock{border-radius:2px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;aspect-ratio:4/3;background:linear-gradient(160deg,#ddd4c4,#cfc5b3)}
.card{width:50%;aspect-ratio:85/55;box-shadow:0 18px 40px -18px rgba(0,0,0,.45),0 2px 4px rgba(0,0,0,.12);display:flex;align-items:center;justify-content:center;position:absolute}
.card.a{background:var(--bx);transform:translate(-12%,-8%) rotate(-6deg)}
.card.b{background:#f4efe6;transform:translate(14%,12%) rotate(4deg);flex-direction:column;color:var(--noir);text-align:center}
.card.a svg{width:26%}
.card.b .w{width:62%}
.card.b small{font-size:7px;letter-spacing:.32em;text-transform:uppercase;margin-top:10px;color:#555}
.tag{width:22%;aspect-ratio:1/1.9;background:linear-gradient(145deg,#6a1c29,#4a0f19);border-radius:48% 48% 10px 10px/ 26% 26% 10px 10px;box-shadow:0 22px 40px -16px rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;position:relative}
.tag:before{content:"";position:absolute;top:9%;width:12%;aspect-ratio:1;border-radius:50%;background:#cfc5b3;box-shadow:inset 0 2px 3px rgba(0,0,0,.4)}
.tag:after{content:"";position:absolute;inset:6px;border-radius:inherit;border:1px dashed rgba(234,227,214,.35)}
.tag svg{width:56%;margin-top:30%;filter:drop-shadow(0 -1px 0 rgba(0,0,0,.45)) drop-shadow(0 1px 0 rgba(255,255,255,.12))}
.post{aspect-ratio:4/5;width:58%;background:var(--noir);color:var(--pierre);display:flex;flex-direction:column;justify-content:space-between;padding:7%;box-shadow:0 20px 40px -16px rgba(0,0,0,.5)}
.post .t{font-family:'Bodoni Moda';font-size:clamp(16px,2vw,24px);line-height:1.15}
.post .t em{color:var(--or)}
.post .f{display:flex;justify-content:space-between;align-items:flex-end;font-size:8px;letter-spacing:.3em;text-transform:uppercase;color:var(--or)}
.post .f svg{width:16%}
.plq{width:46%;aspect-ratio:3/2;background:linear-gradient(135deg,#d9b779,#a8833f 45%,#e0c48c 70%,#9c7737);box-shadow:0 14px 30px -12px rgba(0,0,0,.5),inset 0 0 0 1px rgba(255,255,255,.35);display:flex;align-items:center;justify-content:center;padding:6%}
.plq svg{filter:drop-shadow(0 1px 0 rgba(255,255,255,.35))}
.limestone{background:repeating-linear-gradient(0deg,#e7dfd1 0 58px,#dcd3c3 58px 60px),#e7dfd1}
/* règles */
.rules li{list-style:none;padding:14px 0 14px 34px;border-top:1px solid rgba(21,17,15,.12);position:relative}
.rules li:before{position:absolute;left:0;top:13px;font-family:'Bodoni Moda'}
.rules.y li:before{content:"✓";color:#4d6b52}.rules.n li:before{content:"✕";color:var(--bx)}
.dark .rules li{border-color:rgba(234,227,214,.14)}
.words{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.words span{border:1px solid currentColor;padding:6px 14px;font-size:13px;letter-spacing:.05em}
.words.bad span{opacity:.5;text-decoration:line-through}
.clear{position:relative;padding:40px;border:1px dashed var(--zinc);display:inline-block;width:100%}
.clear .lg{max-width:280px;margin:0 auto}
.steps li{list-style:none;counter-increment:s;padding:20px 0 20px 64px;border-top:1px solid rgba(234,227,214,.16);position:relative}
.steps li:before{content:counter(s,decimal-leading-zero);position:absolute;left:0;top:16px;font-family:'Bodoni Moda';font-size:28px;color:var(--or)}
.steps li b{font-weight:500}
footer{padding:60px 8vw;text-align:center;font-size:11px;letter-spacing:.42em;text-transform:uppercase;color:var(--zinc)}
</style></head><body>

<section class="cover">
  <div style="width:min(520px,78vw)">${S('logo-principal-pierre.svg')}</div>
  <div class="meta"><span>Identité de marque</span><span>·</span><span>Édition 01</span><span>·</span><span>Novembre 2026</span></div>
</section>

<section>
 <div class="wrap diag">
  <div>
   <div class="old"><div class="lbl">Existant</div>
     <svg viewBox="0 0 100 100"><path fill="none" stroke="#2e070d" stroke-width="5" d="M50 8a20 20 0 0 1 20 20a20 20 0 0 1 22 22a20 20 0 0 1-22 22a20 20 0 0 1-20 20a20 20 0 0 1-20-20a20 20 0 0 1-22-22a20 20 0 0 1 22-22a20 20 0 0 1 20-20z"/><circle cx="50" cy="45" r="6" fill="#2e070d"/><path d="M47 48h6l2 12h-10z" fill="#2e070d"/></svg>
     <div class="t">AMANE</div></div>
  </div>
  <div>
   <div class="k">01 — Diagnostic</div>
   <h2>Pourquoi on repart de zéro.</h2>
   <ul class="verdict">
    <li><b class="no">Risque</b><span>La fleur à quatre lobes est la signature visuelle du Monogram Louis Vuitton. Associée à un bordeaux et à un univers luxe, la proximité est immédiate : exposition à une opposition au dépôt INPI/EUIPO, et pour le client averti, un effet « inspiré de ». Une maison de luxe ne peut pas commencer par emprunter.</span></li>
    <li><b class="no">Paris</b><span>Rien dans le symbole ne dit Paris. Le mot « Paris » porte seul toute la promesse.</span></li>
    <li><b class="no">Typo</b><span>Serif générique en gaufrage : propre, mais interchangeable avec cent autres marques.</span></li>
    <li><b class="ok">À garder</b><span>La serrure. C'est la bonne idée : l'accès, le privé, la confiance. On la garde comme cœur du nouveau signe, ainsi que le bordeaux, qui devient une couleur parmi d'autres.</span></li>
   </ul>
  </div>
 </div>
</section>

<section class="dark">
 <div class="wrap concept">
  <div class="anat">${S('monogramme-pierre.svg')}</div>
  <div>
   <div class="k">02 — Concept</div>
   <h2>La porte cochère.</h2>
   <p>Paris se vit derrière ses portes. La porte cochère haussmannienne, laquée noir, cerclée de pierre, est le seuil entre la rue et l'intérieur, entre le public et le privé. Une conciergerie vend précisément ce passage.</p>
   <div style="margin-top:30px">
    <div class="note"><i>I</i><span><b>L'arche</b> : le cintre d'une porte cochère du VIII<sup>e</sup>. Double filet, comme une moulure. La ligne de seuil déborde : on entre.</span></div>
    <div class="note"><i>II</i><span><b>Le A didone</b> : plein et délié, l'écriture des plaques et des enseignes parisiennes du XIX<sup>e</sup>.</span></div>
    <div class="note"><i>III</i><span><b>La serrure</b> remplace la barre du A. Elle se lit en dernier, ce qui en fait le détail qu'on retient.</span></div>
   </div>
   <div style="margin-top:44px"><div class="k" style="margin-bottom:10px">Signature</div>
    <div class="sig">Toutes les portes de Paris.</div>
    <p style="opacity:.6;font-size:14px">Alternatives : « Paris, à huis clos. » · « Votre clé de Paris. »</p></div>
  </div>
 </div>
</section>

<section>
 <div class="wrap">
  <div class="k">03 — Système de logo</div>
  <h2>Quatre signes, une seule voix.</h2>
  <div class="grid g2">
   <div><div class="tile pierre" style="aspect-ratio:4/3"><div style="width:70%">${S('logo-principal-noir.svg')}</div></div><div class="cap">Logo principal — usages institutionnels, couverture, signalétique</div></div>
   <div><div class="tile bx" style="aspect-ratio:4/3"><div style="width:84%">${S('logo-horizontal-pierre.svg')}</div></div><div class="cap">Horizontal — site web, en-têtes, signatures e-mail</div></div>
   <div><div class="tile dark" style="aspect-ratio:4/3"><div style="width:30%">${S('monogramme-or.svg')}</div></div><div class="cap">Monogramme — gaufrage, dorure, cuir, avatar réseaux</div></div>
   <div><div class="tile" style="aspect-ratio:4/3;background:#fff"><div style="width:74%">${S('wordmark-noir.svg')}</div></div><div class="cap">Logotype seul — quand le monogramme est déjà présent</div></div>
  </div>
  <div class="grid g3" style="margin-top:70px;align-items:start">
   <div><h3>Zone de protection</h3><p>Autour du logo, une marge égale à la hauteur du A du logotype. Rien n'y entre : ni texte, ni bord de page, ni photo chargée.</p></div>
   <div><h3>Tailles minimales</h3><p>Logo principal : 22 mm / 120 px de large. Monogramme : 8 mm / 32 px. En dessous, le monogramme sans arche.</p></div>
   <div class="clear"><div style="width:30%;margin:0 auto">${S('monogramme-seul-noir.svg')}</div><div class="cap" style="text-align:center">Monogramme sans arche, &lt; 8 mm</div></div>
  </div>
 </div>
</section>

<section class="pierre">
 <div class="wrap">
  <div class="k">04 — Couleurs</div>
  <h2>La palette d'une façade parisienne.</h2>
  <div class="grid g4" style="gap:14px">
   <div class="sw" style="background:var(--noir);color:var(--pierre)"><h4>Noir laqué</h4>#15110F<br>Porte cochère</div>
   <div class="sw" style="background:var(--creme);color:var(--noir);outline:1px solid rgba(0,0,0,.08)"><h4>Pierre de Paris</h4>#EAE3D6 · #F5F1EA<br>Calcaire lutétien</div>
   <div class="sw" style="background:var(--bx);color:var(--pierre)"><h4>Velours Garnier</h4>#5B1622<br>Fauteuils de l'Opéra</div>
   <div class="sw" style="background:var(--zinc);color:#fff"><h4>Zinc</h4>#7E858C<br>Toits de Paris</div>
  </div>
  <div class="grid g2" style="margin-top:14px;gap:14px">
   <div class="sw" style="aspect-ratio:auto;height:160px;background:linear-gradient(120deg,#c9a46a,#a88148 50%,#d7b67e);color:var(--noir)"><h4>Or Garnier</h4>#B48E55 — dorure à chaud uniquement, jamais en aplat de fond</div>
   <div style="padding:22px 6px"><p><b style="font-weight:500">Règle de dosage.</b> La pierre et le noir font la marque. Le bordeaux est un événement : coffret, couverture, une story sur cinq. L'or ne sert qu'au métal et à la dorure, jamais en texte courant.</p>
    <div class="ratio"><div style="flex:45;background:var(--creme);outline:1px solid rgba(0,0,0,.08)"></div><div style="flex:30;background:var(--noir)"></div><div style="flex:15;background:var(--bx)"></div><div style="flex:7;background:var(--zinc)"></div><div style="flex:3;background:var(--or)"></div></div>
    <div class="cap">45 · 30 · 15 · 7 · 3 %</div></div>
  </div>
 </div>
</section>

<section>
 <div class="wrap">
  <div class="k">05 — Typographie</div>
  <h2>Un didone, un géométrique. Rien d'autre.</h2>
  <div class="spec"><div class="lab">Bodoni Moda 500<br>Capitales, +16 %</div><div class="dA">AMANE</div></div>
  <div class="spec"><div class="lab">Bodoni Moda 400 / italique<br>Titres éditoriaux</div><div class="dB">Une voiture vous attend <em>rue du Faubourg</em>, à vingt heures.</div></div>
  <div class="spec"><div class="lab">Jost 400<br>Capitales, +42 %</div><div class="dC">Conciergerie · Chauffeur · Personal shopping</div></div>
  <div class="spec"><div class="lab">Jost 300<br>Texte courant</div><div class="dD">Chaque demande est confiée à un seul interlocuteur, joignable à toute heure. Nous ne publions ni tarifs ni catalogue : nous répondons à ce qui vous est nécessaire.</div></div>
  <p style="margin-top:26px;font-size:14px;color:var(--zinc)">Les deux familles sont gratuites (Google Fonts, licence OFL) : utilisables sur le site, Canva, Figma et l'impression sans frais de licence.</p>
 </div>
</section>

<section class="pierre">
 <div class="wrap">
  <div class="k">06 — Applications</div>
  <h2>Le logo en situation.</h2>
  <div class="grid g2">
   <div><div class="mock"><div class="card a">${S('monogramme-or.svg')}</div><div class="card b"><div class="w">${S('wordmark-noir.svg')}</div><small>Sur rendez-vous — Paris VIII</small></div></div><div class="cap">Carte — recto bordeaux dorure or, verso coton 700 g letterpress</div></div>
   <div><div class="mock" style="background:linear-gradient(160deg,#cfc5b3,#bfb39d)"><div class="tag">${S('monogramme-bordeaux.svg')}</div></div><div class="cap">Porte-clés cuir bordeaux, monogramme embossé à sec — remis avec chaque véhicule</div></div>
   <div><div class="mock" style="background:linear-gradient(160deg,#2a2420,#15110F)"><div class="post"><div class="t">Certaines portes<br>ne s'ouvrent<br><em>qu'une fois.</em></div><div class="f"><span>Amane · Paris</span>${S('monogramme-or.svg')}</div></div></div><div class="cap">Post Instagram 4:5 — noir, une phrase, le monogramme en pied</div></div>
   <div><div class="mock limestone"><div class="plq">${S('logo-principal-noir.svg')}</div></div><div class="cap">Plaque laiton gravée, remplissage noir — entrée du showroom</div></div>
  </div>
 </div>
</section>

<section class="dark">
 <div class="wrap">
  <div class="k">07 — Direction photo</div>
  <h2>On montre le seuil, jamais la vitrine.</h2>
  <div class="grid g2" style="gap:60px">
   <div><ul class="rules y">
    <li>Heure bleue, aube, nuit de pluie. Lumière rasante.</li>
    <li>Des mains, des matières, des portes. Pas de visages.</li>
    <li>Le véhicule est partiel : une portière, un reflet, une calandre floue.</li>
    <li>Rendu film moyen format, grain fin, contrastes doux.</li>
    <li>Architecture parisienne réelle : pierre, zinc, ferronnerie, parquet.</li>
   </ul></div>
   <div><ul class="rules n">
    <li>Voiture de face sous néons, jantes en gros plan, posture « rappeur ».</li>
    <li>Liasses, champagne qui gicle, montres en évidence.</li>
    <li>Tour Eiffel en carte postale (une fois par an, de nuit, partielle à la rigueur).</li>
    <li>Logos constructeurs visibles : ils signent la photo à notre place.</li>
    <li>Filtres orangés, HDR, ciels saturés.</li>
   </ul></div>
  </div>
  <p style="margin-top:40px;opacity:.75">La série générée sur Higgsfield (12 images, dans votre compte) applique ces règles : porte cochère à l'heure bleue, remise de clé, toits en zinc à l'aube, salon haussmannien, arrivée à Garnier, salon de shopping privé, plus trois mises en situation du logo (coffret, plaque, cartes).</p>
 </div>
</section>

<section>
 <div class="wrap">
  <div class="k">08 — Ton de voix</div>
  <h2>On parle comme un majordome, pas comme une pub.</h2>
  <div class="grid g2" style="gap:60px">
   <div><p>Vouvoiement systématique. Phrases courtes, au présent. On décrit un moment précis plutôt qu'une promesse. On ne cite jamais de prix publiquement, on ne compare jamais.</p>
    <div class="words"><span>sur rendez-vous</span><span>à votre convenance</span><span>discrètement</span><span>confié</span><span>l'heure</span><span>la porte</span><span>la clé</span></div></div>
   <div><p>Les mots que tout le monde utilise s'usent et banalisent la marque. Ils sont bannis :</p>
    <div class="words bad"><span>luxe</span><span>premium</span><span>exclusif</span><span>VIP</span><span>haut de gamme</span><span>le meilleur</span><span>🔥</span></div></div>
  </div>
 </div>
</section>

<section class="bx">
 <div class="wrap">
  <div class="k">09 — Mise en œuvre</div>
  <h2>Les prochaines étapes.</h2>
  <ol class="steps">
   <li><b>Antériorités.</b> Recherche sur data.inpi.fr et TMview (EUIPO) : « AMANE » en classes 39 (location de véhicules, transport) et 45 (conciergerie). Si libre, dépôt INPI en verbal + semi-figuratif (≈ 190 € pour 1 classe, +40 € par classe). À faire valider par Aziz avant tout imprimé.</li>
   <li><b>Domaine et réseaux.</b> Vérifier amane.paris, amane-paris.com, @amane.paris sur Instagram et TikTok, et réserver le même jour.</li>
   <li><b>Test de réduction.</b> Imprimer le monogramme à 8 mm et l'afficher en avatar 110 px. Si la serrure disparaît, utiliser la version sans arche.</li>
   <li><b>Premiers imprimés.</b> 250 cartes coton 700 g, recto dorure or sur bordeaux, verso letterpress noir. Demander une épreuve physique avant tirage.</li>
   <li><b>Grille Instagram.</b> 9 premiers posts : 5 photos selon la direction ci-dessus, 3 posts typographiques noirs, 1 bordeaux avec le logo principal.</li>
  </ol>
 </div>
</section>
<footer>Amane · Conciergerie · Paris — Identité, édition 01</footer>
</body></html>`;
fs.writeFileSync('brandbook.html', html);
console.log('ok', (html.length / 1024).toFixed(0) + 'KB');
