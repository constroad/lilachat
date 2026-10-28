import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type { FlashListRef } from '@shopify/flash-list';
import { isPending, type Row } from './MessageRow';
import { anchorFor, anchoredIndex, type JumpAnchor } from './anchorAfterJump';
import type { OpeningPlace } from './useDivisorNoLeidos';

/** El segundo `scrollToIndex`, cuando la zona ya se midió. */
const SEGUNDO_PASE_MS = 400;
/** Cuánto queda resaltado el mensaje al que se saltó. */
const RESALTADO_MS = 1500;
/** Where the target sits on screen after a jump: a bit above the middle. */
const VIEW_POSITION = 0.4;

/**
 * Llevar la conversación a un mensaje y resaltarlo un momento: la cita (FL9),
 * la búsqueda (FL9d) y el fijado (19/10). Salió de `ChatScreen`, que llegó a
 * las 600 líneas.
 */
export function useIrAMensaje(params: {
  rows: Row[];
  listaRef: MutableRefObject<FlashListRef<Row> | null>;
  irASeq?: number;
  /** Changes with every tap on a notice: with the chat already open, it jumps to `irASeq` again. */
  requestedAt?: number;
  irAlInicio: () => OpeningPlace;
  /** Not on screen: the window around it (pending 44), or why not (it never moves silently). */
  onNoEsta: (texto: string, seq: number) => void;
  /**
   * Before scrolling: the list stops following the end. Android reports a
   * «drag» when the search keyboard opens, with no finger, and the list stuck
   * to the end again and undid the jump (E2E, 22/10).
   */
  releaseFromEnd?: () => void;
}) {
  const { rows, listaRef, irASeq, requestedAt, irAlInicio, onNoEsta, releaseFromEnd } = params;
  const [resaltado, setResaltado] = useState<number | null>(null);

  // The latest rows: the second pass and the anchor look the target up again (rows arrive late after a cold start).
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const anchorRef = useRef<JumpAnchor | null>(null);
  const indexOfSeq = useCallback((seq: number) => rowsRef.current.findIndex((fila) => !isPending(fila) && fila.seq === seq), []);
  const scrollTo = useCallback(
    (index: number) => listaRef.current?.scrollToIndex({ index, animated: false, viewPosition: VIEW_POSITION }),
    [listaRef]
  );

  /** While a jump lasts, the list goes back to its message whenever the rows around it change size. */
  const keepAnchor = useCallback(() => {
    const index = anchoredIndex(anchorRef.current, Date.now(), indexOfSeq);
    if (index === null) anchorRef.current = null;
    else scrollTo(index);
  }, [indexOfSeq, scrollTo]);
  /** A finger on the list: the person is reading, the jump stops holding. */
  const dropAnchor = useCallback(() => {
    anchorRef.current = null;
  }, []);
  const anchor = useMemo(() => ({ keep: keepAnchor, drop: dropAnchor }), [keepAnchor, dropAnchor]);

  const irAMensaje = useCallback(
    (seq: number): boolean => {
      const indice = indexOfSeq(seq);
      if (indice < 0) return false;
      releaseFromEnd?.();
      // At once, not animated: the animation reported its own «drag» while still at the end, and the list
      // stuck to it again (E2E, 22/10). An instant jump leaves the end in one step, like WhatsApp's search.
      scrollTo(indice);
      anchorRef.current = anchorFor(seq, Date.now());
      // Segundo pase: con alturas variables, si esa zona todavía no se midió el
      // primero cae corto o no se mueve (visto en el E2E con el chat recién abierto).
      setTimeout(keepAnchor, SEGUNDO_PASE_MS);
      return true;
    },
    [indexOfSeq, scrollTo, keepAnchor, releaseFromEnd]
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

  // The first run is the opening itself (`alAbrir`); later ones are a notice tapped with this chat already open.
  // Only a new `requestedAt` moves the list (new rows arriving must not drag it back), so the latest values are read from refs.
  const latest = useRef({ irASeq, saltarA });
  latest.current = { irASeq, saltarA };
  const hasOpened = useRef(false);
  useEffect(() => {
    if (!hasOpened.current) {
      hasOpened.current = true;
      return;
    }
    const { irASeq: target, saltarA: jump } = latest.current;
    if (target !== undefined) jump(target, 'Ese mensaje está más arriba: sube para cargarlo.');
  }, [requestedAt]);

  return { irAMensaje, saltarA, alTocarCita, alAbrir, resaltado, anchor };
}
