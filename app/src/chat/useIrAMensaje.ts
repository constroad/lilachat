import { useCallback, useState, type MutableRefObject } from 'react';
import type { FlashListRef } from '@shopify/flash-list';
import { isPending, type Row } from './MessageRow';
import type { OpeningPlace } from './useDivisorNoLeidos';

/** El segundo `scrollToIndex`, cuando la zona ya se midió. */
const SEGUNDO_PASE_MS = 400;
/** Cuánto queda resaltado el mensaje al que se saltó. */
const RESALTADO_MS = 1500;

/**
 * Llevar la conversación a un mensaje y resaltarlo un momento: la cita (FL9),
 * la búsqueda (FL9d) y el fijado (19/10). Salió de `ChatScreen`, que llegó a
 * las 600 líneas.
 */
export function useIrAMensaje(params: {
  rows: Row[];
  listaRef: MutableRefObject<FlashListRef<Row> | null>;
  irASeq?: number;
  irAlInicio: () => OpeningPlace;
  /** Not on screen: the window around it (pending 44), or why not (it never moves silently). */
  onNoEsta: (texto: string, seq: number) => void;
}) {
  const { rows, listaRef, irASeq, irAlInicio, onNoEsta } = params;
  const [resaltado, setResaltado] = useState<number | null>(null);

  const irAMensaje = useCallback(
    (seq: number): boolean => {
      const indice = rows.findIndex((fila) => !isPending(fila) && fila.seq === seq);
      if (indice < 0) return false;
      listaRef.current?.scrollToIndex({ index: indice, animated: true, viewPosition: 0.4 });
      // Segundo pase: con alturas variables, si esa zona todavía no se midió el
      // primero cae corto o no se mueve (visto en el E2E con el chat recién abierto).
      setTimeout(() => listaRef.current?.scrollToIndex({ index: indice, animated: false, viewPosition: 0.4 }), SEGUNDO_PASE_MS);
      return true;
    },
    [rows, listaRef]
  );

  const saltarA = useCallback(
    (seq: number, siNoEsta: string) => {
      if (!irAMensaje(seq)) return onNoEsta(siNoEsta, seq);
      setResaltado(seq);
      setTimeout(() => setResaltado((actual) => (actual === seq ? null : actual)), RESALTADO_MS);
    },
    [irAMensaje, onNoEsta]
  );

  const alTocarCita = useCallback((seq: number) => saltarA(seq, 'El mensaje original está más arriba: sube para cargarlo.'), [saltarA]);

  /** Al abrir: al mensaje buscado si se vino de la búsqueda; si no, al divisor o al final. */
  const alAbrir = useCallback(() => {
    if (irASeq === undefined) return irAlInicio();
    saltarA(irASeq, 'Ese mensaje está más arriba: sube para cargarlo.');
    return 'away' as const;
  }, [irASeq, irAlInicio, saltarA]);

  return { irAMensaje, saltarA, alTocarCita, alAbrir, resaltado };
}
