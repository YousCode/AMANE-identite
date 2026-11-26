import { useEffect, useState } from 'react';
import { usePassages } from './passages';
import { CHAPTERS, SERVICES, dict, numerals, type Lang } from './i18n';
import { CABINETS } from './config';
import { finePointer, reducedMotion, smooth } from './ui';
import { useScenes } from './scenes';
import { Sprite } from './brand';
import { Nav } from './components/Nav';
import { Fil } from './components/Fil';
import { Epilogue, Hero } from './components/Hero';
import { Rideau } from './components/Rideau';
import { Jeu } from './components/Jeu';
import { Realisations } from './components/Realisations';
import { Chapitre, Film, Flotte, Footer, Maison, Questions, Rituel, ServicesIndex } from './components/Sections';
import { RequestForm } from './components/RequestForm';

export function App({ lang }: { lang: Lang }) {
  const d = dict(lang);
  const num = numerals(lang);
  const [service, setService] = useState(0);
  const cabinets = CABINETS.length ? `${d.eList} : ${CABINETS.join(' · ')}` : undefined;

  useScenes();
  usePassages();

  // Apparition des blocs à l'entrée dans l'écran, une seule fois.
  useEffect(() => {
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
    let dead = false;
    import('lenis').then(({ default: Lenis }) => {
      if (dead) return;
      smooth.lenis = new Lenis({ autoRaf: true, anchors: true, lerp: 0.09, wheelMultiplier: 0.9 });
    });
    return () => {
      dead = true;
      smooth.lenis?.destroy();
      smooth.lenis = null;
    };
  }, []);

  return (
    <>
      <Sprite />
      <Rideau />
      <a className="skip" href="#maison">
        {d.skip}
      </a>
      <Nav d={d} lang={lang} />
      <Fil d={d} lang={lang} />
      <main>
        <Hero d={d} />
        <Maison d={d} lang={lang} />
        <ServicesIndex d={d} lang={lang} />
        {CHAPTERS.map((c, ci) => (
          <Chapitre key={c.id} d={d} lang={lang} index={ci}>
            {c.services.map((id) => {
              const i = SERVICES.findIndex((s) => s.id === id);
              const s = SERVICES[i];
              return (
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
                  rank={num[ci]}
                  flip={s.flip}
                  passage={s.passage}
                  note={s.id === 'esthetique' ? cabinets : undefined}
                />
              );
            })}
            {/* La flotte clôt le chapitre de la route. */}
            {c.id === 'route' && <Flotte d={d} />}
            {/* Ce que la maison a créé : films, visuels et sites, à la suite du film « Création & marketing ». */}
            {c.id === 'image' && <Realisations d={d} />}
            {/* L'accueil à l'aéroport clôt le premier chapitre : ce n'est pas un service à part, c'est la promesse. */}
            {ci === 0 && (
              <Film
                id="monde"
                name="arrivee"
                kicker={d.intl}
                title={d.it}
                line={d.ip}
                cta={d.cta}
                rank={num[ci]}
                passage="p02"
                flip
              />
            )}
          </Chapitre>
        ))}
        {/* Après les chapitres : comment l'histoire s'écrit, les questions, le souvenir, puis la porte se referme. */}
        <Rituel d={d} lang={lang} />
        <Questions d={d} />
        <Jeu d={d} />
        <Epilogue d={d} />
        <RequestForm d={d} lang={lang} service={service} onService={setService} />
      </main>
      <Footer d={d} />
    </>
  );
}
