import { createElement, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

/**
 * Titre composé mot à mot : chaque mot monte à l'entrée dans l'écran.
 * Le texte vient du dictionnaire et peut contenir une emphase <em>…</em>.
 */
export function Title({
  as = 'h2',
  html,
  id,
  className = '',
}: {
  as?: 'h1' | 'h2' | 'h3';
  html: string;
  id?: string;
  className?: string;
}) {
  let i = 0;
  const words = (text: string, key: string): ReactNode[] =>
    text
      .split(/([ \n\t]+)/)
      .filter(Boolean)
      .map((p, k) =>
        /^[ \n\t]+$/.test(p) ? (
          ' '
        ) : (
          <span className="w" key={key + k}>
            <span className="c" style={{ '--i': i++ } as CSSProperties}>
              {p}
            </span>
          </span>
        ),
      );
  const parts = html.split(/(<em>.*?<\/em>)/).filter(Boolean);
  return createElement(
    as,
    { id, className: `split rv ${className}`.trim() },
    parts.map((part, k) => {
      const m = /^<em>(.*)<\/em>$/.exec(part);
      return m ? <em key={k}>{words(m[1], 'e' + k)}</em> : words(part, 'p' + k);
    }),
  );
}

type FrameFn = () => void;
const subs = new Set<FrameFn>();
let ticking = false;
function tick() {
  ticking = false;
  subs.forEach((f) => f());
}
function request() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(tick);
}

/** Un seul écouteur de défilement pour toute la page ; chaque abonné est appelé au plus une fois par image. */
export function useScrollFrame(fn: FrameFn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const f = () => ref.current();
    if (subs.size === 0) {
      addEventListener('scroll', request, { passive: true });
      addEventListener('resize', request);
    }
    subs.add(f);
    f();
    return () => {
      subs.delete(f);
      if (subs.size === 0) {
        removeEventListener('scroll', request);
        removeEventListener('resize', request);
      }
    };
  }, []);
}

export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = () =>
  typeof matchMedia === 'function' && matchMedia('(hover:hover) and (pointer:fine)').matches;
