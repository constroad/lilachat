import { useState } from 'react';
import { ENLACE_DE_DESCARGA } from '@lilachat/shared';
import { peekPendingJoin } from '../spaces/pendingJoin';
import type { Credential } from '../api';
import { IngresoPorTelefono } from './IngresoPorTelefono';
import { PantallaDeVincular } from './PantallaDeVincular';

/**
 * Las dos puertas de la web (W5): el QR del teléfono, como WhatsApp Web, o el
 * número con su código. En pantalla angosta abre por el número: el QR de un
 * celular no se escanea con ese mismo celular.
 */
const ANCHO_PARA_QR = '(min-width: 768px)';

const abrePorQr = (): boolean => typeof window.matchMedia === 'function' && window.matchMedia(ANCHO_PARA_QR).matches;

export function AccessScreens({ onReady }: { onReady: (credential: Credential) => void }) {
  const [porQr, setPorQr] = useState(abrePorQr);
  const [invited] = useState(() => peekPendingJoin() !== null);
  return (
    <>
      {invited ? <JoinLinkBanner /> : null}
      {porQr ? <PantallaDeVincular onReady={onReady} onUsarTelefono={() => setPorQr(false)} /> : <IngresoPorTelefono onReady={onReady} onUsarQr={() => setPorQr(true)} />}
    </>
  );
}

/** Someone opened a space's invitation here (pending 47): on a phone, the app; here, after entering, the space. */
function JoinLinkBanner() {
  return (
    <div data-testid="aviso-invitacion" className="mx-auto mt-4 flex w-[calc(100%-32px)] max-w-md flex-col gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
      <p className="font-semibold">Te invitaron a un espacio de Lilachat.</p>
      <p className="text-on-surface-variant">En el teléfono, descarga la app y vuelve a tocar el enlace. Aquí, entra con tu número y te unes al espacio.</p>
      <a href={ENLACE_DE_DESCARGA} className="self-start font-semibold text-primary underline-offset-2 hover:underline">Descargar Lilachat</a>
    </div>
  );
}
