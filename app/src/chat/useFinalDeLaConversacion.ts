import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Keyboard, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import type { FlashListRef } from '@shopify/flash-list';

/** Cuánto (en dp) cuenta como «estar abajo» en la conversación. */
const MARGEN_DEL_FINAL = 160;

/**
 * Dónde está la conversación respecto de su final (FL2/FL3).
 *
 * - Con el teclado que se abre la lista se achica y el último mensaje quedaba
 *   debajo del campo: si se estaba abajo, se vuelve abajo; leyendo arriba, no
 *   se toca.
 * - Lejos del final aparece el botón «bajar», con cuántos mensajes de otros
 *   llegaron mientras tanto (por `seq`: el historial viejo que se carga ARRIBA
 *   también alarga la lista y no es «nuevo»).
 */
export function useFinalDeLaConversacion<T>(
  listaRef: RefObject<FlashListRef<T> | null>,
  mensajes: readonly { seq: number; senderId: string }[],
  yo: string
) {
  const cercaDelFinal = useRef(true);
  /** Lejos del final: muestra el botón «bajar». Estado solo al CAMBIAR. */
  const [abajoLejos, setAbajoLejos] = useState(false);
  const alScrollear = useCallback((evento: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = evento.nativeEvent;
    const cerca = contentSize.height - (contentOffset.y + layoutMeasurement.height) < MARGEN_DEL_FINAL;
    cercaDelFinal.current = cerca;
    setAbajoLejos((antes) => (antes === !cerca ? antes : !cerca));
  }, []);

  const [nuevosAbajo, setNuevosAbajo] = useState(0);
  const ultimoSeqVisto = useRef(0);
  useEffect(() => {
    const desde = ultimoSeqVisto.current;
    const llegaron = desde === 0 ? 0 : mensajes.filter((m) => m.seq > desde && m.senderId !== yo).length;
    ultimoSeqVisto.current = mensajes.reduce((max, m) => Math.max(max, m.seq), desde);
    if (!abajoLejos) setNuevosAbajo(0);
    else if (llegaron > 0) setNuevosAbajo((antes) => antes + llegaron);
  }, [mensajes, abajoLejos, yo]);

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (cercaDelFinal.current) listaRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, [listaRef]);

  return { alScrollear, abajoLejos, nuevosAbajo };
}
