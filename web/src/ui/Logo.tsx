import { useEffect, useId, useState } from 'react';
import { LOGO } from '@lilachat/shared';

/** Whether <html> has the dark class right now (it changes from the settings or the system). */
function useDarkClass(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

/**
 * The two Lilachat bubbles (José, 21/10: «la web no tiene el logo de la app»):
 * the SAME geometry as the app icon and the app's `<Logo>` (`shared/marca.ts`),
 * with the dark variant's tones in dark mode.
 */
export function Logo({ size = 28 }: { size?: number }) {
  const tones = useDarkClass() ? LOGO.tonos.oscuro : LOGO.tonos.claro;
  // One id per instance: two logos on screen do not share the mask.
  const cut = `logo-cut-${useId().replace(/:/g, '')}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${LOGO.viewBox} ${LOGO.viewBox}`} role="img" aria-label="Lilachat">
      <defs>
        <mask id={cut}>
          <rect x={0} y={0} width={LOGO.viewBox} height={LOGO.viewBox} fill="#fff" />
          <path d={LOGO.chica} fill="#000" stroke="#000" strokeWidth={LOGO.corte} strokeLinejoin="round" />
        </mask>
      </defs>
      <path d={LOGO.grande} fill={tones.grande} mask={`url(#${cut})`} />
      <path d={LOGO.chica} fill={tones.chica} />
    </svg>
  );
}
