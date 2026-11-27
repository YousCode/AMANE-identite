import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { COULEURS, FIGURES, type Couleur, type Dict } from '../i18n';
import { asset } from '../config';
import { Title, finePointer, reducedMotion } from '../ui';

/**
 * Le jeu Amane, posé sur un tapis.
 *
 * La main compte sept cartes : les quatre figures de la maison (le Voiturier, la Parisienne,
 * le Gentleman et le Majordome) sont toujours là, chacune dans une couleur tirée au hasard,
 * avec trois cartes tirées au hasard dans le reste du jeu. Chaque battage donne une nouvelle main.
 *
 *  paquet  les cartes sont ramassées et empilées, face cachée
 *  coupe   le paquet est coupé en deux moitiés qui se cambrent
 *  riffle  les deux moitiés retombent l'une dans l'autre, carte après carte, puis le paquet fait le pont
 *  donne   la nouvelle main est distribuée en éventail, les cartes se retournent une à une
 *
 * La première donne se fait quand le tapis entre à l'écran. Sur le tapis, une carte suit le pointeur
 * (inclinaison, reflet doré) et se lève quand on la choisit. Tout le mouvement est dans styles.css ;
 * ce composant ne fait que changer d'état et tirer les cartes.
 */
type Etat = 'paquet' | 'coupe' | 'riffle' | 'donne';

type Carte = {
  /** Nom du fichier dans public/cartes/jeu/ */
  id: string;
  /** Indice dans FIGURES, ou -1 pour une carte de 1 à 10 */
  figure: number;
  rang: number;
  couleur: Couleur;
};

const TAILLE_MAIN = 7;
const RAMASSE_MS = 650;
const COUPE_MS = 520;
const RIFFLE_MS = 1050;
const DONNE_MS = 2300;

const auHasard = <T,>(liste: readonly T[]) => liste[Math.floor(Math.random() * liste.length)];

/** Mélange de Fisher-Yates. */
function melanger<T>(liste: T[]) {
  const l = [...liste];
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}

/** Une nouvelle main : les quatre figures, chacune dans une couleur au hasard, et trois cartes du reste du jeu. */
function tirer(avant: Carte[] = []): Carte[] {
  for (let essai = 0; essai < 8; essai++) {
    const figures = FIGURES.map((f, i): Carte => {
      if (f.rang === 'joker') {
        const n = auHasard([1, 2]);
        return { id: `joker-${n}`, figure: i, rang: 0, couleur: n === 1 ? 'H' : 'S' };
      }
      const couleur = auHasard(COULEURS);
      return { id: `${couleur}-${f.rang}`, figure: i, rang: 0, couleur };
    });
    const reste: Carte[] = COULEURS.flatMap((couleur) =>
      Array.from({ length: 10 }, (_, r): Carte => ({
        id: `${couleur}-${r === 0 ? 'A' : r + 1}`,
        figure: -1,
        rang: r + 1,
        couleur,
      })),
    );
    const main = melanger([...figures, ...melanger(reste).slice(0, TAILLE_MAIN - figures.length)]);
    // Jamais deux fois de suite la même main, ni dans le même ordre.
    if (main.map((c) => c.id).join() !== avant.map((c) => c.id).join()) return main;
  }
  return melanger(avant);
}

/** La main du pré-rendu : fixe, pour que la page servie et la page animée coïncident. */
const MAIN_INITIALE: Carte[] = [
  { id: 'S-A', figure: -1, rang: 1, couleur: 'S' },
  { id: 'H-V', figure: 0, rang: 0, couleur: 'H' },
  { id: 'D-D', figure: 1, rang: 0, couleur: 'D' },
  { id: 'joker-1', figure: 3, rang: 0, couleur: 'H' },
  { id: 'C-R', figure: 2, rang: 0, couleur: 'C' },
  { id: 'H-7', figure: -1, rang: 7, couleur: 'H' },
  { id: 'D-10', figure: -1, rang: 10, couleur: 'D' },
];

const image = (id: string) => asset(`cartes/jeu/${id}.webp`);

/** Charge les faces avant la donne : quand une carte se retourne, son image est déjà là. */
function precharger(main: Carte[]) {
  for (const c of main) {
    const img = new Image();
    img.decoding = 'async';
    img.src = image(c.id);
  }
}

