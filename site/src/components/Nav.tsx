import { useEffect, useRef, useState } from 'react';
import { LANGS, LANG_META, type Dict, type Lang } from '../i18n';
import { MarkA } from '../brand';
import { smooth, useScrollFrame } from '../ui';

type Tone = 'dark' | 'bx' | 'page';

/**
 * Barre de navigation, menu plein écran et bouton flottant.
 * Le ton (clair sur image, bordeaux sur papier) suit la section qui passe sous la barre ;
 * il est calculé ici pour ne re-rendre que la navigation, pas la page.
 */
export function Nav({ d, lang }: { d: Dict; lang: Lang }) {
  const [menu, setMenu] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [tone, setTone] = useState<Tone>('dark');
  const [fab, setFab] = useState({ on: false, dark: false });
  const burger = useRef<HTMLButtonElement>(null);
  const toned = useRef<HTMLElement[]>([]);
  const wasOpen = useRef(false);

  useEffect(() => {
    toned.current = [...document.querySelectorAll<HTMLElement>('[data-tone]')];
  }, []);

  useScrollFrame(() => {
    const top = 34;
    const bottom = innerHeight - 40;
    let atTop: Tone = 'page';
    let atBottom: Tone = 'page';
    for (const s of toned.current) {
      const r = s.getBoundingClientRect();
      if (r.top <= top && r.bottom > top) atTop = s.dataset.tone as Tone;
      if (r.top <= bottom && r.bottom > bottom) atBottom = s.dataset.tone as Tone;
    }
    setTone((prev) => (prev === atTop ? prev : atTop));
    const demande = document.getElementById('demande')?.getBoundingClientRect();
    const on = scrollY > innerHeight * 0.9 && !!demande && demande.top > innerHeight * 0.85;
    const dark = atBottom !== 'page';
    setFab((prev) => (prev.on === on && prev.dark === dark ? prev : { on, dark }));
  });

  // Menu ouvert : la page derrière ne défile plus et sort de l'ordre de tabulation.
  useEffect(() => {
    document.documentElement.classList.toggle('menu-open', menu);
    for (const el of document.querySelectorAll('main, footer')) el.toggleAttribute('inert', menu);
    if (menu) smooth.lenis?.stop();
    else smooth.lenis?.start();
    if (wasOpen.current && !menu) burger.current?.focus();
    wasOpen.current = menu;
  }, [menu]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenu(false);
      setLangOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.lang')) setLangOpen(false);
    };
    addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, []);

  const links: [string, string][] = [
    ['#maison', d.mk],
    ['#services', d.n1],
    ['#rituel', d.n2],
    ['#flotte', d.n3],
    ['#jeu', d.jk],
    ['#questions', d.n4],
    ['#demande', d.cta],
  ];
  const state = menu || tone === 'page' ? 'solid' : tone === 'dark' ? 'ondark' : 'onbx';
  const fabOn = fab.on && !menu;

  return (
    <>
      <header className={`nav ${state}`}>
        <div className="in">
          <div className="side">
            <button
              className="menub"
              type="button"
              ref={burger}
              aria-expanded={menu}
              aria-controls="mmenu"
              onClick={() => setMenu(!menu)}
            >
              <i aria-hidden="true" />
              <span>{menu ? d.close : d.menu}</span>
            </button>
            <div className={`lang${langOpen ? ' open' : ''}`}>
              <button
                type="button"
                aria-expanded={langOpen}
                aria-label={`${d.langLabel} : ${LANG_META[lang].name}`}
                onClick={() => setLangOpen(!langOpen)}
              >
                <span>{LANG_META[lang].short}</span>
                <svg viewBox="0 0 10 6" fill="none" stroke="currentColor" aria-hidden="true">
                  <path d="M1 1l4 4 4-4" />
                </svg>
              </button>
              <ul>
                {LANGS.map((l) => (
                  <li key={l}>
                    <a href={LANG_META[l].path} hrefLang={l} lang={l} aria-current={l === lang ? 'true' : undefined}>
                      {LANG_META[l].name}
                      <small>{LANG_META[l].short}</small>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <a className="mark" href="#haut" aria-label="Amane" onClick={() => setMenu(false)}>
            <MarkA />
          </a>
          <div className="side e">
            <a className="link ask" href="#demande" onClick={() => setMenu(false)}>
              {d.cta}
            </a>
          </div>
        </div>
      </header>

      <div className="mmenu" id="mmenu" data-lenis-prevent aria-hidden={!menu} inert={!menu}>
        <nav aria-label={d.menu}>
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMenu(false)}>
              {label}
            </a>
          ))}
        </nav>
        <div className="ml">
          {LANGS.map((l) => (
            <a key={l} href={LANG_META[l].path} hrefLang={l} lang={l} aria-current={l === lang ? 'true' : undefined}>
              {LANG_META[l].name}
            </a>
          ))}
        </div>
      </div>

      <a className={`btn fab${fabOn ? ' on' : ''}${fab.dark ? ' onbx' : ''}`} href="#demande" tabIndex={fabOn ? 0 : -1}>
        {d.cta}
      </a>
    </>
  );
}
