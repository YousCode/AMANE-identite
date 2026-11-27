import { useEffect, useRef } from 'react';
import { APERCU, asset } from './config';
import { reducedMotion, useScrollFrame } from './ui';

/**
 * Les passages : de courts plans de caméra qui relient un film au suivant, joués au rythme du défilement.
 *
 * Chaque passage est livré en 40 images réunies dans un seul fichier (scripts/passages.sh) :
 * `public/passages/pNN-d.bin` en 16:9, `pNN-m.bin` recadré en 9:16 pour les écrans en hauteur.
 * Entre deux images, la suivante est fondue par-dessus la précédente, au prorata : aucun à-coup,
 * quelle que soit la vitesse du défilement.
 *
 *  <canvas class="passage" data-passage="p03" data-mode="chapitre">
 *    chapitre  le passage occupe l'arrivée du chapitre ; son titre se lit ensuite sur la dernière image, immobile
 *    entree    le passage occupe l'arrivée du film ; la vidéo prend le relais une fois la scène en place
 *
 * Tant que les images ne sont pas là, ou avec « réduire les animations », la toile reste
 * transparente : l'affiche posée derrière (data-poster) ou la vidéo du film tient lieu d'image.
 */
export const PASSAGE_FRAMES = 40;

type Item = {
  cv: HTMLCanvasElement;
  scene: HTMLElement;
  mode: 'chapitre' | 'entree';
  imgs: (HTMLImageElement | undefined)[];
  requested: boolean;
  abort?: AbortController;
  /** Change à chaque déchargement : les téléchargements en cours d'un tour précédent s'arrêtent. */
  turn: number;
  drawn: string;
};

const clamp = (x: number) => Math.min(1, Math.max(0, x));

/** Découpe le fichier d'un passage en adresses d'images (format décrit dans scripts/paquet-passage.mjs). */
function split(buf: ArrayBuffer) {
  const view = new DataView(buf);
  const count = view.getUint32(0, true);
  let at = 4 + 4 * count;
  return Array.from({ length: count }, (_, k) => {
    const length = view.getUint32(4 + 4 * k, true);
    const url = URL.createObjectURL(new Blob([buf.slice(at, at + length)], { type: 'image/webp' }));
    at += length;
    return url;
  });
}

/**
 * Télécharge le fichier du passage et en sort les images.
 * L'aperçu autonome ne peut héberger que du texte et des médias courants : scripts/apercu.mjs y dépose
 * les mêmes images en JSON (une liste d'images en base64), lues ici telles quelles.
 */
function load(it: Item) {
  if (it.requested) return;
  it.requested = true;
  const size = innerHeight > innerWidth ? 'm' : 'd';
  const turn = it.turn;
  it.abort = new AbortController();
  fetch(asset(`passages/${it.cv.dataset.passage}-${size}.${APERCU ? 'json' : 'bin'}`), { signal: it.abort.signal })
    .then((r) => (r.ok ? r : Promise.reject(new Error(String(r.status)))))
    .then((r): Promise<string[]> =>
      APERCU
        ? r.json().then((list: string[]) => list.map((b64) => `data:image/webp;base64,${b64}`))
        : r.arrayBuffer().then(split),
    )
    .then((urls) => {
      urls.slice(0, PASSAGE_FRAMES).forEach((url, k) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          URL.revokeObjectURL(url);
          if (turn !== it.turn) return;
          it.imgs[k] = img;
          it.drawn = '';
        };
        img.onerror = () => URL.revokeObjectURL(url);
        img.src = url;
      });
    })
    .catch(() => {
      // Pas de passage : l'affiche ou la vidéo reste à l'écran. Nouvel essai quand la scène reviendra à portée.
      if (turn === it.turn) it.requested = false;
    });
}

/** Loin de l'écran, les images sont rendues : la mémoire d'un téléphone ne tient pas douze passages décodés. */
function unload(it: Item) {
  if (!it.requested) return;
  it.turn++;
  it.abort?.abort();
  it.requested = false;
  it.imgs = [];
  it.drawn = '';
  it.cv.width = it.cv.height = 0;
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, alpha: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  ctx.globalAlpha = alpha;
  ctx.drawImage(
    img,
    (w - img.naturalWidth * s) / 2,
    (h - img.naturalHeight * s) / 2,
    img.naturalWidth * s,
    img.naturalHeight * s,
  );
}

function draw(it: Item, p: number) {
  const f = p * (PASSAGE_FRAMES - 1);
  // L'image chargée la plus proche avant, et la plus proche après.
  let a = Math.floor(f);
  while (a > 0 && !it.imgs[a]) a--;
  let b = Math.ceil(f);
  while (b < PASSAGE_FRAMES - 1 && !it.imgs[b]) b++;
  const A = it.imgs[a];
  const B = it.imgs[b];
  if (!A) return;
  const t = B && b > a ? (f - a) / (b - a) : 0;

  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const w = Math.round(it.cv.clientWidth * dpr);
  const h = Math.round(it.cv.clientHeight * dpr);
  const key = `${a} ${b} ${t.toFixed(3)} ${w} ${h}`;
  if (key === it.drawn) return;
  it.drawn = key;
  if (it.cv.width !== w || it.cv.height !== h) {
    it.cv.width = w;
    it.cv.height = h;
  }
  const ctx = it.cv.getContext('2d');
  if (!ctx) return;
  cover(ctx, A, w, h, 1);
  if (B && t > 0.002) cover(ctx, B, w, h, t);
  ctx.globalAlpha = 1;
}

export function usePassages() {
  const ref = useRef<Item[]>([]);

  useEffect(() => {
    const items: Item[] = (ref.current = []);
    const still = reducedMotion();
    document.querySelectorAll<HTMLCanvasElement>('canvas.passage').forEach((cv) => {
      const scene = cv.closest<HTMLElement>('.scene');
      if (!scene) return;
      items.push({
        cv,
        scene,
        mode: cv.dataset.mode === 'entree' ? 'entree' : 'chapitre',
        imgs: [],
        requested: false,
        turn: 0,
        drawn: '',
      });
    });
    // À deux écrans de distance : l'affiche de fond et les images du passage. Au-delà, elles sont rendues.
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          const it = items.find((x) => x.scene === e.target);
          if (!it) return;
          if (!e.isIntersecting) return unload(it);
          const pin = it.scene.querySelector<HTMLElement>('[data-poster]');
          if (pin && !pin.style.backgroundImage) pin.style.backgroundImage = `url(${asset(pin.dataset.poster!)})`;
          if (!still) load(it);
        }),
      { rootMargin: '200% 0px' },
    );
    items.forEach((it) => io.observe(it.scene));
    return () => io.disconnect();
  }, []);

  useScrollFrame(() => {
    if (reducedMotion()) return;
    const vh = innerHeight;
    for (const it of ref.current) {
      if (!it.requested) continue;
      const r = it.scene.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) continue;
      const enter = clamp(1 - r.top / vh);
      // Chapitre : le plan avance pendant l'arrivée, puis s'arrête sur la première image du film
      // suivant. Le titre se lit sur cette image immobile ; le film prend ensuite le relais sans fantôme.
      const p = it.mode === 'chapitre' ? clamp(enter / 0.95) : clamp(enter / 0.92);
      draw(it, p);
    }
  });
}
