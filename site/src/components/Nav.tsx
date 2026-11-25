import { useEffect, useState } from 'react';
import { LANGS, LANG_META, type Dict, type Lang } from '../i18n';
import { MarkA } from '../brand';

export type Tone = 'dark' | 'bx' | 'page';

export function Nav({ d, lang, tone, fab }: { d: Dict; lang: Lang; tone: Tone; fab: { on: boolean; dark: boolean } }) {
  const [menu, setMenu] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('menu-open', menu);
    return () => document.body.classList.remove('menu-open');
  }, [menu]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(false);
        setLangOpen(false);
      }
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
    ['#questions', d.n4],
    ['#demande', d.cta],
  ];

  return (
    <>
      <header className={`nav ${menu ? 'solid' : tone === 'page' ? 'solid' : tone === 'dark' ? 'ondark' : 'onbx'}`}>
        <div className="in">
          <div className="side">
            <button className="menub" type="button" aria-expanded={menu} aria-controls="mmenu" onClick={() => setMenu(!menu)}>
              <i aria-hidden="true" />
              <span>{menu ? d.close : d.menu}</span>
            </button>
            <div className={`lang${langOpen ? ' open' : ''}`}>
              <button type="button" aria-haspopup="true" aria-expanded={langOpen} aria-label={d.langLabel} onClick={() => setLangOpen(!langOpen)}>
                <span>{LANG_META[lang].short}</span>
                <svg viewBox="0 0 10 6" fill="none" stroke="currentColor" aria-hidden="true"><path d="M1 1l4 4 4-4" /></svg>
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
            <a className="link ask" href="#demande" onClick={() => setMenu(false)}>{d.cta}</a>
          </div>
        </div>
      </header>

      <div className="mmenu" id="mmenu" data-lenis-prevent aria-hidden={!menu} inert={!menu}>
        <nav aria-label={d.menu}>
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMenu(false)}>{label}</a>
          ))}
        </nav>
        <div className="ml">
          {LANGS.map((l) => (
            <a key={l} href={LANG_META[l].path} hrefLang={l} lang={l} aria-current={l === lang ? 'true' : undefined}>{LANG_META[l].name}</a>
          ))}
        </div>
      </div>

      <a className={`btn fab${fab.on && !menu ? ' on' : ''}${fab.dark ? ' onbx' : ''}`} href="#demande" tabIndex={fab.on ? 0 : -1}>{d.cta}</a>
    </>
  );
}
