import { useEffect, useRef } from 'react';
import { reducedMotion, useScrollFrame } from './ui';

const clamp = (x: number, min = 0, max = 1) => Math.min(max, Math.max(min, x));

type Item = { el: HTMLElement; scene: boolean; last: string };

/**
 * Le défilement mis en scène. À chaque image, trois valeurs sont écrites en variables CSS ;
 * tout le mouvement lui-même est décrit dans styles.css.
 *
 *  .scene        --enter  0 (encore sous l'écran) → 1 (épinglée en haut)
 *                --leave  0 (épinglée) → 1 (entièrement recouverte par la scène suivante)
 *  [data-drift]  --drift  −1 (entre par le bas) → 0 (au centre) → 1 (sort par le haut)
 *  <html>        --page   avancement dans la page, de 0 à 1
 *
 * Les mesures sont toutes lues avant la première écriture, pour ne pas forcer de recalcul de mise en page.
 */
export function useScenes() {
  const items = useRef<Item[]>([]);
  const page = useRef('');

  useEffect(() => {
    items.current = [...document.querySelectorAll<HTMLElement>('.scene, [data-drift]')].map((el) => ({
      el,
      scene: el.classList.contains('scene'),
      last: '',
    }));
  }, []);

  useScrollFrame(() => {
    if (reducedMotion()) return;
    const vh = innerHeight;
    const rects = items.current.map((it) => it.el.getBoundingClientRect());

    items.current.forEach((it, i) => {
      const r = rects[i];
      if (r.bottom < -vh || r.top > vh * 2) return;
      let value: string;
      if (it.scene) {
        // Une scène fait deux écrans de haut : le premier pour arriver, le second pour être recouverte.
        const pin = r.height / 2;
        value = `${clamp(1 - r.top / vh).toFixed(3)} ${clamp(-r.top / pin).toFixed(3)}`;
      } else {
        value = clamp((vh / 2 - (r.top + r.height / 2)) / (vh / 2 + r.height / 2), -1, 1).toFixed(3);
      }
      if (value === it.last) return;
      it.last = value;
      if (it.scene) {
        const [enter, leave] = value.split(' ');
        it.el.style.setProperty('--enter', enter);
        it.el.style.setProperty('--leave', leave);
      } else {
        it.el.style.setProperty('--drift', value);
      }
    });

    const p = clamp(scrollY / Math.max(1, document.documentElement.scrollHeight - vh)).toFixed(4);
    if (p !== page.current) {
      page.current = p;
      document.documentElement.style.setProperty('--page', p);
    }
  });
}
