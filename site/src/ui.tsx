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
  lang,
}: {
  as?: 'h1' | 'h2' | 'h3' | 'p';
  html: string;
  id?: string;
  className?: string;
  lang?: string;
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
    { id, lang, className: `split rv ${className}`.trim() },
    parts.map((part, k) => {
      const m = /^<em>(.*)<\/em>$/.exec(part);
      return m ? <em key={k}>{words(m[1], 'e' + k)}</em> : words(part, 'p' + k);
    }),
  );
}

/** Texte du dictionnaire avec emphase <em>…</em>, rendu sans découpage. */
export function Rich({ html }: { html: string }) {
  return html
    .split(/(<em>.*?<\/em>)/)
    .filter(Boolean)
    .map((part, k) => {
      const m = /^<em>(.*)<\/em>$/.exec(part);
      return m ? <em key={k}>{m[1]}</em> : part;
    });
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

/** Défilement doux (Lenis), partagé pour pouvoir le suspendre quand le menu couvre la page. */
export const smooth: { lenis: { stop(): void; start(): void; destroy(): void } | null } = { lenis: null };

export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = () =>
  typeof matchMedia === 'function' && matchMedia('(hover:hover) and (pointer:fine)').matches;
