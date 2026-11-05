import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { ENLACE_DE_DESCARGA } from '@lilachat/shared';
import { api } from '../api';
import { Overlay } from '../ui/Overlay';
import { IphoneInstallSteps } from './IphoneInstallGuide';
import { canOffer, installOfferFor, isAndroid, nextDismissal, readDismissal, saveDismissal, type InstallOffer } from './installOffer';

const WORDS: Record<InstallOffer, { title: string; hint: string; action: string }> = {
  iphone: { title: 'Instala Lilachat en tu iPhone', hint: 'Te llegan los avisos. Al abrirla, entras de nuevo.', action: 'Ver cómo' },
  android: { title: 'Descarga la app de Lilachat', hint: 'Las llamadas y los avisos funcionan mejor.', action: 'Descargar' },
};

const ACTION = 'inline-flex h-9 shrink-0 items-center rounded-full bg-primary px-4 text-[13px] font-semibold text-on-primary';

/** Only Android asks the server: an iPhone is offered the web whatever the account has. */
function useHasAndroidApp(jwt: string): boolean | null {
  const [hasAndroidApp, setHasAndroidApp] = useState<boolean | null>(null);
  useEffect(() => {
    if (!isAndroid()) return;
    void api<{ hasAndroidApp: boolean }>('/me/android-app', { jwt }).then((answer) => {
      if (answer.ok) setHasAndroidApp(answer.data.hasAndroidApp);
    });
  }, [jwt]);
  return hasAndroidApp;
}

/** Part of the list, not floating over it (Portal's banner hid the viewer's close button, 20/10/2026). */
export function InstallStrip({ jwt }: { jwt: string }) {
  const hasAndroidApp = useHasAndroidApp(jwt);
  const [dismissal, setDismissal] = useState(readDismissal);
  const [steps, setSteps] = useState(false);
  const offer = installOfferFor(navigator, hasAndroidApp);
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
        <button type="button" data-testid="btn-cerrar-franja" aria-label="Cerrar" onClick={dismiss} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-on-surface-variant"><X size={16} /></button>
      </div>
      <div className="flex justify-end pb-2 pr-2">
        {offer === 'iphone' ? (
          <button type="button" data-testid="btn-franja-instalar" onClick={() => setSteps(true)} className={ACTION}>{words.action}</button>
        ) : (
          <a data-testid="btn-franja-instalar" href={ENLACE_DE_DESCARGA} target="_blank" rel="noreferrer" onClick={dismiss} className={ACTION}>{words.action}</a>
        )}
      </div>
      {steps ? <Overlay title="Instalar en tu iPhone" onClose={() => setSteps(false)}><IphoneInstallSteps /></Overlay> : null}
    </section>
  );
}
