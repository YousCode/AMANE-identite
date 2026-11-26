import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Dict, Lang } from '../i18n';
import { REALISATIONS, type Realisation } from '../realisations';
import { asset } from '../config';
import { Title, reducedMotion, smooth } from '../ui';

/**
 * Les réalisations : une grille de films, de visuels et de sites, filtrable, avec une visionneuse.
 * Un film se lance au survol de sa tuile ; un site se présente dans une fenêtre de navigateur.
 * La liste est dans src/realisations.ts.
 */
export function Realisations({ d, lang }: { d: Dict; lang: Lang }) {
  const [filtre, setFiltre] = useState(-1);
  const [ouverte, setOuverte] = useState(-1);
  /** La tuile dont les bulles sont dépliées au doigt ou au clavier (au survol, le CSS suffit). */
  const [bulles, setBulles] = useState('');
  const visibles = REALISATIONS.filter((r) => filtre < 0 || r.kind === filtre);
  const dialog = useRef<HTMLDialogElement>(null);
  /** La grille est arrivée à l'écran : ses tuiles se dévoilent l'une après l'autre. */
  const [arrivee, setVue] = useState(false);
  const grille = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = grille.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setVue(true);
        io.disconnect();
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const filtrer = (kind: number) => {
    if (kind === filtre) return;
    // Quand le navigateur le permet, les tuiles glissent vers leur nouvelle place.
    const doc = document as Document & { startViewTransition?: (fn: () => void) => unknown };
    if (doc.startViewTransition && !reducedMotion()) doc.startViewTransition(() => setFiltre(kind));
    else setFiltre(kind);
  };

  // La visionneuse est une boîte de dialogue native : piège à focus et touche Échap compris.
  useEffect(() => {
    const dlg = dialog.current;
    if (!dlg) return;
    if (ouverte >= 0 && !dlg.open) {
      dlg.showModal();
      smooth.lenis?.stop();
    } else if (ouverte < 0 && dlg.open) dlg.close();
  }, [ouverte]);

  const fermer = () => {
    setOuverte(-1);
    smooth.lenis?.start();
  };
  const aller = (pas: number) => setOuverte((i) => (i + pas + visibles.length) % visibles.length);
  const vue: Realisation | undefined = visibles[ouverte];

  return (
    <section className="sec realisations" id="realisations" data-tone="page" aria-labelledby="wt">
      <div className="wrap">
        <div className="fhead">
          <div>
            <p className="k eb rv">{d.wk}</p>
            <Title id="wt" html={d.wt} />
          </div>
          <p className="lead rv">{d.wp}</p>
        </div>
        <div className="filtres rv" role="group" aria-label={d.wk}>
          {d.wFilters.map((label, i) => (
            <button type="button" key={label} aria-pressed={filtre === i - 1} onClick={() => filtrer(i - 1)}>
              {label}
              <sup>{i === 0 ? REALISATIONS.length : REALISATIONS.filter((r) => r.kind === i - 1).length}</sup>
            </button>
          ))}
        </div>
        <ul className={`oeuvres${filtre >= 0 ? ' filtre' : ''}${arrivee ? ' vu' : ''}`} ref={grille}>
          {visibles.map((r, i) => (
            <li
              key={r.id}
              className={`oeuvre ${r.format}${bulles === r.id ? ' bulles-on' : ''}`}
              style={{ viewTransitionName: `oeuvre-${r.id}`, '--k': i } as CSSProperties}
            >
              <button type="button" className="oeuvre__ouvrir" onClick={() => setOuverte(i)} aria-haspopup="dialog">
                <Tuile r={r} />
                <span className="oeuvre__nom">
                  <small>{d.wKinds[r.kind]}</small>
                  <b>{r.title}</b>
                </span>
              </button>
              <button
                type="button"
                className="oeuvre__plus"
                aria-label={`${d.wMore} — ${r.title}`}
                aria-expanded={bulles === r.id}
                onClick={() => setBulles((b) => (b === r.id ? '' : r.id))}
              >
                <i aria-hidden="true" />
              </button>
              <Bulles r={r} d={d} />
            </li>
          ))}
        </ul>
      </div>

      <dialog
        className="visionneuse"
        ref={dialog}
        data-lenis-prevent
        aria-label={vue?.title}
        onClose={fermer}
        onClick={(e) => e.target === e.currentTarget && fermer()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') aller(1);
          if (e.key === 'ArrowLeft') aller(-1);
        }}
      >
        {vue && (
          <figure key={vue.id}>
            <div className={`visionneuse__media${vue.kind === 2 ? ' fenetre' : ''}`}>
              {vue.kind === 2 && <Barre adresse={vue.title} />}
              {vue.video ? (
                <video src={asset(vue.video)} poster={asset(vue.img)} autoPlay muted loop playsInline controls />
              ) : (
                <img src={asset(vue.img)} alt="" />
              )}
            </div>
            <figcaption>
              <small>{d.wKinds[vue.kind]}</small>
              <b>{vue.title}</b>
              {vue.note && <p>{vue.note[lang] ?? vue.note.fr}</p>}
              <Bulles r={vue} d={d} />
              {vue.href && (
                <a className="link" href={vue.href} target="_blank" rel="noopener">
                  {d.wVisit}
                </a>
              )}
            </figcaption>
          </figure>
        )}
        <div className="visionneuse__nav">
          <button type="button" onClick={() => aller(-1)} aria-label="←">
            <i aria-hidden="true" />
          </button>
          <span aria-hidden="true">
            {ouverte + 1} / {visibles.length}
          </span>
          <button type="button" className="suiv" onClick={() => aller(1)} aria-label="→">
            <i aria-hidden="true" />
          </button>
        </div>
        <button type="button" className="visionneuse__fermer" onClick={fermer} aria-label={d.wClose}>
          <i aria-hidden="true" />
        </button>
      </dialog>
    </section>
  );
}

/** Les petites bulles d'une réalisation : pour qui, ce que la maison a fait, l'année. */
function Bulles({ r, d }: { r: Realisation; d: Dict }) {
  const items = [`${d.wFor} ${r.client}`, ...r.roles.map((k) => d.wRoles[k] ?? k), r.year];
  return (
    <ul className="bulles">
      {items.map((t, b) => (
        <li key={t} style={{ '--b': b } as CSSProperties}>
          {t}
        </li>
      ))}
    </ul>
  );
}

/** La barre d'une fenêtre de navigateur, pour présenter un site. */
function Barre({ adresse }: { adresse: string }) {
  return (
    <span className="barre" aria-hidden="true">
      <i />
      <i />
      <i />
      <em>{adresse}</em>
    </span>
  );
}

/** L'image d'une tuile. Un film démarre au survol (ou au focus) et revient au début quand on le quitte. */
function Tuile({ r }: { r: Realisation }) {
  const video = useRef<HTMLVideoElement>(null);
  const jouer = () => {
    const v = video.current;
    if (!v || reducedMotion()) return;
    if (!v.src) v.src = asset(r.video!);
    v.muted = true;
    v.play().catch(() => {});
  };
  const arreter = () => {
    const v = video.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  };
  return (
    <span
      className={`oeuvre__image${r.kind === 2 ? ' fenetre' : ''}`}
      onPointerEnter={r.video ? jouer : undefined}
      onPointerLeave={r.video ? arreter : undefined}
    >
      {r.kind === 2 && <Barre adresse={r.title} />}
      <img src={asset(r.img)} alt="" loading="lazy" decoding="async" />
      {r.video && (
        <>
          <video ref={video} muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} />
          <i className="lecture" aria-hidden="true" />
        </>
      )}
    </span>
  );
}
