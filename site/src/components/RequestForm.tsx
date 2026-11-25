import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SERVICES, type Dict, type Lang } from '../i18n';
import { CONTACT_EMAIL, WHATSAPP } from '../config';
import { Sceau } from '../brand';
import { Title } from '../ui';

type Status = 'idle' | 'sending' | 'ok' | 'error';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/;

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
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [ack, setAck] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const done = useRef<HTMLDivElement>(null);
  const options = [...SERVICES.map((s) => d[s.key][0]), d.other];

  useEffect(() => {
    if (status === 'ok') done.current?.focus();
  }, [status]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const f = new FormData(form.current!);
    const val = (k: string) => String(f.get(k) ?? '').trim();
    const email = val('email');
    const tel = val('tel');
    const fail = (msg: string, field: string) => {
      setStatus('error');
      setError(msg);
      (form.current!.elements.namedItem(field) as HTMLElement | null)?.focus();
    };
    if (!email && !tel) return fail(d.errContact, 'email');
    if (email && !EMAIL_RE.test(email)) return fail(d.errEmail, 'email');
    if (tel && tel.replace(/\D/g, '').length < 8) return fail(d.errTel, 'tel');

    setStatus('sending');
    setError('');
    try {
      const r = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nom: val('nom'),
          email,
          tel,
          service: options[service] ?? '',
          date: val('date'),
          passagers: val('passagers'),
          langue: lang,
          message: val('message'),
          website: val('website'),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const map: Record<string, string> = {
          contact_requis: d.errContact,
          email_invalide: d.errEmail,
          tel_invalide: d.errTel,
          trop_de_demandes: d.errRate,
        };
        setStatus('error');
        setError(map[j.error] ?? d.errSend);
        return;
      }
      setAck(Boolean(j.ack));
      setStatus('ok');
    } catch {
      setStatus('error');
      setError(d.errSend);
    }
  }

  return (
    <section className="sec pierre" id="demande" data-tone="page" aria-labelledby="at">
      <div className="wrap two">
        <div>
          <p className="k eb rv">{d.ak}</p>
          <Title id="at" html={d.at} />
          <p className="lead rv">{d.ap}</p>
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

        <div className="card rv">
          {status === 'ok' ? (
            <div className="done" ref={done} tabIndex={-1} role="status">
              <Sceau className="done__sceau" />
              <Title as="h3" html={d.okT} className="in" />
              <p>{d.okP}</p>
              {ack && <p>{d.okAck}</p>}
              <button className="btn ghost" type="button" onClick={() => setStatus('idle')}>
                {d.again}
              </button>
            </div>
          ) : (
            <form ref={form} onSubmit={submit} noValidate>
              <div className="fr2">
                <div className="f">
                  <label htmlFor="f-nom">{d.l1}</label>
                  <input id="f-nom" name="nom" autoComplete="name" maxLength={120} />
                </div>
                <div className="f">
                  <label htmlFor="f-service">{d.l3}</label>
                  <select
                    id="f-service"
                    name="service"
                    value={service}
                    onChange={(e) => onService(Number(e.target.value))}
                  >
                    {options.map((o, i) => (
                      <option key={i} value={i}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="fr2">
                <div className="f">
                  <label htmlFor="f-email">{d.lEmail}</label>
                  <input
                    id="f-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    dir="ltr"
                    maxLength={200}
                    aria-describedby="f-hint"
                  />
                </div>
                <div className="f">
                  <label htmlFor="f-tel">{d.lTel}</label>
                  <input
                    id="f-tel"
                    name="tel"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    dir="ltr"
                    maxLength={40}
                    aria-describedby="f-hint"
                  />
                </div>
              </div>
              <p className="hintline" id="f-hint">
                {d.contactHint}
              </p>
              <div className="fr2">
                <div className="f">
                  <label htmlFor="f-date">{d.l2}</label>
                  <input id="f-date" name="date" type="date" />
                </div>
                <div className="f">
                  <label htmlFor="f-pax">{d.l4}</label>
                  <select id="f-pax" name="passagers" defaultValue="">
                    <option value="">—</option>
                    {['1', '2', '3', '4', '5', '6', '7', '8+'].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="f">
                <label htmlFor="f-msg">{d.l6}</label>
                <textarea id="f-msg" name="message" rows={3} maxLength={4000} />
              </div>
              <div className="hp" aria-hidden="true">
                <label htmlFor="f-web">Site web</label>
                <input id="f-web" name="website" tabIndex={-1} autoComplete="off" />
              </div>
              <div className="send">
                <button className="btn" type="submit" disabled={status === 'sending'}>
                  {status === 'sending' ? d.sending : d.send}
                </button>
                <p className="err" role="alert">
                  {status === 'error' ? error : ''}
                </p>
              </div>
              <p className="priv">{d.privacy}</p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
