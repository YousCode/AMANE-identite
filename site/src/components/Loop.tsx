import { useEffect, useRef } from 'react';
import { reducedMotion } from '../ui';

/**
 * Boucle vidéo muette. Rien n'est téléchargé tant que la section est loin :
 * l'affiche arrive à deux écrans de distance, la vidéo à un écran, et la lecture
 * ne tourne que lorsque la section est visible.
 */
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

    const poster = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        v.poster = `/img/${pick()}-poster.jpg`;
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
          v.onerror = () => {
            if (canWebm && loaded === n && !v.src.endsWith('.mp4')) v.src = `/video/${n}.mp4`;
          };
          v.src = `/video/${n}.${canWebm ? 'webm' : 'mp4'}`;
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
        if (still || !loaded) return;
        if (e.isIntersecting && !document.hidden) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.1 },
    );
    const onHide = () => {
      if (document.hidden) v.pause();
    };
    document.addEventListener('visibilitychange', onHide);
    [poster, near, visible].forEach((o) => o.observe(v));
    return () => {
      [poster, near, visible].forEach((o) => o.disconnect());
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [name, portrait]);

  return <video ref={ref} muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} />;
}
