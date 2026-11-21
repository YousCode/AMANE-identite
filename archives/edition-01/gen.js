// Génère le système de logo Amane en SVG (texte vectorisé, aucune dépendance de police)
const fs = require('fs');
const opentype = require('opentype.js');

const F = p => { const b = fs.readFileSync(__dirname + '/node_modules/@fontsource/' + p); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const bodoni = F('bodoni-moda/files/bodoni-moda-latin-500-normal.woff');
const jost = F('jost/files/jost-latin-400-normal.woff');

// Texte -> path avec interlettrage (tracking en fraction de la taille)
function textPath(font, str, size, tracking, cx, baseline) {
  const glyphs = font.stringToGlyphs(str);
  const scale = size / font.unitsPerEm;
  let w = 0;
  const adv = glyphs.map((g, i) => {
    let a = g.advanceWidth * scale;
    if (i < glyphs.length - 1) a += font.getKerningValue(g, glyphs[i + 1]) * scale + tracking * size;
    return a;
  });
  w = adv.reduce((s, a) => s + a, 0);
  let x = cx - w / 2, d = '';
  glyphs.forEach((g, i) => { d += g.getPath(x, baseline, size).toPathData(2); x += adv[i]; });
  return { d, w };
}

// --- Monogramme : A didone dont la barre est une serrure, sous une arche de porte cochère
// Repère 200 x 240
const A = `
  <path d="M93 40 L107 40 L149 196 L130 196 Z"/>
  <path d="M93 40 L97.5 40 L56.5 196 L52.5 196 Z"/>
  <rect x="38" y="194" width="34" height="2.6"/>
  <rect x="116" y="194" width="48" height="2.6"/>
  <rect x="72" y="128.6" width="43" height="2"/>
  <circle cx="93.5" cy="129.6" r="9.5"/>
  <path d="M90.2 134 L96.8 134 L100.5 158 L86.5 158 Z"/>`;
// Le A et la serrure sont pleins ; on évide la serrure dans un disque pour la lisibilité
const ARCH = `<path d="M14 232 V100 A86 86 0 0 1 186 100 V232" fill="none" stroke-width="3.2"/>
  <path d="M22 232 V100 A78 78 0 0 1 178 100 V232" fill="none" stroke-width="1"/>
  <rect x="6" y="230.4" width="188" height="1.8" stroke="none"/>`;

function symbol(color, { arch = true } = {}) {
  return `<g fill="${color}" stroke="${color}">${arch ? ARCH : ''}<g stroke="none" transform="translate(0 ${arch ? 13 : 0})">${A}</g></g>`;
}

const word = textPath(bodoni, 'AMANE', 100, 0.16, 0, 0);
const sub = textPath(jost, 'CONCIERGERIE  ·  PARIS', 17, 0.42, 0, 0);

function stacked(color, bg) {
  // symbole 200x240 centré, wordmark dessous
  const W = 760, H = 520;
  const cx = W / 2;
  const w1 = textPath(bodoni, 'AMANE', 104, 0.16, cx, 420);
  const w2 = textPath(jost, 'CONCIERGERIE  ·  PARIS', 17, 0.42, cx, 468);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ''}
  <g transform="translate(${cx - 100 * 1.1} 18) scale(1.1)">${symbol(color)}</g>
  <path d="${w1.d}" fill="${color}"/><path d="${w2.d}" fill="${color}"/></svg>`;
}

function horizontal(color, bg) {
  const w1 = textPath(bodoni, 'AMANE', 112, 0.16, 0, 0);
  const x0 = 250, W = Math.ceil(x0 + w1.w + 50), H = 260;
  cx = x0 + w1.w / 2 + 10;
  const a = textPath(bodoni, 'AMANE', 112, 0.16, cx, 150);
  const b = textPath(jost, 'CONCIERGERIE  ·  PARIS', 17, 0.42, cx, 200);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ''}
  <g transform="translate(40 14) scale(0.98)">${symbol(color)}</g>
  <path d="${a.d}" fill="${color}"/><path d="${b.d}" fill="${color}"/></svg>`;
}

function wordmark(color, bg) {
  const W = 760, H = 200, cx = W / 2;
  const a = textPath(bodoni, 'AMANE', 112, 0.16, cx, 118);
  const b = textPath(jost, 'CONCIERGERIE  ·  PARIS', 17, 0.42, cx, 166);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ''}
  <path d="${a.d}" fill="${color}"/><path d="${b.d}" fill="${color}"/></svg>`;
}

function mono(color, bg, arch = true) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${arch ? '0 0 200 240' : '30 30 140 175'}">${bg ? `<rect x="-50" y="-50" width="400" height="400" fill="${bg}"/>` : ''}${symbol(color, { arch })}</svg>`;
}

const C = { noir: '#15110F', pierre: '#EAE3D6', bordeaux: '#5B1622', or: '#B48E55', zinc: '#7E858C' };
fs.mkdirSync('out', { recursive: true });
const files = {
  'logo-principal-noir.svg': stacked(C.noir),
  'logo-principal-pierre.svg': stacked(C.pierre),
  'logo-principal-or.svg': stacked(C.or),
  'logo-horizontal-noir.svg': horizontal(C.noir),
  'logo-horizontal-pierre.svg': horizontal(C.pierre),
  'wordmark-noir.svg': wordmark(C.noir),
  'wordmark-pierre.svg': wordmark(C.pierre),
  'monogramme-noir.svg': mono(C.noir),
  'monogramme-or.svg': mono(C.or),
  'monogramme-pierre.svg': mono(C.pierre),
  'monogramme-bordeaux.svg': mono('#3a0b13'),
  'monogramme-seul-noir.svg': mono(C.noir, null, false),
  // version bordeaux / pierre pour visuels
  'logo-principal-pierre-sur-bordeaux.svg': stacked(C.pierre, C.bordeaux),
  'logo-principal-or-sur-noir.svg': stacked(C.or, C.noir),
  'logo-principal-noir-sur-pierre.svg': stacked(C.noir, C.pierre),
};
for (const [n, s] of Object.entries(files)) fs.writeFileSync('out/' + n, s);
console.log(Object.keys(files).join('\n'));
