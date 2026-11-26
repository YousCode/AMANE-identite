import { useEffect, useRef } from 'react';
import { asset } from './config';
import { reducedMotion, useScrollFrame } from './ui';

/**
 * Les passages : de courts plans de caméra qui relient un film au suivant, joués au rythme du défilement.
 *
 * Chaque passage est livré en images fixes (public/passages/pNN/), `d-00.webp` à `d-39.webp` en 16:9
 * et `m-00.webp` à `m-39.webp` recadrées en 9:16 pour les écrans en hauteur (scripts/passages.sh).
 * Les images arrivent par passes de plus en plus fines (une sur huit, puis une sur quatre…) : le
 * mouvement est lisible dès les premières, puis s'affine. Entre deux images, la suivante est fondue
 * par-dessus la précédente, au prorata : aucun à-coup, quelle que soit la vitesse du défilement.
 *
 *  <canvas class="passage" data-passage="p03" data-mode="chapitre">
 *    chapitre  le passage court sur toute l'ouverture du chapitre (arrivée, puis recouvrement)
 *    entree    le passage occupe l'arrivée du film ; la vidéo prend le relais une fois la scène en place
 *
 * Tant que les premières images ne sont pas là, ou avec « réduire les animations », la toile reste
 * transparente et l'affiche posée derrière (data-poster) tient lieu d'image.
 */
export const PASSAGE_FRAMES = 40;
const PASSES = [8, 4, 2, 1];

type Item = {
  cv: HTMLCanvasElement;
  scene: HTMLElement;
  mode: 'chapitre' | 'entree';
  imgs: (HTMLImageElement | undefined)[];
  requested: boolean;
  /** Change à chaque déchargement : les téléchargements en cours d'un tour précédent s'arrêtent. */
  turn: number;
  drawn: string;
};

const clamp = (x: number) => Math.min(1, Math.max(0, x));

function load(it: Item) {
  if (it.requested) return;
  it.requested = true;
  const size = innerHeight > innerWidth ? 'm' : 'd';
  const id = it.cv.dataset.passage;
  const order: number[] = [];
  for (const step of PASSES) for (let k = 0; k < PASSAGE_FRAMES; k += step) if (!order.includes(k)) order.push(k);
  if (!order.includes(PASSAGE_FRAMES - 1)) order.splice(1, 0, PASSAGE_FRAMES - 1); // l'arrivée, tôt
  let next = 0;
  const turn = it.turn;
  const loadNext = () => {
    if (next >= order.length || turn !== it.turn) return;
    const k = order[next++];
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (turn !== it.turn) return;
      it.imgs[k] = img;
      it.drawn = '';
      loadNext();
    };
    img.onerror = loadNext;
    img.src = asset(`passages/${id}/${size}-${String(k).padStart(2, '0')}.webp`);
  };
  for (let n = 0; n < 3; n++) loadNext();
}

/** Loin de l'écran, les images sont rendues : la mémoire d'un téléphone ne tient pas douze passages décodés. */
function unload(it: Item) {
  if (!it.requested) return;
  it.turn++;
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
      const leave = clamp(-r.top / (r.height / 2));
      // Chapitre : le plan avance pendant l'arrivée et le début du recouvrement, puis s'arrête
      // sur la première image du film suivant, qui se fond par-dessus.
      const p = it.mode === 'chapitre' ? clamp((enter + leave) / 1.6) : clamp(enter / 0.92);
      draw(it, p);
    }
  });
}
