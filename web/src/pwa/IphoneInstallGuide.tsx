import { useState, type ReactNode } from 'react';
import { Download, Share, Smartphone, SquarePlus } from 'lucide-react';
import { ENLACE_DE_DESCARGA } from '@lilachat/shared';
import { Overlay } from '../ui/Overlay';
import { installOfferFor } from './installOffer';
import { useInstallPrompt } from './installPrompt';
import { isOutsideSafari, needsIosInstall } from './iosInstall';
import { useHasAndroidApp } from './useHasAndroidApp';

const STEPS: { Icon: typeof Share; title: string; hint: string }[] = [
  { Icon: Share, title: 'Toca Compartir en Safari', hint: 'Es el cuadrado con la flecha hacia arriba. Si no lo ves, toca primero «…» junto a la dirección.' },
  { Icon: SquarePlus, title: 'Elige «Añadir a pantalla de inicio»', hint: 'Si no aparece, baja en la lista o toca «Ver más». Deja encendido abrir como app web.' },
  { Icon: Smartphone, title: 'Abre Lilachat desde el ícono nuevo', hint: 'Entra ahí con tu correo o tu número: lo que hagas en Safari no pasa a la app.' },
];

/** The three steps: Safari's own menu, no prompt exists on iPhone. */
export function IphoneInstallSteps() {
  return (
    <>
      {isOutsideSafari() ? <p data-testid="aviso-abrir-en-safari" className="mb-3 rounded-xl bg-primary/10 p-3 text-sm font-semibold">Abre esta página en Safari para instalarla.</p> : null}
      <ol className="flex flex-col gap-3">
        {STEPS.map(({ Icon, title, hint }, index) => (
          <li key={title} data-testid={`paso-iphone-${index + 1}`} className="flex items-start gap-3 rounded-xl border border-outline/15 bg-surface p-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Icon size={20} /></span>
            <span className="min-w-0"><span className="block text-sm font-semibold">{`${index + 1}. ${title}`}</span><span className="block text-[13px] text-on-surface-variant">{hint}</span></span>
          </li>
        ))}
      </ol>
    </>
  );
}

/** Before signing in (José 05/11): Safari's session does not reach the installed app, so installing comes first. */
export function IphoneInstallGuide({ onSkip }: { onSkip: () => void }) {
  return (
    <main data-testid="guia-iphone" className="mx-auto flex min-h-full w-full max-w-md flex-col gap-4 px-4 py-8">
      <header>
        <img src="/icons/icon-192.png" alt="" className="mb-4 h-14 w-14 rounded-2xl" />
        <h1 className="text-xl font-bold tracking-tight">Instala Lilachat en tu iPhone</h1>
        <p className="mt-1 text-sm text-on-surface-variant">Se abre como una app y te llegan los avisos. Solo se hace una vez.</p>
      </header>
      <IphoneInstallSteps />
      <button type="button" data-testid="btn-seguir-en-safari" onClick={onSkip} className="min-h-[44px] text-sm font-semibold text-primary">Seguir en el navegador, sin avisos</button>
    </main>
  );
}

const ROW = 'flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-background';

/** Ajustes, always there when the strip is gone: the browser's own prompt where it exists; on iPhone, the guide; an Android phone without it, the APK. */
export function InstallRow({ jwt, onDone }: { jwt: string; onDone: () => void }): ReactNode {
  const { canInstall, install } = useInstallPrompt();
  const hasAndroidApp = useHasAndroidApp(jwt);
  const [guide, setGuide] = useState(false);
  if (needsIosInstall()) {
    return (
      <>
        <button type="button" data-testid="btn-instalar-iphone" onClick={() => setGuide(true)} className={ROW}><Download size={16} />Instalar en tu iPhone</button>
        {guide ? <Overlay title="Instalar en tu iPhone" onClose={() => setGuide(false)}><IphoneInstallSteps /></Overlay> : null}
      </>
    );
  }
  if (installOfferFor(navigator, hasAndroidApp, canInstall) === 'android') {
    return <a data-testid="btn-descargar-apk" href={ENLACE_DE_DESCARGA} target="_blank" rel="noreferrer" onClick={onDone} className={ROW}><Download size={16} />Descargar la app de Lilachat</a>;
  }
  if (!canInstall) return null;
  return <button type="button" data-testid="btn-instalar" onClick={() => void install().then(onDone)} className={ROW}><Download size={16} />Instalar Lilachat en este dispositivo</button>;
}
