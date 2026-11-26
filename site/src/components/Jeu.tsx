import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { CARDS, type Dict } from '../i18n';
import { asset } from '../config';
import { Title, finePointer, reducedMotion } from '../ui';

/**
 * Le jeu Amane, posé sur un tapis.
 *
 *  paquet  les cartes sont empilées, face cachée
 *  bat     le paquet est battu : les cartes se croisent deux fois
 *  donne   elles sont distribuées en éventail et retournées une à une
 *
 * La donne se fait quand le tapis entre à l'écran, et se rejoue à chaque battage, dans un nouvel ordre.
 * Sur le tapis, une carte suit le pointeur (inclinaison, reflet doré) et se lève quand on la choisit.
 * Tout le mouvement est décrit dans styles.css ; ce composant ne fait que changer d'état.
 */
type Etat = 'paquet' | 'bat' | 'donne';

const BAT_MS = 1150;
const RAMASSE_MS = 720;
const DONNE_MS = 2100;

export function Jeu({ d }: { d: Dict }) {
  const [etat, setEtat] = useState<Etat>('paquet');
  const [ordre, setOrdre] = useState<number[]>(() => CARDS.map((_, i) => i));
  const [montree, setMontree] = useState(-1);
  const [choisie, setChoisie] = useState(-1);
  /** Les cartes sont posées : la donne est finie, elles répondent tout de suite au pointeur. */
  const [pose, setPose] = useState(false);
  const tapis = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  // Première donne : quand le tapis arrive à l'écran.
  useEffect(() => {
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
    if (reducedMotion()) return setOrdre((o) => melange(o));
    setEtat('paquet');
    timers.current = [
      window.setTimeout(() => setEtat('bat'), RAMASSE_MS),
      window.setTimeout(() => {
        setOrdre((o) => melange(o));
        setEtat('donne');
      }, RAMASSE_MS + BAT_MS),
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

  const vue = choisie >= 0 ? choisie : montree;
  const carte = vue >= 0 ? CARDS[vue] : null;

  return (
    <section className="jeu" id="jeu" data-tone="bx" aria-labelledby="jt">
      <div className="wrap">
        <header className="jeu__tete">
          <p className="k eb rv">{d.jk}</p>
          <Title id="jt" html={d.jt} />
          <p className="lead rv">{d.jp}</p>
        </header>
        <div className={`tapis ${etat}${pose ? ' pose' : ''}${choisie >= 0 ? ' a-choix' : ''}`} ref={tapis} data-drift>
          <ul className="main" style={{ '--n': CARDS.length } as CSSProperties}>
            {ordre.map((ci, k) => {
              const c = CARDS[ci];
              const nom = c.name || d.jRoles[c.label];
              const role = c.name ? d.jRoles[c.label] : 'Amane';
              return (
                <li key={c.id} className={choisie === ci ? 'choisie' : undefined} style={{ '--k': k } as CSSProperties}>
                  <button
                    type="button"
                    aria-label={`${nom} — ${role}`}
                    aria-pressed={choisie === ci}
                    disabled={!pose}
                    onClick={() => setChoisie((x) => (x === ci ? -1 : ci))}
                    onPointerEnter={() => setMontree(ci)}
                    onPointerMove={suivre}
                    onPointerLeave={lacher}
                    onFocus={() => setMontree(ci)}
                  >
                    <span className="carte">
                      <img src={asset(c.img)} alt="" width={720} height={1008} loading="lazy" decoding="async" />
                      <span className="reflet" aria-hidden="true" />
                      <img
                        className="verso"
                        src={asset('cartes/dos.webp')}
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
            <b lang={carte?.name ? 'fr' : undefined}>{carte ? carte.name || d.jRoles[carte.label] : d.jHint}</b>
            <span>{carte ? (carte.name ? d.jRoles[carte.label] : 'Amane') : '54'}</span>
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

/** Mélange : un nouvel ordre à chaque battage, jamais le même que le précédent. */
function melange(o: number[]) {
  let n = o;
  for (let essai = 0; essai < 6 && n.join() === o.join(); essai++) {
    n = [...o];
    for (let i = n.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [n[i], n[j]] = [n[j], n[i]];
    }
  }
  return n;
}
