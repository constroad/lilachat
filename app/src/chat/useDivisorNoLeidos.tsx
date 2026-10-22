import { useCallback, useRef, useState, useEffect, type RefObject } from 'react';
import { Text, View } from 'react-native';
import type { FlashListRef } from '@shopify/flash-list';
import { divisorDesdeLeido, seqDelDivisor } from './divisorNoLeidos';
import { isPending, type Row } from './MessageRow';

/** Where the list was placed on opening: at the end, or away from it (the unread divider, a searched message). */
export type OpeningPlace = 'end' | 'away';

/**
 * «N mensajes no leídos» y abrir el chat AHÍ, no abajo (FL9; auditoría §46.2).
 *
 * Los no leídos se toman al ABRIR: si se recalcularan, el divisor saltaría
 * mientras se lee y marcar leído lo haría desaparecer de golpe. Se queda hasta
 * salir del chat, como en WhatsApp.
 */
export function useDivisorNoLeidos(params: {
  rows: Row[];
  yo: string;
  noLeidos: number;
  /** Hasta dónde había leído al abrir (del server); sin él, se cuenta desde el final. */
  leidoHasta?: number;
  listaRef: RefObject<FlashListRef<Row> | null>;
}): { divisorSeq: number | null; noLeidos: number; irAlInicio: () => OpeningPlace; placedLate: number } {
  const noLeidosAlAbrir = useRef(params.noLeidos).current;
  const leidoAlAbrir = useRef(params.leidoHasta).current;
  const [divisorSeq, setDivisorSeq] = useState<number | null>(null);
  const [cantidad, setCantidad] = useState(noLeidosAlAbrir);
  const calculado = useRef<number | null | undefined>(undefined);
  const rowsRef = useRef(params.rows);
  rowsRef.current = params.rows;

  const calcular = useCallback((): number | null => {
    if (calculado.current !== undefined) return calculado.current;
    const filas = rowsRef.current.filter((fila) => !isPending(fila)) as { seq: number; senderId: string; kind?: string }[];
    if (filas.length === 0) return null;
    if (noLeidosAlAbrir > 0 && typeof leidoAlAbrir === 'number') {
      const divisor = divisorDesdeLeido(filas, params.yo, leidoAlAbrir);
      // The unread were not on the phone yet (José, 22/10: it opened at the end): wait for them, do not freeze «none».
      if (!divisor) return null;
      calculado.current = divisor.seq;
      setCantidad(divisor.cantidad);
    } else calculado.current = seqDelDivisor(filas, params.yo, noLeidosAlAbrir);
    return calculado.current;
  }, [params.yo, noLeidosAlAbrir, leidoAlAbrir]);

  /** The first placement went to the end because the unread had not arrived: when they do, the list goes there once. */
  const placedAtEndWaiting = useRef(false);
  const [placedLate, setPlacedLate] = useState(0);
  const hayFilas = params.rows.length > 0;
  useEffect(() => {
    if (!hayFilas || calculado.current !== undefined) return;
    const seq = calcular();
    setDivisorSeq(seq);
    if (seq === null || !placedAtEndWaiting.current) return;
    placedAtEndWaiting.current = false;
    const indice = rowsRef.current.findIndex((fila) => !isPending(fila) && fila.seq === seq);
    if (indice < 0) return;
    params.listaRef.current?.scrollToIndex({ index: indice, animated: false, viewPosition: 0.15 });
    setPlacedLate((count) => count + 1);
  }, [hayFilas, params.rows.length, calcular, params.listaRef]);

  /** Al primer pintado: al divisor si hay no leídos; si no, al final. */
  const irAlInicio = useCallback(() => {
    const seq = calcular();
    const indice = seq === null ? -1 : rowsRef.current.findIndex((fila) => !isPending(fila) && fila.seq === seq);
    if (indice >= 0) {
      params.listaRef.current?.scrollToIndex({ index: indice, animated: false, viewPosition: 0.15 });
      return 'away';
    }
    params.listaRef.current?.scrollToEnd({ animated: false });
    placedAtEndWaiting.current = calculado.current === undefined && noLeidosAlAbrir > 0;
    return 'end';
  }, [calcular, params.listaRef, noLeidosAlAbrir]);

  return { divisorSeq, noLeidos: cantidad, irAlInicio, placedLate };
}

export function DivisorNoLeidos({ cantidad }: { cantidad: number }) {
  return (
    <View className="my-2 items-center bg-primary/[0.06] py-1.5" testID="divisor-no-leidos">
      <Text className="text-[12px] font-semibold text-primary">
        {cantidad === 1 ? '1 mensaje no leído' : `${cantidad} mensajes no leídos`}
      </Text>
    </View>
  );
}