export function Jeu({ d }: { d: Dict }) {
  const [etat, setEtat] = useState<Etat>('paquet');
  const [main, setMain] = useState<Carte[]>(MAIN_INITIALE);
  const [montree, setMontree] = useState(-1);
  const [choisie, setChoisie] = useState(-1);
  /** Les cartes sont posées : la donne est finie, elles répondent tout de suite au pointeur. */
  const [pose, setPose] = useState(false);
  const tapis = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  // Une première main tirée au hasard, face cachée, puis la donne quand le tapis arrive à l'écran.
  useEffect(() => {
    const premiere = tirer(MAIN_INITIALE);
    setMain(premiere);
    precharger(premiere);
    const el = tapis.current;
    if (!el) return;
    if (reducedMotion()) return setEtat('donne');
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setEtat('donne');
        io.disconnect();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (etat !== 'donne') return setPose(false);
    const t = window.setTimeout(() => setPose(true), reducedMotion() ? 0 : DONNE_MS);
    return () => clearTimeout(t);
  }, [etat]);

  useEffect(() => {
    if (choisie < 0) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setChoisie(-1);
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [choisie]);

  const battre = () => {
    if (!pose) return;
    setChoisie(-1);
    setMontree(-1);
    const suivante = tirer(main);
    precharger(suivante);
    if (reducedMotion()) return setMain(suivante);
    setEtat('paquet');
    timers.current = [
      window.setTimeout(() => setEtat('coupe'), RAMASSE_MS),
      window.setTimeout(() => setEtat('riffle'), RAMASSE_MS + COUPE_MS),
      // La nouvelle main remplace l'ancienne face cachée, dans le paquet, juste avant la donne.
      window.setTimeout(
        () => {
          setMain(suivante);
          setEtat('donne');
        },
        RAMASSE_MS + COUPE_MS + RIFFLE_MS,
      ),
    ];
  };

  // La carte s'incline vers le pointeur, et le reflet le suit.
  const suivre = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== 'mouse' || !finePointer() || reducedMotion()) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const s = e.currentTarget.style;
    s.setProperty('--ry', `${((x - 0.5) * 22).toFixed(2)}deg`);
    s.setProperty('--rx', `${((0.5 - y) * 18).toFixed(2)}deg`);
    s.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    s.setProperty('--my', `${(y * 100).toFixed(1)}%`);
  };
  const lacher = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const s = e.currentTarget.style;
    ['--rx', '--ry', '--mx', '--my'].forEach((v) => s.removeProperty(v));
  };

  /** Nom et sous-titre d'une carte : la figure et son rôle, ou « Sept de cœur » et Amane. */
  const legende = (c: Carte): [string, string, boolean] =>
    c.figure >= 0
      ? [FIGURES[c.figure].name, d.jRoles[FIGURES[c.figure].label], true]
      : [d.jCarte(c.rang, c.couleur), 'Amane', false];

  const vue = choisie >= 0 ? choisie : montree;
  const [nom, sous, figure] = vue >= 0 ? legende(main[vue]) : [d.jHint, '54', false];

  return (
    <section className="jeu" id="jeu" data-tone="bx" aria-labelledby="jt">
      <div className="wrap">
        <header className="jeu__tete">
          <p className="k eb rv">{d.jk}</p>
          <Title id="jt" html={d.jt} />
          <p className="lead rv">{d.jp}</p>
        </header>
        <div className={`tapis ${etat}${pose ? ' pose' : ''}${choisie >= 0 ? ' a-choix' : ''}`} ref={tapis} data-drift>
          <ul className="main" style={{ '--n': main.length } as CSSProperties}>
            {main.map((c, k) => {
              const [n, s] = legende(c);
              // Clé = place dans la main : les cartes restent les mêmes éléments d'une donne à l'autre,
              // et ne changent d'image que face cachée, dans le paquet.
              return (
                <li key={k} className={choisie === k ? 'choisie' : undefined} style={{ '--k': k } as CSSProperties}>
                  <button
                    type="button"
                    aria-label={`${n} — ${s}`}
                    aria-pressed={choisie === k}
                    disabled={!pose}
                    onClick={() => setChoisie((x) => (x === k ? -1 : k))}
                    onPointerEnter={() => setMontree(k)}
                    onPointerMove={suivre}
                    onPointerLeave={lacher}
                    onFocus={() => setMontree(k)}
                  >
                    <span className="carte">
                      <img src={image(c.id)} alt="" width={720} height={1008} loading="lazy" decoding="async" />
                      <span className="reflet" aria-hidden="true" />
                      <img
                        className="verso"
                        src={image('dos')}
                        alt=""
                        width={720}
                        height={1008}
                        loading="lazy"
                        decoding="async"
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="jeu__nom" aria-live="polite">
            <b lang={figure ? 'fr' : undefined}>{nom}</b>
            <span>{sous}</span>
          </p>
          <button type="button" className="battre" onClick={battre} disabled={!pose}>
            <i aria-hidden="true" />
            {d.jShuffle}
          </button>
        </div>
      </div>
    </section>
  );
}
