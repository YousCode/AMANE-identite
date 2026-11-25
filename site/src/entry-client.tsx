import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { LANG_META, langFromPath } from './i18n';
import './styles.css';

const lang = langFromPath(location.pathname);
const root = document.getElementById('root')!;
const app = (
  <StrictMode>
    <App lang={lang} />
  </StrictMode>
);

if (root.firstElementChild) {
  hydrateRoot(root, app);
} else {
  // Développement : pas de pré-rendu, la langue vient de l'adresse.
  document.documentElement.lang = lang;
  document.documentElement.dir = LANG_META[lang].dir;
  createRoot(root).render(app);
}
