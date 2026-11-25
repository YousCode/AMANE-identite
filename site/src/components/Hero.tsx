import { useEffect, useRef } from 'react';
import type { Dict } from '../i18n';
import { Title, reducedMotion, useScrollFrame } from '../ui';

const FRAMES = 48;
const frameUrl = (n: number) => `/frames/f_${String(n).padStart(3, '0')}.jpg`;

/**
 * Ouverture : la porte cochère s'ouvre au défilement (48 images dessinées sur une toile).
 * La première image est une balise <img> ordinaire : c'est elle que le navigateur peint en premier.
 */
export function Hero({ d }: { d: Dict }) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const frames = useRef<(HTMLImageElement | undefined)[]>([]);
  const drawn = useRef(-1);
  const still = useRef(false);

  useEffect(() => {
    still.current = reducedMotion();
    if (still.current) return;
    // Sur petit écran, une image sur deux : moitié moins de données, même mouvement.
    const step = innerWidth < 761 ? 2 : 1;
    const list: number[] = [];
    for (let n = 1; n <= FRAMES; n += step) list.push(n);
    let cancelled = false;
    let next = 0;
    const loadNext = () => {
      if (cancelled || next >= list.length) return;
      const n = list[next++];
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        frames.current[n - 1] = img;
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
    return () => {
      cancelled = true;
      removeEventListener('load', start);
    };
  }, []);

  useScrollFrame(() => {
    const el = section.current;
    const cv = canvas.current;
    if (!el || !cv || still.current) return;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0) return;
    const p = Math.min(1, Math.max(0, -r.top / Math.max(1, el.offsetHeight - innerHeight)));

    if (copy.current) {
      const fade = Math.min(1, Math.max(0, (p - 0.28) / 0.3));
      copy.current.style.opacity = String(1 - fade);
      copy.current.style.transform = `translate3d(0,${-fade * 40}px,0)`;
      copy.current.style.pointerEvents = fade > 0.9 ? 'none' : '';
    }

    // Image la plus proche déjà chargée, en reculant si la cible n'est pas encore là.
    let i = Math.round(Math.min(1, p / 0.92) * (FRAMES - 1));
    while (i > 0 && !frames.current[i]) i--;
    const img = frames.current[i];
    if (!img) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(cv.clientWidth * dpr);
    const h = Math.round(cv.clientHeight * dpr);
    if (i === drawn.current && cv.width === w && cv.height === h) return;
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    drawn.current = i;
    cv.style.opacity = '1';
  });

  return (
    <section className="hero" id="haut" data-tone="dark" ref={section} aria-labelledby="h1">
      <div className="pin">
        <img className="door" src={frameUrl(1)} alt={d.doorAlt} width={1280} height={726} fetchPriority="high" decoding="async" />
        <canvas className="door" ref={canvas} aria-hidden="true" />
        <div className="copy" ref={copy}>
          <p className="k">{d.hk}</p>
          <Title as="h1" id="h1" html={d.h1} />
          <p className="sub rv">{d.hs}</p>
          <a className="btn onbx rv" href="#demande">{d.cta}</a>
        </div>
        <span className="hint" aria-hidden="true" />
      </div>
    </section>
  );
}
