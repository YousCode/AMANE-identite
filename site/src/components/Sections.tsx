import { useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import type { ReactNode } from 'react';
import { CARDS, CHAPTERS, FLEET, SERVICES, SLOGAN, numerals, type Dict, type Lang } from '../i18n';
import { Logotype, Sceau } from '../brand';
import { asset } from '../config';
import { Rich, Title } from '../ui';
import { Loop } from './Loop';

type Props = { d: Dict; lang: Lang };

/** Deuxième écran : qui est Amane. Le film des arcades de Rivoli tient dans l'arche du logo, scellé par le cachet. */
export function Maison({ d, lang }: Props) {
  const num = numerals(lang);
  const promises: [string, string][] = [
    [d.p1t, d.p1],
    [d.p2t, d.p2],
    [d.p3t, d.p3],
  ];
  return (
    <section className="sec maison" id="maison" data-tone="page" aria-labelledby="mt">
      <div className="wrap">
        <div className="maison__haut">
          <div>
            <p className="k eb rv">{d.mk}</p>
            <Title id="mt" html={d.mt} />
            <p className="lead rv">{d.mp}</p>
            <a className="link rv" href="#services">
              {d.cta2}
            </a>
          </div>
          <figure className="maison__vue rv">
            <div className="maison__cadre" data-drift>
              <div className="arche">
                <Loop name="rivoli" />
              </div>
              <Sceau className="maison__sceau" />
            </div>
            <figcaption>{d.bp}</figcaption>
          </figure>
        </div>
        <div className="promises">
          {promises.map(([t, p], i) => (
            <div className="rv" key={i}>
              <b aria-hidden="true">{num[i]}</b>
              <strong>{t}</strong>
              <span>{p}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Le sommaire : les chapitres, et sous chaque titre les services qu'il raconte.
 * À la souris, l'image du chapitre survolé apparaît dans une arche qui suit le pointeur.
 */
export function ServicesIndex({ d, lang }: Props) {
  const num = numerals(lang);
  const name = (id: string) => d[SERVICES.find((s) => s.id === id)!.key][0];
  const film = (id: string) => SERVICES.find((s) => s.id === id)!.film;
  const [shown, setShown] = useState(-1);
  const list = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const move = (e: ReactMouseEvent) => {
    const box = list.current?.getBoundingClientRect();
    if (!box || !preview.current) return;
    preview.current.style.transform = `translate3d(${e.clientX - box.left}px, ${e.clientY - box.top}px, 0)`;
  };
  return (
    <section className="sec tight" id="services" data-tone="page" aria-labelledby="st">
      <div className="wrap">
        <div className="center">
          <p className="k eb rv">{d.sk}</p>
          <Title id="st" html={d.st} />
          <p className="lead rv">{d.sn}</p>
        </div>
        <div className="index__cadre" ref={list} onMouseMove={move} onMouseLeave={() => setShown(-1)}>
          <ol className="index">
            {CHAPTERS.map((c, i) => (
              <li className="rv" key={c.id} onMouseEnter={() => setShown(i)}>
                <a href={`#chapitre-${c.id}`}>
                  <b aria-hidden="true">{num[i]}</b>
                  <strong>{d.chapters[i][0]}</strong>
                  <span>{c.services.map(name).join(' · ')}</span>
                </a>
              </li>
            ))}
          </ol>
          <div className={`apercu${shown >= 0 ? ' on' : ''}`} ref={preview} aria-hidden="true">
            <div className="apercu__arche">
              {CHAPTERS.map((c, i) => (
                <img
                  key={c.id}
                  className={i === shown ? 'on' : undefined}
                  src={asset(`img/${film(c.services[0])}-poster.jpg`)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** L'ouverture d'un chapitre : son numéro, son titre, une phrase. Les films du chapitre suivent. */
export function Chapitre({ d, lang, index, children }: Props & { index: number; children: ReactNode }) {
  const [title, text] = d.chapters[index];
  const c = CHAPTERS[index];
  const id = `chapitre-${c.id}`;
  // L'affiche du premier film du chapitre : la dernière image du passage, et l'image de repli.
  const film = SERVICES.find((s) => s.id === c.services[0])!.film;
  return (
    <>
      <section className="chapitre scene" id={id} data-tone="dark" aria-labelledby={`${id}-t`}>
        <div className="scene__pin" data-poster={`img/${film}-poster.jpg`}>
          <canvas className="passage" data-passage={c.passage} data-mode="chapitre" aria-hidden="true" />
          <span className="voile" aria-hidden="true" />
          <span className="chapitre__num" aria-hidden="true">
            {numerals(lang)[index]}
          </span>
          <div className="wrap">
            <p className="k rv">
              {d.chap} {numerals(lang)[index]}
            </p>
            <Title id={`${id}-t`} html={title} />
            <p className="lead rv">{text}</p>
          </div>
        </div>
      </section>
      {children}
    </>
  );
}

type FilmProps = {
  id: string;
  name: string;
  portrait?: string;
  kicker: string;
  title: string;
  line: string;
  cta: string;
  onAsk?: () => void;
  /** Numéro du chapitre, déjà écrit dans la numérotation de la langue (« II »). */
  rank?: string;
  /** Texte à droite plutôt qu'à gauche : un film sur deux, pour le rythme. */
  flip?: boolean;
  /** Mention sous le texte (liste des cabinets partenaires). */
  note?: string;
  /** Plan de caméra qui amène à ce film depuis le précédent (voir src/passages.ts). */
  passage?: string;
};

/** Film plein cadre. Le logotype reste dans l'angle de chaque film, quel que soit le recadrage. */
export function Film({ id, name, portrait, kicker, title, line, cta, onAsk, rank, flip, note, passage }: FilmProps) {
  return (
    <section
      className={`film scene${flip ? ' flip' : ''}`}
      id={id}
      data-tone="dark"
      data-passage={passage || undefined}
      aria-labelledby={`${id}-t`}
    >
      <div className="scene__pin">
        <Loop name={name} portrait={portrait} />
        {passage && <canvas className="passage" data-passage={passage} data-mode="entree" aria-hidden="true" />}
        <span className="grain" aria-hidden="true" />
        <div className="cap">
          <p className="k rv">{kicker}</p>
          <Title as="h3" id={`${id}-t`} html={title} />
          <p className="ln rv">{line}</p>
          {note && <p className="note rv">{note}</p>}
          <a className="link rv" href="#demande" onClick={onAsk}>
            {cta}
          </a>
        </div>
        <div className="coin" aria-hidden="true">
          {rank && (
            <p className="rang">
              {rank} <i />
            </p>
          )}
          <Logotype className="griffe" decorative />
        </div>
      </div>
    </section>
  );
}

export function Rituel({ d, lang }: Props) {
  const num = numerals(lang);
  return (
    <section className="rituel" id="rituel" data-tone="bx" aria-labelledby="rt">
      <div className="wrap two">
        <div>
          <p className="k eb rv">{d.rk}</p>
          <Title id="rt" html={d.rt} />
          <ol className="steps">
            {d.steps.map(([t, p], i) => (
              <li className="step rv" key={i}>
                <b aria-hidden="true">{num[i]}</b>
                <div>
                  <strong>{t}</strong>
                  <small>{p}</small>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="arche rv" data-drift>
          <Loop name="cles" />
        </div>
      </div>
    </section>
  );
}

export function Flotte({ d }: { d: Dict }) {
  return (
    <section className="sec" id="flotte" data-tone="page" aria-labelledby="ft">
      <div className="wrap">
        <div className="fhead">
          <div>
            <p className="k eb rv">{d.fk}</p>
            <Title id="ft" html={d.ft} />
          </div>
          <p className="lead rv">{d.fp}</p>
        </div>
        <div className="fleet">
          {FLEET.map((f) => (
            <figure className="rv" key={f.key}>
              <div className="ph" data-drift>
                <img
                  src={asset(f.img)}
                  alt={`${d[f.key][0]} — Amane, Paris`}
                  loading="lazy"
                  decoding="async"
                  width={1100}
                  height={1460}
                />
              </div>
              <figcaption>
                <b className="k">{d[f.key][0]}</b>
                <span>{d[f.key][1]}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Le jeu de cartes de la maison. À l'arrivée dans l'écran, les cartes sortent du paquet face cachée,
 * s'ouvrent en éventail puis se retournent une à une. Au survol une carte se lève ; un clic la retourne.
 */
export function Jeu({ d }: { d: Dict }) {
  const [shown, setShown] = useState(0);
  const [flipped, setFlipped] = useState<number[]>([]);
  const toggle = (i: number) => setFlipped((f) => (f.includes(i) ? f.filter((x) => x !== i) : [...f, i]));
  return (
    <section className="jeu" id="jeu" data-tone="bx" aria-labelledby="jt">
      <div className="wrap two">
        <div>
          <p className="k eb rv">{d.jk}</p>
          <Title id="jt" html={d.jt} />
          <p className="lead rv">{d.jp}</p>
        </div>
        <div className="jeu__table">
          <ul className="eventail rv" style={{ '--n': CARDS.length } as CSSProperties}>
            {CARDS.map((c, i) => (
              <li key={c.name} style={{ '--k': i } as CSSProperties}>
                <button
                  type="button"
                  className={flipped.includes(i) ? 'dos' : undefined}
                  aria-label={`${c.name} — ${d.jRoles[i]}`}
                  aria-pressed={flipped.includes(i)}
                  onClick={() => toggle(i)}
                  onMouseEnter={() => setShown(i)}
                  onFocus={() => setShown(i)}
                >
                  <img src={asset(c.img)} alt="" width={720} height={1008} loading="lazy" decoding="async" />
                  <img
                    className="verso"
                    src={asset('cartes/dos.webp')}
                    alt=""
                    width={720}
                    height={1008}
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              </li>
            ))}
          </ul>
          <p className="jeu__nom rv" aria-live="polite">
            <b lang="fr">{CARDS[shown].name}</b>
            <span>{d.jRoles[shown]}</span>
          </p>
        </div>
      </div>
    </section>
  );
}

export function Questions({ d }: { d: Dict }) {
  return (
    <section className="sec" id="questions" data-tone="page" aria-labelledby="qt">
      <div className="wrap two">
        <div>
          <p className="k eb rv">{d.qk}</p>
          <Title id="qt" html={d.qt} />
        </div>
        <div className="qa">
          {d.qa.map(([q, a], i) => (
            <details className="rv" key={i}>
              <summary>
                <span>{q}</span>
                <i aria-hidden="true" />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Footer({ d }: { d: Dict }) {
  return (
    <footer className="pied" data-tone="bx">
      <Logotype className="pied__logo" />
      <p className="pied__devise" lang="en">
        <Rich html={SLOGAN.join(' ')} />
      </p>
      <div className="txt">
        <span>{d.fo1}</span>
        <span>{d.fo2}</span>
      </div>
      <nav aria-label="Amane">
        <a className="link" href="#services">
          {d.n1}
        </a>
        <a className="link" href="#flotte">
          {d.n3}
        </a>
        <a className="link" href="#questions">
          {d.n4}
        </a>
        <a className="link" href="#demande">
          {d.cta}
        </a>
      </nav>
      <p className="cp">© 2026 Amane</p>
    </footer>
  );
}
