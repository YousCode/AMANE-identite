import { useEffect } from 'react';
import { MonogrammeTrace } from '../brand';
import { reducedMotion } from '../ui';

const MIN_MS = 1700; // le temps que le monogramme finisse de se tracer
const MAX_MS = 4000; // au-delà, on ouvre quoi qu'il arrive

const SEEN = 'amane-vu'; // lu aussi par le script en ligne de index.html

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Chargement : le monogramme se trace sur deux vantaux bordeaux, qui s'écartent
 * quand la première image de la porte et les polices sont prêtes.
 * L'ouverture est déclenchée par la classe « pret » sur <html> ; tout le mouvement est en CSS.
 */
export function Rideau() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.classList.contains('pret')) return;
    const open = () => {
      root.classList.add('pret');
      try {
        sessionStorage.setItem(SEEN, '1'); // les pages suivantes s'ouvrent sans rideau
      } catch {
        /* stockage indisponible : le rideau rejouera, sans gravité */
      }
    };
    if (reducedMotion()) return open();

    const img = document.querySelector<HTMLImageElement>('.hero img.door');
    const image =
      img && !img.complete
        ? new Promise<void>((r) => {
            img.addEventListener('load', () => r(), { once: true });
            img.addEventListener('error', () => r(), { once: true });
          })
        : Promise.resolve();
    const fonts = document.fonts ? document.fonts.ready.then(() => {}) : Promise.resolve();
    Promise.race([Promise.all([wait(MIN_MS), image, fonts]), wait(MAX_MS)]).then(open);
  }, []);

  return (
    <div className="rideau" aria-hidden="true">
      <i className="vantail g" />
      <i className="vantail d" />
      <MonogrammeTrace />
    </div>
  );
}
