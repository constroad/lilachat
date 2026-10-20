import { useEffect, useRef, type ReactElement, type RefObject } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useScrollConTeclado } from './useScrollConTeclado';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { ChevronDown } from 'lucide-react-native';
import type { Row } from './MessageRow';
import { claveDeFila, tipoDeFila } from './filasDelChat';
import { FondoDelChat } from './FondoDelChat';
import { useFinalDeLaConversacion } from './useFinalDeLaConversacion';
import { useColores } from '../ui/tema';

/**
 * La lista de la conversación con su fondo y el botón «bajar» (salió de
 * `ChatScreen`, que pasaba de 780 líneas). Qué dibuja cada fila lo decide la
 * pantalla: acá solo vive cómo se desplaza.
 */
export function ListaDeMensajes(props: {
  listaRef: RefObject<FlashListRef<Row> | null>;
  rows: Row[];
  /** Para contar los que llegaron mientras se leía arriba. */
  mensajes: readonly { seq: number; senderId: string }[];
  yo: string;
  dibujarFila: (info: { item: Row; index: number }) => ReactElement;
  /** Al terminar de montar: el momento exacto en que la lista ya midió. */
  onListo: () => void;
  onCargarAnteriores: () => void;
  cargandoAnteriores: boolean;
  hayAnteriores: boolean;
  /** Volvió al final después de haber estado arriba: leyó lo que había. */
  onLlegoAlFinal?: () => void;
  /** Lo que la barra de escribir sube MENOS que el teclado (su margen de la barra de navegación). */
  sinSubir: number;
}) {
  const colores = useColores();
  const { listaRef, rows } = props;
  const { alScrollear, alEmpezarArrastre, alTerminarArrastre, alCambiarTamaño, abajoLejos, nuevosAbajo } = useFinalDeLaConversacion(
    listaRef,
    props.mensajes,
    props.yo
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
  return (
    <View className="flex-1">
      <FondoDelChat />
      <FlashList
        /**
         * Se vuelve a montar al pasar de vacía a con filas (18/10, emulador). En
         * frío la lista nace vacía y los mensajes llegan del disco después: con
         * `startRenderingFromBottom`, su scroll inicial y la corrección de
         * posición se pisaban y 2 de cada 3 aperturas quedaban ARRIBA de todo.
         * Montada ya con filas —como al reabrir desde la memoria— abre abajo.
         */
        key={rows.length > 0 ? 'con-filas' : 'vacia'}
        ref={listaRef}
        renderScrollComponent={scrollDelChat}
        data={rows}
        onLoad={props.onListo}
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
        // `autoscrollToBottomThreshold`: si se está cerca del final (20 % de la
        // pantalla), lo que llega o se manda baja la lista solo, como
        // WhatsApp. Leyendo arriba, no mueve nada.
        maintainVisibleContentPosition={{ startRenderingFromBottom: true, autoscrollToBottomThreshold: 0.2 }}
        onScroll={alScrollear}
        onScrollBeginDrag={alEmpezarArrastre}
        onScrollEndDrag={alTerminarArrastre}
        onMomentumScrollBegin={alEmpezarArrastre}
        onMomentumScrollEnd={alTerminarArrastre}
        onContentSizeChange={alCambiarTamaño}
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
      {abajoLejos ? (
        // «Bajar al final» con los que llegaron mientras se leía arriba, como
        // WhatsApp. Aparece solo lejos del final: abajo no hace falta. Sube con el teclado.
        <KeyboardStickyView offset={{ closed: 0, opened: sinSubir }} className="absolute bottom-3 right-3">
        <Pressable
          testID="btn-bajar"
          accessibilityLabel="Ir al último mensaje"
          onPress={() => listaRef.current?.scrollToEnd({ animated: true })}
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
        </KeyboardStickyView>
      ) : null}
    </View>
  );
}
