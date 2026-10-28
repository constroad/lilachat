import { useCallback, useEffect, useRef, useState, type ReactElement, type RefObject, type MutableRefObject } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { BottomRoom, useScrollConTeclado } from './useScrollConTeclado';
import { useBottomLiftStyle } from './ChatBottom';
import { contentLift, roomHeld } from './emojiPanel';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { ChevronDown } from 'lucide-react-native';
import type { Row } from './MessageRow';
import { claveDeFila, tipoDeFila } from './filasDelChat';
import { isPending } from './rowKinds';
import { FondoDelChat } from './FondoDelChat';
import { useFinalDeLaConversacion } from './useFinalDeLaConversacion';
import { useColores } from '../ui/tema';
import type { OpeningPlace } from './useDivisorNoLeidos';
import { MAX_HIDDEN_MS, RevealWhenSettled, SETTLE_MS } from './revealWhenSettled';
import { useFunPlayback } from './nudge';

/** The emoji panel's room under the conversation (`emojiPanel`). */
const EMOJI_PANEL_ROOM = { held: roomHeld, lift: contentLift };
/**
 * The list is shown once it is placed (José, 20/10 and 21/10: on entering it
 * painted, then jumped). It waits for its first layout AND for its content
 * height to stop changing (FlashList measures the rows above in a few frames:
 * 1761 → 3157 px), places itself again with the final sizes, and only then
 * shows. Never for the network, and at most `MAX_HIDDEN_MS`.
 */
function useRevealWhenPlaced(hasRows: boolean, onPlaced: () => OpeningPlace, onAway: () => void, viewId = 0) {
  const [revealed, setRevealed] = useState(!hasRows);
  const settle = useRef(new RevealWhenSettled(Date.now()));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const place = useRef(() => undefined as void);
  place.current = () => {
    if (onPlaced() === 'away') onAway();
  };
  const tryReveal = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (settle.current.check(Date.now()) === 'wait') {
      timer.current = setTimeout(tryReveal, SETTLE_MS);
      return;
    }
    place.current();
    requestAnimationFrame(() => requestAnimationFrame(() => setRevealed(true)));
  }, []);
  useEffect(() => {
    if (!hasRows) return setRevealed(true);
    setRevealed(false);
    settle.current = new RevealWhenSettled(Date.now());
    const cap = setTimeout(tryReveal, MAX_HIDDEN_MS);
    return () => {
      clearTimeout(cap);
      if (timer.current) clearTimeout(timer.current);
    };
    // A new view (a window opened or closed, pending 44) hides and places itself again.
  }, [hasRows, tryReveal, viewId]);
  const onLoad = () => {
    place.current();
    settle.current.load(Date.now());
    tryReveal();
  };
  const onSize = (height: number) => {
    if (revealed) return;
    settle.current.size(height, Date.now());
    tryReveal();
  };
  return { revealed, onLoad, onSize };
}

/**
 * La lista de la conversación con su fondo y el botón «bajar» (salió de
 * `ChatScreen`, que pasaba de 780 líneas). Qué dibuja cada fila lo decide la
 * pantalla: acá solo vive cómo se desplaza.
 */
