// Amane v2 — monogramme redessiné, sceau, motif Arcades, logotype à A sur-mesure
const fs = require('fs');
const opentype = require('opentype.js');
const F = p => { const b = fs.readFileSync(__dirname + '/node_modules/@fontsource/' + p); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const bodoni = F('bodoni-moda/files/bodoni-moda-latin-500-normal.woff');
const jost = F('jost/files/jost-latin-400-normal.woff');
const f = n => +n.toFixed(2);

// ---------- Le A (grille 1000, capitale de 0 à 1000) ----------
// Didone : délié à gauche, plein à droite, empattements filiformes à congés, barre = filet + serrure
function lerp(a, b, y) { return a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]); }
const THICK_L = [[452, -6], [722, 1000]], THICK_R = [[560, -6], [858, 1000]];
const THIN_L = [[452, -6], [162, 1000]], THIN_R = [[486, 40], [194, 1000]];
function glyphA({ bar = 'key' } = {}) {
  const xr = y => lerp(...THICK_R, y), xl = y => lerp(...THICK_L, y);
  const tl = y => lerp(...THIN_L, y), tr = y => lerp(...THIN_R, y);
  const B = 982, S = 1000; // haut de l'empattement, ligne de base
  let d = '';
  // plein (fût droit) avec pointe d'apex légèrement débordante
  d += `M${f(xl(-6))} -6 L${f(xr(-6))} -6 L${f(xr(B - 70))} ${B - 70} Q${f(xr(B) + 4)} ${B} ${f(xr(B) + 78)} ${B} L${f(xr(B) + 78)} ${S} L${f(xl(B) - 64)} ${S} L${f(xl(B) - 64)} ${B} Q${f(xl(B) - 2)} ${B} ${f(xl(B - 70))} ${B - 70} Z `;
  // délié
  d += `M${f(tl(-6))} -6 L${f(tr(40))} 40 L${f(tr(B - 60))} ${B - 60} Q${f(tr(B) + 2)} ${B} ${f(tr(B) + 62)} ${B} L${f(tr(B) + 62)} ${S} L${f(tl(B) - 70)} ${S} L${f(tl(B) - 70)} ${B} Q${f(tl(B) - 2)} ${B} ${f(tl(B - 60))} ${B - 60} Z `;
  // barre filiforme entre les fûts
  const yb = 640, h = 15;
  const x0 = tr(yb) - 2, x1 = xl(yb) + 2;
  const cx = (x0 + x1) / 2;
  if (bar === 'key' || bar === 'bar') d += `M${f(x0)} ${yb - h / 2} L${f(x1)} ${yb - h / 2} L${f(x1)} ${yb + h / 2} L${f(x0)} ${yb + h / 2} Z `;
  if (bar === 'key') {
    // serrure : anneau + panneton évasé, base arrondie
    const r = 58, cy = yb - 4;
    d += `M${f(cx - r)} ${cy} A${r} ${r} 0 1 1 ${f(cx + r)} ${cy} A${r} ${r} 0 1 1 ${f(cx - r)} ${cy} Z `;
    d += `M${f(cx - 22)} ${cy + 40} L${f(cx + 22)} ${cy + 40} L${f(cx + 46)} ${cy + 196} Q${f(cx + 48)} ${cy + 206} ${f(cx + 38)} ${cy + 206} L${f(cx - 38)} ${cy + 206} Q${f(cx - 48)} ${cy + 206} ${f(cx - 46)} ${cy + 196} Z `;
  }
  return { d, cx };
}
const A = glyphA();
// boîte du A : x 92..936
const AX0 = 92, AX1 = 936;

