import { useEffect, useRef, useState } from 'react';
import { LANG_META, SERVICES, dict, type Lang } from './i18n';
import { finePointer, reducedMotion, useScrollFrame } from './ui';
import { Nav, type Tone } from './components/Nav';
import { Hero } from './components/Hero';
import { Rideau } from './components/Rideau';
import { Film, Flotte, Footer, Maison, Questions, Rituel, ServicesIndex } from './components/Sections';
import { RequestForm } from './components/RequestForm';

export function App({ lang }: { lang: Lang }) {
  const d = dict(lang);
  const rtl = LANG_META[lang].dir === 'rtl';
  const [tone, setTone] = useState<Tone>('dark');
  const [fab, setFab] = useState({ on: false, dark: false });
  const [service, setService] = useState(0);
  const toned = useRef<HTMLElement[]>([]);

  // Apparition des blocs à l'entrée dans l'écran, une seule fois.
  useEffect(() => {
    toned.current = [...document.querySelectorAll<HTMLElement>('[data-tone]')];
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add('in');
          io.unobserve(e.target);
        }),
      { rootMargin: '0px 0px -7% 0px' },
    );
    document.querySelectorAll('.rv').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Défilement doux à la souris ; le tactile garde son inertie native.
  useEffect(() => {
    if (reducedMotion() || !finePointer()) return;
    let lenis: { destroy(): void } | undefined;
    let dead = false;
    import('lenis').then(({ default: Lenis }) => {
      if (dead) return;
      lenis = new Lenis({ autoRaf: true, anchors: true, lerp: 0.09, wheelMultiplier: 0.9 });
    });
    return () => {
      dead = true;
      lenis?.destroy();
    };
  }, []);

  // Ton de la barre et du bouton flottant selon la section sous eux.
  useScrollFrame(() => {
    const at = (y: number): Tone => {
      for (const s of toned.current) {
        const r = s.getBoundingClientRect();
        if (r.top <= y && r.bottom > y) return s.dataset.tone as Tone;
      }
      return 'page';
    };
    const t = at(34);
    setTone((prev) => (prev === t ? prev : t));
    const demande = document.getElementById('demande')?.getBoundingClientRect();
    const on = scrollY > innerHeight * 0.9 && !!demande && demande.top > innerHeight * 0.85;
    const dark = at(innerHeight - 40) !== 'page';
    setFab((prev) => (prev.on === on && prev.dark === dark ? prev : { on, dark }));
  });

  return (
    <>
      <Rideau />
      <a className="skip" href="#maison">
        {d.skip}
      </a>
      <Nav d={d} lang={lang} tone={tone} fab={fab} />
      <main>
        <Hero d={d} />
        <Maison d={d} rtl={rtl} />
        <ServicesIndex d={d} rtl={rtl} />
        {SERVICES.map((s, i) => (
          <Film
            key={s.id}
            id={s.id}
            name={s.film}
            portrait={s.portrait}
            kicker={d[s.key][2]}
            title={d[s.key][0]}
            line={d[s.key][1]}
            cta={d.ask}
            onAsk={() => setService(i)}
            index={[i, SERVICES.length]}
          />
        ))}
        <Film id="monde" name="arrivee" kicker={d.intl} title={d.it} line={d.ip} cta={d.cta} />
        <Rituel d={d} />
        <Flotte d={d} />
        <Questions d={d} />
        <RequestForm d={d} lang={lang} service={service} onService={setService} />
      </main>
      <Footer d={d} />
    </>
  );
}
