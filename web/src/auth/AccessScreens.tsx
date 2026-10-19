import { useState } from 'react';
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
  return porQr ? (
    <PantallaDeVincular onReady={onReady} onUsarTelefono={() => setPorQr(false)} />
  ) : (
    <IngresoPorTelefono onReady={onReady} onUsarQr={() => setPorQr(true)} />
  );
}
