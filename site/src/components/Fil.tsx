import { useEffect, useRef, useState } from 'react';
import { CHAPTERS, numerals, type Dict, type Lang } from '../i18n';
import { useScrollFrame } from '../ui';

type Step = { id: string; mark: string; label: string };

/**
 * Le fil du récit : une colonne discrète, à droite, sur grand écran. Prologue, chapitres, épilogue :
 * on voit où l'on en est, ce qui vient ensuite, et l'on peut y aller d'un clic.
 */
export function Fil({ d, lang }: { d: Dict; lang: Lang }) {
  const num = numerals(lang);
  const steps: Step[] = [
    { id: 'haut', mark: '·', label: d.prologue },
    ...CHAPTERS.map((c, i) => ({ id: `chapitre-${c.id}`, mark: num[i], label: d.chapters[i][0] })),
    { id: 'epilogue', mark: '·', label: d.epK },
  ];
  const [active, setActive] = useState(0);
  const [light, setLight] = useState(false);
  const [shown, setShown] = useState(false);
  const targets = useRef<HTMLElement[]>([]);
  const toned = useRef<HTMLElement[]>([]);

  useEffect(() => {
    targets.current = steps.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => !!el);
    toned.current = [...document.querySelectorAll<HTMLElement>('[data-tone]')];
    // Les sections ne changent pas : une seule lecture au montage suffit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useScrollFrame(() => {
    const mid = innerHeight / 2;
    let current = 0;
    targets.current.forEach((el, i) => {
      if (el.getBoundingClientRect().top <= mid) current = i;
    });
    let tone = 'page';
    for (const s of toned.current) {
      const r = s.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) tone = s.dataset.tone ?? 'page';
    }
    const demande = document.getElementById('demande')?.getBoundingClientRect().top ?? Infinity;
    const visible = scrollY > innerHeight * 0.8 && demande > mid;
    setActive((p) => (p === current ? p : current));
    setLight((p) => (p === (tone === 'page') ? p : tone === 'page'));
    setShown((p) => (p === visible ? p : visible));
  });

  return (
    <nav className={`fil${light ? ' clair' : ''}${shown ? ' on' : ''}`} aria-label={d.recit}>
      <ol>
        {steps.map((s, i) => (
          <li key={s.id}>
            <a href={`#${s.id}`} aria-current={i === active ? 'step' : undefined}>
              <b aria-hidden="true">{s.mark}</b>
              <span>{s.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
