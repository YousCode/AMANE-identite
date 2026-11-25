import logotypeSvg from './brand/logotype.svg?raw';
import sceauSvg from './brand/sceau.svg?raw';

/** Le A à serrure (logos/svg/amane-A-*.svg). */
const A_PATH =
  'M452 -6 L560 -6 L831.93 912 Q856.67 982 930.67 982 L930.67 1000 L653.17 1000 L653.17 982 Q715.17 982 698.38 912 Z M452 -6 L486 40 L217.73 922 Q201.48 982 261.48 982 L261.48 1000 L97.19 1000 L97.19 982 Q165.19 982 184.49 922 Z M301.5 632.5 L627.38 632.5 L627.38 647.5 L301.5 647.5 Z M406.44 636 A58 58 0 1 1 522.44 636 A58 58 0 1 1 406.44 636 Z M442.44 676 L486.44 676 L510.44 832 Q512.44 842 502.44 842 L426.44 842 Q416.44 842 418.44 832 Z';

export function MarkA({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="40 -60 940 1120" aria-hidden="true" focusable="false">
      <path fill="currentColor" d={A_PATH} />
    </svg>
  );
}

/**
 * Monogramme (logos/svg/amane-monogramme-*.svg), pièce par pièce pour l'animation de chargement :
 * les deux arcs se tracent, le sol s'étire, le A monte, le losange s'allume.
 */
export function MonogrammeTrace() {
  return (
    <svg viewBox="-70 -10 1140 1310" aria-hidden="true" focusable="false">
      <path className="trace" pathLength={1} strokeWidth={22} d="M11 1260 V500 A489 489 0 0 1 989 500 V1260" />
      <path className="trace fin" pathLength={1} strokeWidth={7} d="M45 1260 V500 A455 455 0 0 1 955 500 V1260" />
      <path className="pt" fill="currentColor" d="M500 51 l26 34 l-26 34 l-26 -34 Z" />
      <rect className="sol" fill="currentColor" x={-60} y={1256} width={1120} height={14} />
      <rect className="sol" fill="currentColor" x={-30} y={1282} width={1060} height={5} />
      <g transform="translate(119.64 492) scale(0.74)">
        <path className="lettre" fill="currentColor" d={A_PATH} />
      </g>
    </svg>
  );
}

/** Découpe un fichier SVG en son cadre et son contenu, pour en faire un symbole réutilisable. */
function parts(svg: string) {
  return {
    viewBox: /viewBox="([^"]+)"/.exec(svg)?.[1] ?? '0 0 100 100',
    inner: svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, ''),
  };
}
const LOGOTYPE = parts(logotypeSvg);
const SCEAU = parts(sceauSvg);

/**
 * Les dessins lourds (logotype, sceau) ne sont écrits qu'une fois dans la page ;
 * chaque emploi y renvoie par <use>, ce qui garde le HTML léger malgré un logotype par film.
 */
export function Sprite() {
  const symbol = (id: string, p: { viewBox: string; inner: string }) =>
    `<symbol id="${id}" viewBox="${p.viewBox}">${p.inner}</symbol>`;
  return (
    <svg
      width="0"
      height="0"
      style={{ position: 'absolute' }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: symbol('amane-logotype', LOGOTYPE) + symbol('amane-sceau', SCEAU) }}
    />
  );
}

function Use({ id, viewBox, className, label }: { id: string; viewBox: string; className?: string; label?: string }) {
  // Le symbole garde son propre cadre (origine comprise) ; ici on ne reprend que ses dimensions.
  const [, , w, h] = viewBox.split(' ');
  return (
    <svg
      className={className}
      viewBox={`0 0 ${w} ${h}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <use href={`#${id}`} />
    </svg>
  );
}

/** Logotype vectorisé : jamais retapé au clavier (voir README de l'identité). `decorative` le masque aux lecteurs d'écran. */
export const Logotype = ({ className, decorative }: { className?: string; decorative?: boolean }) => (
  <Use
    id="amane-logotype"
    viewBox={LOGOTYPE.viewBox}
    className={className}
    label={decorative ? undefined : 'Amane — Conciergerie, Paris'}
  />
);
export const Sceau = ({ className }: { className?: string }) => (
  <Use id="amane-sceau" viewBox={SCEAU.viewBox} className={className} />
);