// ---------- Arche (porte cochère) en repère 1000 x 1260 ----------
function arch({ w = 1000, h = 1260, outer = 22, inner = 7, gap = 34, sill = true } = {}) {
  const r = w / 2 - outer / 2, cx = w / 2, top = outer / 2 + r; // centre de l'arc
  const r2 = r - gap;
  let s = `<path d="M${outer / 2} ${h} V${top} A${r} ${r} 0 0 1 ${w - outer / 2} ${top} V${h}" fill="none" stroke-width="${outer}"/>`;
  s += `<path d="M${outer / 2 + gap} ${h} V${top} A${r2} ${r2} 0 0 1 ${w - outer / 2 - gap} ${top} V${h}" fill="none" stroke-width="${inner}"/>`;
  // clef de voûte : petit losange au sommet
  s += `<path d="M${cx} ${outer / 2 + gap + 6} l26 34 l-26 34 l-26 -34 Z" stroke="none"/>`;
  if (sill) s += `<rect x="-60" y="${h - 4}" width="${w + 120}" height="14" stroke="none"/><rect x="-30" y="${h + 22}" width="${w + 60}" height="5" stroke="none"/>`;
  return s;
}

// Symbole complet : viewBox 0 0 1000 1300 (+ débords seuil)
function symbol(color) {
  const scale = 0.74, ax = 500 - ((AX0 + AX1) / 2) * scale, ay = 1232 - 1000 * scale;
  return `<g fill="${color}" stroke="${color}">${arch()}<path stroke="none" transform="translate(${f(ax)} ${ay}) scale(${scale})" d="${A.d}"/></g>`;
}
const symVB = '-70 -10 1140 1310';

// ---------- Texte vectorisé ----------
function glyphRun(font, str, size, tracking) {
  const gs = font.stringToGlyphs(str), sc = size / font.unitsPerEm;
  return gs.map((g, i) => ({ g, adv: g.advanceWidth * sc + (i < gs.length - 1 ? font.getKerningValue(g, gs[i + 1]) * sc + tracking * size : 0) }));
}
function textPath(font, str, size, tracking, cx, base) {
  const run = glyphRun(font, str, size, tracking);
  const w = run.reduce((s, r) => s + r.adv, 0);
  let x = cx - w / 2, d = '';
  run.forEach(r => { d += r.g.getPath(x, base, size).toPathData(2); x += r.adv; });
  return { d, w };
}
// Logotype AMANE avec le A sur-mesure (serrure) à la place des A de Bodoni
function wordmarkPath(size, tracking, cx, base, { keyAll = false } = {}) {
  const run = glyphRun(bodoni, 'AMANE', size, tracking);
  const cap = (bodoni.tables.os2.sCapHeight || 0.69 * bodoni.unitsPerEm) / bodoni.unitsPerEm * size;
  const w = run.reduce((s, r) => s + r.adv, 0);
  let x = cx - w / 2, d = '';
  run.forEach((r, i) => {
    if (r.g.name === 'A' || r.g.unicode === 65) {
      const gw = r.g.advanceWidth / bodoni.unitsPerEm * size;
      const sc = cap / 1000 * 1.0, aw = (AX1 - AX0) * sc;
      const tx = x + (gw - aw) / 2 - AX0 * sc, ty = base - cap;
      const g = (i === 0 || keyAll) ? A : glyphA({ bar: 'bar' });
      d += transformPath(g.d, sc, tx, ty);
    } else d += r.g.getPath(x, base, size).toPathData(2);
    x += r.adv;
  });
  return { d, w };
}
// applique scale+translate à un path absolu M/L/Q/A/Z
function transformPath(d, s, tx, ty) {
  return d.replace(/([MLQAZ])([^MLQAZ]*)/g, (m, c, args) => {
    const n = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (c === 'Z') return 'Z ';
    if (c === 'A') return `A${f(n[0] * s)} ${f(n[1] * s)} ${n[2]} ${n[3]} ${n[4]} ${f(n[5] * s + tx)} ${f(n[6] * s + ty)} `;
    const out = []; for (let i = 0; i < n.length; i += 2) out.push(f(n[i] * s + tx), f(n[i + 1] * s + ty));
    return c + out.join(' ') + ' ';
  });
}
// Texte sur cercle (sceau)
function circleText(font, str, size, tracking, cx, cy, r, startDeg = -90) {
  const run = glyphRun(font, str, size, tracking);
  const total = run.reduce((s, x) => s + x.adv, 0);
  const dA = 2 * Math.PI / total; // répartit sur 360°
  const first = str.indexOf('  ') > 0 ? glyphRun(font, str.slice(0, str.indexOf('  ')), size, tracking).reduce((s, x) => s + x.adv, 0) : 0;
  let a = startDeg * Math.PI / 180 - first * dA / 2, out = '';
  run.forEach(({ g, adv }) => {
    const gw = g.advanceWidth * size / font.unitsPerEm;
    const mid = a + (gw / 2) * dA;
    const px = cx + r * Math.cos(mid), py = cy + r * Math.sin(mid);
    const deg = mid * 180 / Math.PI + 90;
    out += `<path transform="translate(${f(px)} ${f(py)}) rotate(${f(deg)}) translate(${f(-gw / 2)} 0)" d="${g.getPath(0, 0, size).toPathData(2)}"/>`;
    a += adv * dA;
  });
  return out;
}

