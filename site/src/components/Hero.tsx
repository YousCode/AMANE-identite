import { useEffect, useRef } from 'react';
import { SLOGAN, type Dict } from '../i18n';
import { Rich, Title, reducedMotion, useScrollFrame } from '../ui';
import { asset } from '../config';

const FRAMES = 48;
const frameUrl = (n: number) => asset(`frames/f_${String(n).padStart(3, '0')}.jpg`);

/** Les images de la porte, partagées entre le prologue et l'épilogue : téléchargées une seule fois. */
const frames: (HTMLImageElement | undefined)[] = [];
let requested = false;

function loadFrames() {
  if (requested || reducedMotion()) return;
  requested = true;
  // Sur petit écran, une image sur deux : moitié moins de données, même mouvement.
  const step = innerWidth < 761 ? 2 : 1;
  const list: number[] = [];
  for (let n = 1; n <= FRAMES; n += step) list.push(n);
  if (list[list.length - 1] !== FRAMES) list.push(FRAMES); // la porte grande ouverte, toujours
  let next = 0;
  const loadNext = () => {
    if (next >= list.length) return;
    const n = list[next++];
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      frames[n - 1] = img;
      loadNext();
    };
    img.onerror = loadNext;
    img.src = frameUrl(n);
  };
  const start = () => {
    for (let k = 0; k < 4; k++) loadNext();
  };
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
}

/** Dessine sur la toile l'image `index`, ou la plus proche déjà chargée en reculant. Renvoie l'image dessinée. */
function drawFrame(cv: HTMLCanvasElement, index: number, last: number) {
  let i = index;
  while (i > 0 && !frames[i]) i--;
  const img = frames[i];
  if (!img) return last;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.round(cv.clientWidth * dpr);
  const h = Math.round(cv.clientHeight * dpr);
  if (i === last && cv.width === w && cv.height === h) return last;
  if (cv.width !== w || cv.height !== h) {
    cv.width = w;
    cv.height = h;
  }
  const ctx = cv.getContext('2d');
  if (!ctx) return last;
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  ctx.drawImage(
    img,
    (w - img.naturalWidth * s) / 2,
    (h - img.naturalHeight * s) / 2,
    img.naturalWidth * s,
    img.naturalHeight * s,
  );
  cv.style.opacity = '1';
  return i;
}

const clamp = (x: number) => Math.min(1, Math.max(0, x));
/** Avancement du défilement dans une section épinglée, de 0 à 1 ; null si elle est hors de l'écran. */
function progress(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return null;
  return clamp(-r.top / Math.max(1, el.offsetHeight - innerHeight));
}

function fade(el: HTMLElement | null, visible: number, shift: number) {
  if (!el) return;
  el.style.opacity = String(visible);
  el.style.transform = `translate3d(0,${shift}px,0)`;
  // Invisible = hors de l'ordre de tabulation.
  el.style.visibility = visible <= 0 ? 'hidden' : '';
}

/**
 * Prologue : « Arrive as a Guest. » La porte cochère s'ouvre au défilement, la caméra avance,
 * puis la lumière du hall devient le papier de la page.
 */
export function Hero({ d }: { d: Dict }) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const drawn = useRef(-1);

  useEffect(loadFrames, []);

  useScrollFrame(() => {
    const el = section.current;
    const cv = canvas.current;
    if (!el || !cv || reducedMotion()) return;
    const p = progress(el);
    if (p === null) return;
    const text = clamp((p - 0.22) / 0.28); // le texte s'efface
    const out = clamp((p - 0.84) / 0.16); // on franchit le seuil
    el.style.setProperty('--open', p.toFixed(3));
    el.style.setProperty('--out', out.toFixed(3));
    // Passé le seuil, la barre de navigation se lit sur fond clair.
    el.dataset.tone = out > 0.55 ? 'page' : 'dark';
    fade(copy.current, 1 - text, -text * 40);
    drawn.current = drawFrame(cv, Math.round(clamp(p / 0.92) * (FRAMES - 1)), drawn.current);
  });

  return (
    <section className="hero" id="haut" data-tone="dark" ref={section} aria-labelledby="h1">
      <div className="pin">
        <img
          className="door"
          src={frameUrl(1)}
          alt={d.doorAlt}
          width={1280}
          height={726}
          fetchPriority="high"
          decoding="async"
        />
        <canvas className="door" ref={canvas} aria-hidden="true" />
        <div className="copy" ref={copy}>
          <p className="k">{d.hk}</p>
          <Title as="p" className="devise" lang="en" html={SLOGAN[0]} />
          <Title as="h1" id="h1" html={d.h1} />
          <a className="btn onbx rv" href="#demande">
            {d.cta}
          </a>
        </div>
        <span className="hint" aria-hidden="true" />
        <span className="seuil" aria-hidden="true" />
      </div>
    </section>
  );
}

/**
 * Épilogue : « Leave with a Story. » Les mêmes images, à rebours : on quitte le papier,
 * la porte se referme, et la devise s'achève.
 */
export function Epilogue({ d }: { d: Dict }) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const drawn = useRef(-1);

  useEffect(loadFrames, []);

  useScrollFrame(() => {
    const el = section.current;
    const cv = canvas.current;
    if (!el || !cv || reducedMotion()) return;
    const p = progress(el);
    if (p === null) return;
    const veil = 1 - clamp(p / 0.16); // le papier se dissipe
    const closed = clamp((p - 0.08) / 0.68); // la porte se referme
    const text = clamp((p - 0.6) / 0.24); // la devise apparaît
    el.style.setProperty('--open', (1 - closed).toFixed(3));
    el.style.setProperty('--out', veil.toFixed(3));
    el.dataset.tone = veil > 0.55 ? 'page' : 'dark';
    fade(copy.current, text, (1 - text) * 30);
    drawn.current = drawFrame(cv, Math.round((1 - closed) * (FRAMES - 1)), drawn.current);
  });

  return (
    <section className="hero epilogue" id="epilogue" data-tone="dark" ref={section} aria-labelledby="ep-t">
      <div className="pin">
        <img className="door" src={frameUrl(1)} alt="" width={1280} height={726} loading="lazy" decoding="async" />
        <canvas className="door" ref={canvas} aria-hidden="true" />
        <div className="copy" ref={copy}>
          <p className="k">{d.epK}</p>
          <Title as="h2" id="ep-t" className="devise" lang="en" html={SLOGAN[1]} />
          <p className="suite">
            <Rich html={d.epT} />
          </p>
          <a className="btn onbx" href="#demande">
            {d.cta}
          </a>
        </div>
        <span className="seuil" aria-hidden="true" />
      </div>
    </section>
  );
}
