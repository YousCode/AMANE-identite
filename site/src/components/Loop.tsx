import { useEffect, useRef } from 'react';
import { reducedMotion } from '../ui';
import { asset } from '../config';
import DEUX_K from '../films-2k.json';

/**
 * Boucle vidéo muette, chargée à la demande : l'affiche arrive à deux écrans de distance,
 * le téléchargement de la vidéo commence à un écran, et la lecture ne tourne que
 * lorsque la section est visible. Loin de l'écran, la vidéo est déchargée.
 *
 * Sur grand écran (au moins 2300 pixels réels de large), les films qui en ont une reçoivent leur
 * version 1440p (`<nom>-2k.webm`, liste dans src/films-2k.json, écrite par scripts/encoder-films.sh),
 * sauf si le visiteur a demandé à économiser ses données.
 */
const grandEcran = () =>
  innerWidth * Math.min(devicePixelRatio || 1, 2) >= 2300 &&
  !(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

export function Loop({ name, portrait = '' }: { name: string; portrait?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // React n'écrit pas l'attribut muted dans le HTML pré-rendu : sans lui, la lecture automatique est refusée.
    v.muted = true;
    v.defaultMuted = true;
    const still = reducedMotion();
    const canWebm = v.canPlayType('video/webm; codecs="vp9"') !== '';
    const pick = () => (portrait && innerWidth < 761 && innerHeight > innerWidth ? portrait : name);
    let loaded = '';
    let shown = false;
    // Dans une scène, le film attend sur sa première image qu'elle soit entièrement visible
    // (classe « montre », src/scenes.ts) : c'est celle sur laquelle le passage s'est arrêté.
    const scene = v.closest('.scene');
    let montre = !scene || scene.classList.contains('montre');
    // Lecture seulement si la vidéo est chargée, visible, et l'onglet au premier plan.
    const sync = () => {
      if (loaded && shown && montre && !document.hidden) v.play().catch(() => {});
      else v.pause();
    };
    const classes = new MutationObserver(() => {
      const now = scene!.classList.contains('montre');
      if (now === montre) return;
      montre = now;
      // Qu'elle apparaisse ou s'efface, la scène se retrouve sur sa première image.
      if (!still && v.readyState > 0) v.currentTime = 0;
      sync();
    });
    if (scene) classes.observe(scene, { attributes: true, attributeFilter: ['class'] });

    const poster = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        v.poster = asset(`img/${pick()}-poster.jpg`);
        poster.disconnect();
      },
      { rootMargin: '200% 0px' },
    );
    const near = new IntersectionObserver(
      ([e]) => {
        if (still) return;
        if (e.isIntersecting) {
          const n = pick();
          if (loaded === n) return;
          loaded = n;
          const grand = canWebm && (DEUX_K as string[]).includes(n) && grandEcran();
          // Repli en cascade : 1440p → 1080p WebM → MP4.
          v.onerror = () => {
            if (!canWebm || loaded !== n || v.src.endsWith('.mp4')) return;
            v.src = asset(v.src.endsWith('-2k.webm') ? `video/${n}.webm` : `video/${n}.mp4`);
            sync();
          };
          v.preload = 'auto'; // à un écran de distance, on commence à télécharger
          v.src = asset(`video/${n}${grand ? '-2k' : ''}.${canWebm ? 'webm' : 'mp4'}`);
          sync();
        } else if (loaded) {
          loaded = '';
          v.pause();
          v.removeAttribute('src');
          v.load();
        }
      },
      { rootMargin: '100% 0px' },
    );
    const visible = new IntersectionObserver(
      ([e]) => {
        if (still) return;
        shown = e.isIntersecting;
        sync();
      },
      { threshold: 0.1 },
    );
    const onHide = () => {
      if (!still) sync();
    };
    document.addEventListener('visibilitychange', onHide);
    [poster, near, visible].forEach((o) => o.observe(v));
    return () => {
      [poster, near, visible, classes].forEach((o) => o.disconnect());
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [name, portrait]);

  return <video ref={ref} muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} />;
}
