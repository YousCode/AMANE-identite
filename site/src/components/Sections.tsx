import { FLEET, ROMAN, SERVICES, type Dict } from '../i18n';
import { Logotype } from '../brand';
import { Title } from '../ui';
import { asset } from '../config';
import { Loop } from './Loop';

const AR_NUM = ['١', '٢', '٣', '٤', '٥', '٦'];

export function Maison({ d, rtl }: { d: Dict; rtl: boolean }) {
  const promises: [string, string][] = [
    [d.p1t, d.p1],
    [d.p2t, d.p2],
    [d.p3t, d.p3],
  ];
  return (
    <section className="sec center" id="maison" data-tone="page" aria-labelledby="mt">
      <div className="wrap">
        <p className="k eb rv">{d.mk}</p>
        <Title id="mt" html={d.mt} />
        <p className="lead rv">{d.mp}</p>
        <div className="promises">
          {promises.map(([t, p], i) => (
            <div className="rv" key={i}>
              <b aria-hidden="true">{(rtl ? AR_NUM : ROMAN)[i]}</b>
              <strong>{t}</strong>
              <span>{p}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Les six services d'un coup d'œil ; chaque ligne mène à son film. */
export function ServicesIndex({ d, rtl }: { d: Dict; rtl: boolean }) {
  return (
    <section className="sec tight" id="services" data-tone="page" aria-labelledby="st">
      <div className="wrap">
        <div className="center">
          <p className="k eb rv">{d.sk}</p>
          <Title id="st" html={d.st} />
          <p className="lead rv">{d.sn}</p>
        </div>
        <ol className="index">
          {SERVICES.map((s, i) => (
            <li className="rv" key={s.id}>
              <a href={`#${s.id}`}>
                <b aria-hidden="true">{(rtl ? AR_NUM : ROMAN)[i]}</b>
                <strong>{d[s.key][0]}</strong>
                <span>{d[s.key][2]}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Film({
  id,
  name,
  portrait,
  kicker,
  title,
  line,
  cta,
  onAsk,
  index,
}: {
  id: string;
  name: string;
  portrait?: string;
  kicker: string;
  title: string;
  line: string;
  cta: string;
  onAsk?: () => void;
  /** Rang du service et total, affichés en chiffres romains (« II — VI »). */
  index?: [number, number];
}) {
  return (
    <section className="film" id={id} data-tone="dark" aria-labelledby={`${id}-t`}>
      <Loop name={name} portrait={portrait} />
      <div className="cap">
        <p className="k rv">{kicker}</p>
        <Title id={`${id}-t`} html={title} />
        <p className="ln rv">{line}</p>
        <a className="link rv" href="#demande" onClick={onAsk}>
          {cta}
        </a>
      </div>
      {index && (
        <p className="rang" aria-hidden="true">
          {ROMAN[index[0]]} <i /> {ROMAN[index[1] - 1]}
        </p>
      )}
    </section>
  );
}

export function Rituel({ d }: { d: Dict }) {
  return (
    <section className="rituel" id="rituel" data-tone="bx" aria-labelledby="rt">
      <div className="wrap two">
        <div>
          <p className="k eb rv">{d.rk}</p>
          <Title id="rt" html={d.rt} />
          <ol className="steps">
            {d.steps.map(([t, p], i) => (
              <li className="step rv" key={i}>
                <b aria-hidden="true">0{i + 1}</b>
                <div>
                  <strong>{t}</strong>
                  <small>{p}</small>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="arche rv">
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
              <div className="ph">
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
