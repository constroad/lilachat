import { useCallback, useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { ENLACE_DE_DESCARGA } from '@lilachat/shared';
import { Overlay } from '../ui/Overlay';
import { IphoneInstallSteps } from './IphoneInstallGuide';
import { useInstallPrompt } from './installPrompt';
import { canOffer, installOfferFor, nextDismissal, readDismissal, saveDismissal, type InstallOffer } from './installOffer';
import { useHasAndroidApp } from './useHasAndroidApp';

const WORDS: Record<InstallOffer, { title: string; hint: string; action: string }> = {
  iphone: { title: 'Instala Lilachat en tu iPhone', hint: 'Te llegan los avisos. Al abrirla, entras de nuevo.', action: 'Ver cómo' },
  pwa: { title: 'Instala Lilachat en este teléfono', hint: 'Se abre como app y te llegan los avisos.', action: 'Instalar' },
  android: { title: 'Descarga la app de Lilachat', hint: 'Las llamadas y los avisos funcionan mejor.', action: 'Descargar' },
};

const ACTION = 'inline-flex h-9 shrink-0 items-center rounded-full bg-primary px-4 text-[13px] font-semibold text-on-primary';

const HINT_MS = 8000;

/** Closing the strip is not losing the way in (José 06/11: «si lo cancelo, ¿cómo puedo hacer la instalación?»). */
function SettingsHint({ onGone }: { onGone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onGone, HINT_MS);
    return () => clearTimeout(timer);
  }, [onGone]);
  return <p data-testid="aviso-instalar-en-ajustes" role="status" className="mx-3 mb-2 rounded-xl bg-primary/10 px-3 py-2 text-[13px] text-on-surface-variant">Cuando quieras, instálala desde Ajustes.</p>;
}

/** Part of the list, not floating over it (Portal's banner hid the viewer's close button, 20/10/2026). */
export function InstallStrip({ jwt }: { jwt: string }) {
  const hasAndroidApp = useHasAndroidApp(jwt);
  const { canInstall, install } = useInstallPrompt();
  const [dismissal, setDismissal] = useState(readDismissal);
  const [steps, setSteps] = useState(false);
  const [hint, setHint] = useState(false);
  const hideHint = useCallback(() => setHint(false), []);
  const offer = installOfferFor(navigator, hasAndroidApp, canInstall);
  if (hint) return <SettingsHint onGone={hideHint} />;
  if (!offer || !canOffer(dismissal, Date.now())) return null;
  const dismiss = () => {
    const next = nextDismissal(dismissal, Date.now());
    saveDismissal(next);
    setDismissal(next);
  };
  const words = WORDS[offer];
  return (
    <section data-testid="franja-instalar" aria-label={words.title} className="mx-3 mb-2 rounded-xl bg-primary/10 py-1 pl-3 pr-1">
      <div className="flex items-start gap-2">
        <Download size={16} className="mt-2.5 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 py-1.5">
          <span className="block text-sm font-semibold">{words.title}</span>
          <span className="block text-[13px] leading-5 text-on-surface-variant">{words.hint}</span>
        </p>
        <button type="button" data-testid="btn-cerrar-franja" aria-label="Cerrar" onClick={() => { dismiss(); setHint(true); }} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-on-surface-variant"><X size={16} /></button>
      </div>
      <div className="flex justify-end pb-2 pr-2">
        {offer === 'iphone' ? (
          <button type="button" data-testid="btn-franja-instalar" onClick={() => setSteps(true)} className={ACTION}>{words.action}</button>
        ) : offer === 'pwa' ? (
          <button type="button" data-testid="btn-franja-instalar" onClick={() => void install().then(dismiss)} className={ACTION}>{words.action}</button>
        ) : (
          <a data-testid="btn-franja-instalar" href={ENLACE_DE_DESCARGA} target="_blank" rel="noreferrer" onClick={dismiss} className={ACTION}>{words.action}</a>
        )}
      </div>
      {steps ? <Overlay title="Instalar en tu iPhone" onClose={() => setSteps(false)}><IphoneInstallSteps /></Overlay> : null}
    </section>
  );
}