// ---------- Compositions ----------
const C = { noir: '#15110F', pierre: '#EFE7DA', bx: '#5B1622', lie: '#3B0C15', bxc: '#7A2232', or: '#B8955C', zinc: '#7E858C', creme: '#F6F1E8' };
const svg = (vb, body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${bg ? `<rect x="-5000" y="-5000" width="10000" height="10000" fill="${bg}"/>` : ''}${body}</svg>`;

function primary(color, bg) {
  const W = 1400, cx = W / 2;
  const s = 0.5;
  const wm = wordmarkPath(190, 0.15, cx, 900);
  const sub = textPath(jost, 'CONCIERGERIE  ·  PARIS', 31, 0.46, cx, 990);
  return svg(`0 0 ${W} 1050`, `<g transform="translate(${f(cx - 500 * s)} 36) scale(${s})">${symbol(color)}</g><g fill="${color}"><path d="${wm.d}"/><path d="${sub.d}"/></g>`, bg);
}
function horizontal(color, bg) {
  const s = 0.2, symW = 1000 * s;
  const wm0 = wordmarkPath(150, 0.15, 0, 0);
  const x0 = 40 + symW + 70, cx = x0 + wm0.w / 2;
  const wm = wordmarkPath(150, 0.15, cx, 200);
  const sub = textPath(jost, 'CONCIERGERIE  ·  PARIS', 24, 0.46, cx, 268);
  return svg(`0 0 ${Math.ceil(x0 + wm0.w + 40)} 320`, `<g transform="translate(40 26) scale(${s})">${symbol(color)}</g><g fill="${color}"><path d="${wm.d}"/><path d="${sub.d}"/></g>`, bg);
}
function wordmark(color, bg, sub = true) {
  const W = 1200, cx = W / 2;
  const wm = wordmarkPath(190, 0.15, cx, 210);
  const st = textPath(jost, 'CONCIERGERIE  ·  PARIS', 31, 0.46, cx, 300);
  return svg(`0 0 ${W} ${sub ? 350 : 260}`, `<g fill="${color}"><path d="${wm.d}"/>${sub ? `<path d="${st.d}"/>` : ''}</g>`, bg);
}
function mono(color, bg) { return svg(symVB, symbol(color), bg); }
function monoA(color, bg) { return svg('40 -60 940 1120', `<path fill="${color}" d="${A.d}"/>`, bg); }
function seal(color, bg) {
  const R = 500, cx = 500, cy = 500;
  const s = 0.36;
  const t = circleText(jost, 'AMANE  ·  CONCIERGERIE  ·  PARIS  ·  MMXXVI  ·  ', 44, 0.32, cx, cy, 392, -90);
  const body = `<g fill="${color}" stroke="${color}">
   <circle cx="${cx}" cy="${cy}" r="${R - 12}" fill="none" stroke-width="22"/>
   <circle cx="${cx}" cy="${cy}" r="${R - 50}" fill="none" stroke-width="5"/>
   <circle cx="${cx}" cy="${cy}" r="330" fill="none" stroke-width="5"/>
   <g stroke="none">${t}</g>
   <g transform="translate(${f(cx - 500 * s)} ${f(cy - 640 * s)}) scale(${s})">${symbol(color)}</g></g>`;
  return svg('-10 -10 1020 1020', body, bg);
}
// Motif « Arcades » : rangée d'arches, une serrure toutes les trois
function pattern(fg, bg, op = 1) {
  const tw = 120, th = 190;
  const archTile = (key) => `<g fill="none" stroke="${fg}" stroke-width="2.2" opacity="${op}"><path d="M14 ${th} V64 A46 46 0 0 1 106 64 V${th}"/><path d="M22 ${th} V64 A38 38 0 0 1 98 64 V${th}" stroke-width=".8"/></g>${key ? `<g fill="${fg}" opacity="${op}" transform="translate(60 112)"><circle r="8"/><path d="M-3.4 5 H3.4 L7 26 H-7Z"/></g>` : ''}`;
  let tiles = '';
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) tiles += `<g transform="translate(${c * tw + (r ? tw / 2 : 0)} ${r * th})">${archTile((c + r * 2) % 3 === 1)}</g>`;
  // wrap pour décalage
  tiles += `<g transform="translate(${-tw / 2} ${th})">${archTile(false)}</g>`;
  return { w: tw * 3, h: th * 2, inner: `<rect width="${tw * 3}" height="${th * 2}" fill="${bg}"/>${tiles}` };
}
function patternSVG(fg, bg, op, W = 1200, H = 760) {
  const p = pattern(fg, bg, op);
  return svg(`0 0 ${W} ${H}`, `<defs><pattern id="arc" width="${p.w}" height="${p.h}" patternUnits="userSpaceOnUse">${p.inner}</pattern></defs><rect width="${W}" height="${H}" fill="url(#arc)"/>`);
}

fs.mkdirSync('../logos/svg', { recursive: true });
const out = {
  'amane-logo-principal-bordeaux.svg': primary(C.bx),
  'amane-logo-principal-pierre.svg': primary(C.pierre),
  'amane-logo-principal-or.svg': primary(C.or),
  'amane-logo-principal-noir.svg': primary(C.noir),
  'amane-logo-horizontal-bordeaux.svg': horizontal(C.bx),
  'amane-logo-horizontal-pierre.svg': horizontal(C.pierre),
  'amane-logotype-bordeaux.svg': wordmark(C.bx),
  'amane-logotype-pierre.svg': wordmark(C.pierre),
  'amane-monogramme-bordeaux.svg': mono(C.bx),
  'amane-monogramme-pierre.svg': mono(C.pierre),
  'amane-monogramme-or.svg': mono(C.or),
  'amane-monogramme-lie.svg': mono(C.lie),
  'amane-A-bordeaux.svg': monoA(C.bx),
  'amane-A-pierre.svg': monoA(C.pierre),
  'amane-A-or.svg': monoA(C.or),
  'amane-sceau-bordeaux.svg': seal(C.bx),
  'amane-sceau-or.svg': seal(C.or),
  'amane-sceau-pierre.svg': seal(C.pierre),
  'amane-motif-arcades-bordeaux.svg': patternSVG('#8E3043', C.bx, .9),
  'amane-motif-arcades-pierre.svg': patternSVG(C.bx, C.pierre, .45),
};
for (const [n, s] of Object.entries(out)) fs.writeFileSync('../logos/svg/' + n, s);
module.exports = { C };
console.log(Object.keys(out).length, 'fichiers');
