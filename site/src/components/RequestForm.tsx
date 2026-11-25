import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { REQUEST_IDS, SERVICES, numerals, type Dict, type Lang } from '../i18n';
import { CONTACT_EMAIL, WHATSAPP } from '../config';
import { MarkA, Sceau } from '../brand';
import { Title } from '../ui';

type Status = 'idle' | 'sending' | 'ok';
type Field = 'email' | 'tel';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/;
const PAX = ['1', '2', '3', '4', '5', '6', '7', '8+'];
const LOCALE: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', ar: 'ar' };
const digits = (s: string) => (s.match(/\p{Nd}/gu) ?? []).length;

/**
 * La demande, en trois temps courts : l'occasion, le moment, le contact.
 * À côté, une carte aux couleurs de la maison se compose à mesure des réponses ;
 * à l'envoi, elle reçoit le cachet de cire.
 */
export function RequestForm({
  d,
  lang,
  service,
  onService,
}: {
  d: Dict;
  lang: Lang;
  service: number;
  onService: (i: number) => void;
}) {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<{ text: string; field?: Field } | null>(null);
  const [ack, setAck] = useState(false);
  const [v, setV] = useState({ message: '', date: '', pax: '', nom: '', email: '', tel: '', piege: '' });
  const uid = useId();
  const panel = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const num = numerals(lang);
  const options = [...SERVICES.map((s) => d[s.key][0]), d.other];
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [k]: e.target.value }));

  // À chaque changement d'étape (ou à l'envoi), le focus suit le contenu qui vient d'apparaître.
  useEffect(() => {
    if (!moved.current) return;
    panel.current?.querySelector<HTMLElement>('[data-focus]')?.focus({ preventScroll: true });
  }, [step, status]);

  const go = (n: number) => {
    moved.current = true;
    setError(null);
    setStep(n);
  };

  const dateLabel = v.date
    ? new Date(`${v.date}T12:00`).toLocaleDateString(LOCALE[lang], { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (status === 'sending') return;
    if (step < 2) return go(step + 1);
    const email = v.email.trim();
    const tel = v.tel.trim();
    if (!email && !tel) return setError({ text: d.errContact, field: 'email' });
    if (email && !EMAIL_RE.test(email)) return setError({ text: d.errEmail, field: 'email' });
    if (tel && digits(tel) < 8) return setError({ text: d.errTel, field: 'tel' });

    setStatus('sending');
    setError(null);
    try {
      const r = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nom: v.nom.trim(),
          email,
          tel,
          service: REQUEST_IDS[service] ?? 'autre',
          date: v.date,
          passagers: v.pax,
          langue: lang,
          message: v.message.trim(),
          a_laisser_vide: v.piege,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const known: Record<string, { text: string; field?: Field }> = {
          contact_requis: { text: d.errContact, field: 'email' },
          email_invalide: { text: d.errEmail, field: 'email' },
          tel_invalide: { text: d.errTel, field: 'tel' },
          trop_de_demandes: { text: d.errRate },
        };
        setStatus('idle');
        return setError(known[j.error] ?? { text: d.errSend });
      }
      moved.current = true;
      setAck(Boolean(j.ack));
      setStatus('ok');
    } catch {
      setStatus('idle');
      setError({ text: d.errSend });
    }
  }

  // Le champ fautif reçoit le focus ; l'erreur lui est reliée par aria-describedby.
  useEffect(() => {
    if (error?.field) document.getElementById(`${uid}-${error.field}`)?.focus();
  }, [error, uid]);

  const again = () => {
    moved.current = true;
    setV((p) => ({ ...p, message: '', date: '', pax: '' }));
    setStatus('idle');
    setStep(0);
  };

  // Entrée dans un champ d'une étape intermédiaire : on avance, on n'envoie pas.
  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && step < 2) {
      e.preventDefault();
      go(step + 1);
    }
  };

  const invalid = (f: Field) => (error?.field === f ? true : undefined);
  const describedBy = (f: Field) => `${uid}-hint${error?.field === f ? ` ${uid}-err` : ''}`;
  const sent = status === 'ok';

  return (
    <section className="sec pierre demande" id="demande" data-tone="page" aria-labelledby="at">
      <div className="wrap two">
        <div className="demande__cote">
          <p className="k eb rv">{d.ak}</p>
          <Title id="at" html={d.at} />
          <p className="lead rv">{d.ap}</p>

          <div className="rv" aria-hidden="true">
            <div className={`billet${sent ? ' scelle' : ''}`}>
              <div className="billet__plaque">
                <MarkA />
                <p className="k">{d.cardTitle}</p>
                <p className="billet__service">{options[service]}</p>
                <ul>
                  {dateLabel && <li>{dateLabel}</li>}
                  {v.pax && <li>{d.pax(v.pax)}</li>}
                  {v.nom.trim() && <li>{v.nom.trim()}</li>}
                </ul>
                {!dateLabel && !v.pax && !v.nom.trim() && <p className="billet__vide">{d.cardEmpty}</p>}
              </div>
              <Sceau className="billet__sceau" />
            </div>
          </div>

          {(WHATSAPP || CONTACT_EMAIL) && (
            <div className="contact rv">
              {WHATSAPP && (
                <a className="link" href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener">
                  {d.wa}
                </a>
              )}
              {CONTACT_EMAIL && (
                <a className="link" href={`mailto:${CONTACT_EMAIL}`} dir="ltr">
                  {CONTACT_EMAIL}
                </a>
              )}
            </div>
          )}
        </div>

        <div className="card rv" ref={panel}>
          {sent ? (
            <div className="done" role="status">
              <Title as="h3" html={d.okT} className="in" />
              <p data-focus tabIndex={-1}>
                {d.okP}
              </p>
              {ack && <p>{d.okAck}</p>}
              <button className="btn ghost" type="button" onClick={again}>
                {d.again}
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <ol className="etapes" aria-label={d.ak}>
                {d.stepNames.map((name, i) => (
                  <li
                    key={i}
                    className={i === step ? 'on' : i < step ? 'vu' : undefined}
                    aria-current={i === step ? 'step' : undefined}
                  >
                    <b aria-hidden="true">{num[i]}</b>
                    <span>{name}</span>
                  </li>
                ))}
              </ol>

              <fieldset className="etape" hidden={step !== 0}>
                <legend data-focus tabIndex={-1}>
                  {d.l3}
                </legend>
                <div className="choix">
                  {options.map((o, i) => (
                    <label key={i}>
                      <input type="radio" name="service" checked={service === i} onChange={() => onService(i)} />
                      <span>{o}</span>
                    </label>
                  ))}
                </div>
                <div className="f">
                  <label htmlFor={`${uid}-msg`}>{d.l6}</label>
                  <textarea id={`${uid}-msg`} rows={3} maxLength={4000} value={v.message} onChange={set('message')} />
                </div>
              </fieldset>

              <fieldset className="etape" hidden={step !== 1}>
                <legend className="vh">{d.stepNames[1]}</legend>
                <div className="f">
                  <label htmlFor={`${uid}-date`}>{d.l2}</label>
                  <input
                    id={`${uid}-date`}
                    type="date"
                    data-focus
                    value={v.date}
                    onChange={set('date')}
                    onKeyDown={onEnter}
                  />
                </div>
                <div className="f">
                  <span className="f__label" id={`${uid}-pax`}>
                    {d.l4}
                  </span>
                  <div className="choix serre" role="group" aria-labelledby={`${uid}-pax`} dir="ltr">
                    {PAX.map((n) => (
                      <label key={n}>
                        <input
                          type="radio"
                          name="passagers"
                          checked={v.pax === n}
                          onChange={() => setV((p) => ({ ...p, pax: n }))}
                        />
                        <span>{n}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </fieldset>

              <fieldset className="etape" hidden={step !== 2}>
                <legend className="vh">{d.stepNames[2]}</legend>
                <div className="f">
                  <label htmlFor={`${uid}-nom`}>{d.l1}</label>
                  <input
                    id={`${uid}-nom`}
                    data-focus
                    autoComplete="name"
                    maxLength={120}
                    value={v.nom}
                    onChange={set('nom')}
                  />
                </div>
                <div className="fr2">
                  <div className="f">
                    <label htmlFor={`${uid}-email`}>{d.lEmail}</label>
                    <input
                      id={`${uid}-email`}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      dir="ltr"
                      maxLength={200}
                      value={v.email}
                      onChange={set('email')}
                      aria-invalid={invalid('email')}
                      aria-describedby={describedBy('email')}
                    />
                  </div>
                  <div className="f">
                    <label htmlFor={`${uid}-tel`}>{d.lTel}</label>
                    <input
                      id={`${uid}-tel`}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      dir="ltr"
                      maxLength={40}
                      value={v.tel}
                      onChange={set('tel')}
                      aria-invalid={invalid('tel')}
                      aria-describedby={describedBy('tel')}
                    />
                  </div>
                </div>
                <p className="hintline" id={`${uid}-hint`}>
                  {d.contactHint}
                </p>
                <p className="priv">{d.privacy}</p>
              </fieldset>

              {/* Champ piège : invisible, hors tabulation ; un humain ne le remplit jamais. */}
              <div className="hp" aria-hidden="true">
                <input tabIndex={-1} autoComplete="off" value={v.piege} onChange={set('piege')} />
              </div>

              <div className="send">
                {step > 0 && (
                  <button className="link" type="button" onClick={() => go(step - 1)}>
                    {d.back}
                  </button>
                )}
                <button className="btn" type="submit" aria-disabled={status === 'sending'}>
                  {step < 2 ? d.next : status === 'sending' ? d.sending : d.send}
                </button>
                <p className="err" id={`${uid}-err`} role="alert">
                  {error?.text ?? ''}
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
