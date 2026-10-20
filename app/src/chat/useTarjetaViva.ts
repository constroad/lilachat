import { useEffect } from 'react';
import { suscribirTarjeta, type TipoDeTarjeta } from '@lilachat/shared';

/** La tarjeta se vuelve a pedir cuando el server avisa que cambió. */
export function useTarjetaViva(tipo: TipoDeTarjeta, id: string, refrescar: () => void): void {
  useEffect(() => suscribirTarjeta(tipo, id, refrescar), [tipo, id, refrescar]);
}
