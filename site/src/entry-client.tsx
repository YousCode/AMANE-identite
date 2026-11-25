import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { APERCU } from './config';
import { LANGS, LANG_META, langFromPath, type Lang } from './i18n';
import './styles.css';

// Signale au script en ligne de index.html que l'application a démarré.
document.documentElement.classList.add('charge');

const el = document.getElementById('root')!;
const app = (lang: Lang) => (
  <StrictMode>
    <App lang={lang} key={lang} />
  </StrictMode>
);
const setHtml = (lang: Lang) => {
  document.documentElement.lang = lang;
  document.documentElement.dir = LANG_META[lang].dir;
};

if (el.firstElementChild) {
  hydrateRoot(el, app(langFromPath(location.pathname)));
} else {
  // Développement et aperçu autonome : pas de pré-rendu.
  const first = APERCU ? 'fr' : langFromPath(location.pathname);
  const root = createRoot(el);
  setHtml(first);
  root.render(app(first));
  if (APERCU) {
    // Dans l'aperçu il n'y a qu'une page : les liens de langue changent le texte sur place.
    document.addEventListener('click', (e) => {
      const a = (e.target as Element).closest<HTMLAnchorElement>('a[hreflang]');
      const lang = a?.hreflang as Lang | undefined;
      if (!a || !lang || !(LANGS as readonly string[]).includes(lang)) return;
      e.preventDefault();
      setHtml(lang);
      root.render(app(lang));
      scrollTo(0, 0);
    });
  }
}
