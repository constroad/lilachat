import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Keyboard, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import type { FlashListRef } from '@shopify/flash-list';
import { PosicionEnLaLista } from './finalDeLaConversacion';

/**
 * Dónde está la conversación respecto de su final (FL2/FL3).
 *
 * - Con el teclado que se abre la lista se achica y el último mensaje quedaba
 *   debajo del campo: si se estaba abajo, se vuelve abajo; leyendo arriba, no
 *   se toca.
 * - Lejos del final aparece el botón «bajar», con cuántos mensajes de otros
 *   llegaron mientras tanto (por `seq`: el historial viejo que se carga ARRIBA
 *   también alarga la lista y no es «nuevo»).
 * - Cuánto falta para el final lo decide `PosicionEnLaLista`: el alto del
 *   contenido sale de la medición, no del evento de scroll (que llega atrasado).
 */
export function useFinalDeLaConversacion<T>(
  listaRef: RefObject<FlashListRef<T> | null>,
  mensajes: readonly { seq: number; senderId: string }[],
  yo: string
) {
  const cercaDelFinal = useRef(true);
  const [posicion] = useState(() => new PosicionEnLaLista());
  /** Lejos del final: muestra el botón «bajar». Estado solo al CAMBIAR. */
  const [abajoLejos, setAbajoLejos] = useState(false);
  const fijarCerca = useCallback((cerca: boolean) => {
    cercaDelFinal.current = cerca;
    setAbajoLejos((antes) => (antes === !cerca ? antes : !cerca));
  }, []);
  const alScrollear = useCallback(
    (evento: EventoDeScroll) => fijarCerca(posicion.alScrollear(medidasDe(evento))),
    [fijarCerca, posicion]
  );
  /** Solo el dedo despega la lista del final (19/10): estos dicen cuándo es el dedo. */
  const alEmpezarArrastre = useCallback(() => posicion.alEmpezarArrastre(), [posicion]);
  const alTerminarArrastre = useCallback(
    (evento: EventoDeScroll) => fijarCerca(posicion.alTerminarArrastre(medidasDe(evento))),
    [fijarCerca, posicion]
  );
  const alCambiarTamaño = useCallback(
    (_ancho: number, alto: number) => {
      const decision = posicion.alCambiarTamaño(alto);
      // Lo de abajo creció estando abajo: se sigue al final, como WhatsApp. Un
      // cuadro DESPUÉS: en el mismo evento la lista todavía no acomodó el alto
      // nuevo y el salto no hacía nada (emulador, 19/10: quedaba en 8 dp).
      if (decision === 'seguir') requestAnimationFrame(() => listaRef.current?.scrollToEnd({ animated: false }));
      if (decision) fijarCerca(true);
    },
    [fijarCerca, posicion, listaRef]
  );

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

  /** Placed away from the end by the program (the unread divider): do not follow the end until the person gets there. */
  const releaseFromEnd = useCallback(() => {
    posicion.releaseFromEnd();
    cercaDelFinal.current = false;
  }, [posicion]);

  return { alScrollear, alEmpezarArrastre, alTerminarArrastre, alCambiarTamaño, abajoLejos, nuevosAbajo, releaseFromEnd };
}

type EventoDeScroll = NativeSyntheticEvent<NativeScrollEvent>;

function medidasDe(evento: EventoDeScroll) {
  const { contentOffset, contentSize, layoutMeasurement } = evento.nativeEvent;
  return { offset: contentOffset.y, alto: layoutMeasurement.height, contenido: contentSize.height };
}
