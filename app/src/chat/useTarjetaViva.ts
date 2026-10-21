import { useEffect } from 'react';
import { suscribirTarjeta, type CardType } from '@lilachat/shared';

/** La tarjeta se vuelve a pedir cuando el server avisa que cambió. */
export function useTarjetaViva(tipo: CardType, id: string, refrescar: () => void): void {
  useEffect(() => suscribirTarjeta(tipo, id, refrescar), [tipo, id, refrescar]);
}