export function ListaDeMensajes(props: {
  listaRef: RefObject<FlashListRef<Row> | null>;
  rows: Row[];
  /** Para contar los que llegaron mientras se leía arriba. */
  mensajes: readonly { seq: number; senderId: string; kind?: string; wink?: string }[];
  yo: string;
  /** Nudges and winks: whose chat it is and what I had read when it opened (`useFunPlayback`). */
  chatId: string;
  readSeqAtOpen: number;
  dibujarFila: (info: { item: Row; index: number }) => ReactElement;
  /** Al terminar de montar: el momento exacto en que la lista ya midió. */
  onListo: () => OpeningPlace;
  /** Grows when the list went to the first unread after opening (they arrived late, 22/10): it stops following the end. */
  placedAwayLate?: number;
  onCargarAnteriores: () => void;
  cargandoAnteriores: boolean;
  hayAnteriores: boolean;
  /** Volvió al final después de haber estado arriba: leyó lo que había. */
  onLlegoAlFinal?: () => void;
  /** Lo que la barra de escribir sube MENOS que el teclado (su margen de la barra de navegación). */
  sinSubir: number;
  /** A window around an old message (pending 44): its own view, paged down too; «bajar» leaves it. */
  ventana?: { viewId: number; inWindow: boolean; onCargarSiguientes: () => void; onIrAlUltimo: () => void };
  /** Searching or a message highlighted: nothing pulls the list to the end (a jump was undone, E2E 22/10). */
  holdPosition?: boolean;
  /** Filled with this list's «stop following the end», for a jump to call before it scrolls. */
  releaseRef?: MutableRefObject<() => void>;
  /** A jump's hold on its message (`useIrAMensaje`): kept when the content changes size, dropped by a finger. */
  anchor?: { keep: () => void; drop: () => void };
}) {
  const colores = useColores();
  const { listaRef, rows } = props;
  const lastRow = rows.at(-1);
  const lastMineKey = !lastRow ? undefined : isPending(lastRow) || String(lastRow.senderId) === props.yo ? claveDeFila(lastRow) : null;
  const { alScrollear, alEmpezarArrastre, alTerminarArrastre, alCambiarTamaño, abajoLejos, nuevosAbajo, releaseFromEnd, goToEnd } = useFinalDeLaConversacion(
    listaRef,
    props.mensajes,
    props.yo,
    lastMineKey,
    props.readSeqAtOpen
  );
  const estuvoArriba = useRef(false);
  const { onLlegoAlFinal } = props;
  useEffect(() => {
    if (abajoLejos) estuvoArriba.current = true;
    else if (estuvoArriba.current) {
      estuvoArriba.current = false;
      onLlegoAlFinal?.();
    }
  }, [abajoLejos, onLlegoAlFinal]);
  // El scroll sigue al teclado como Telegram (ver `useScrollConTeclado`).
  const { sinSubir } = props;
  const scrollDelChat = useScrollConTeclado(sinSubir);
  const { revealed, onLoad, onSize } = useRevealWhenPlaced(rows.length > 0, props.onListo, releaseFromEnd, props.ventana?.viewId);
  const inWindow = props.ventana?.inWindow === true;
  // A placement away from the end, a search or a highlighted message: the list stops following the
  // end. Without it, the row measured while jumping «grew the end» and pulled it back (E2E, 22/10).
  useEffect(() => {
    if (props.placedAwayLate || props.holdPosition) releaseFromEnd();
  }, [props.placedAwayLate, props.holdPosition, releaseFromEnd]);
  if (props.releaseRef) props.releaseRef.current = releaseFromEnd;
  const liftStyle = useBottomLiftStyle(sinSubir);
  useFunPlayback({ messages: props.mensajes, me: props.yo, chatId: props.chatId, afterSeq: props.readSeqAtOpen });
  return (
    <Animated.View style={{ flex: 1 }}>
      <FondoDelChat />
      <View className="flex-1" style={{ opacity: revealed ? 1 : 0 }}>
      <BottomRoom.Provider value={EMOJI_PANEL_ROOM}>
      <FlashList
        /**
         * Se vuelve a montar al pasar de vacía a con filas (18/10, emulador). En
         * frío la lista nace vacía y los mensajes llegan del disco después: con
         * `startRenderingFromBottom`, su scroll inicial y la corrección de
         * posición se pisaban y 2 de cada 3 aperturas quedaban ARRIBA de todo.
         * Montada ya con filas —como al reabrir desde la memoria— abre abajo.
         */
        key={`${rows.length > 0 ? 'con-filas' : 'vacia'}-${props.ventana?.viewId ?? 0}`}
        ref={listaRef}
        renderScrollComponent={scrollDelChat}
        data={rows}
        onLoad={onLoad}
        testID="lista-mensajes"
        /**
         * `flex-1` NO es cosmético: sin él la lista no está acotada por la
         * columna y su borde inferior queda DEBAJO de la barra de escribir. Con
         * pocos mensajes el contenido se ancla al fondo de la lista, o sea
         * tapado: se vio con un grupo cuyo único contenido era un aviso.
         */
        className="flex-1"
        // El scroll hacia arriba trae los mensajes viejos, como WhatsApp. El
        // umbral es 0.5 pantallas: pedirlos recién al tocar el borde deja un
        // hueco visible mientras viajan.
        onStartReached={props.onCargarAnteriores}
        onStartReachedThreshold={0.5}
        // In a window (pending 44) it pages down too, toward the end of the conversation.
        onEndReached={inWindow ? props.ventana?.onCargarSiguientes : undefined}
        onEndReachedThreshold={0.5}
        // `autoscrollToBottomThreshold`: si se está cerca del final (20 % de la
        // pantalla), lo que llega o se manda baja la lista solo, como
        // WhatsApp. Leyendo arriba, no mueve nada.
        maintainVisibleContentPosition={inWindow ? { startRenderingFromBottom: false } : { startRenderingFromBottom: true, ...(props.holdPosition ? {} : { autoscrollToBottomThreshold: 0.2 }) }}
        onScroll={alScrollear}
        onScrollBeginDrag={() => {
          props.anchor?.drop();
          alEmpezarArrastre();
        }}
        onScrollEndDrag={alTerminarArrastre}
        onMomentumScrollBegin={alEmpezarArrastre}
        onMomentumScrollEnd={alTerminarArrastre}
        onContentSizeChange={(width, height) => {
          onSize(height);
          alCambiarTamaño(width, height);
          props.anchor?.keep();
        }}
        scrollEventThrottle={100}
        ListHeaderComponent={
          props.cargandoAnteriores ? (
            <View className="items-center py-3" testID="cargando-anteriores">
              <ActivityIndicator color={colores.primary} />
            </View>
          ) : !props.hayAnteriores && rows.length > 0 ? (
            // El final de la conversación se DICE: sin esto, quien scrollea
            // hasta arriba no sabe si ya vio todo o si falta cargar.
            <Text className="py-3 text-center text-[11px] text-on-surface-variant">
              Este es el principio de la conversación
            </Text>
          ) : null
        }
        keyExtractor={claveDeFila}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
        renderItem={props.dibujarFila}
        getItemType={tipoDeFila}
      />
      </BottomRoom.Provider>
      </View>
      {abajoLejos || inWindow ? (
        // «Bajar al final» con los que llegaron mientras se leía arriba, como
        // WhatsApp. Aparece solo lejos del final: abajo no hace falta. Sube con el teclado.
        <Animated.View style={liftStyle} className="absolute bottom-3 right-3">
        <Pressable
          testID="btn-bajar"
          accessibilityLabel="Ir al último mensaje"
          onPress={inWindow ? props.ventana?.onIrAlUltimo : goToEnd}
          hitSlop={2}
          className="h-10 w-10 items-center justify-center rounded-full bg-surface shadow-md"
        >
          <ChevronDown size={22} color={colores['on-surface-variant']} />
          {nuevosAbajo > 0 ? (
            <View className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1">
              <Text className="text-[11px] font-bold text-on-primary" testID="nuevos-abajo">
                {nuevosAbajo}
              </Text>
            </View>
          ) : null}
        </Pressable>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
