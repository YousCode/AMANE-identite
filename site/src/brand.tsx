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

function Raw({ svg, className, label }: { svg: string; className?: string; label?: string }) {
  return (
    <span
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Logotype vectorisé : jamais retapé au clavier (voir README de l'identité). */
export const Logotype = ({ className }: { className?: string }) => (
  <Raw svg={logotypeSvg} className={className} label="Amane — Conciergerie, Paris" />
);
export const Sceau = ({ className }: { className?: string }) => <Raw svg={sceauSvg} className={className} />;
