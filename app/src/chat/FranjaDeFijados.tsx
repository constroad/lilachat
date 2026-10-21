import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { ChevronDown, Pin } from 'lucide-react-native';
import type { FijadoEnLista } from '../api/client';
import { useColores } from '../ui/tema';

/** Cuántos segmentos dibuja la barrita de la izquierda (con más fijados, se recorre de a cinco). */
const SEGMENTOS = 5;

/**
 * La franja del mensaje fijado bajo la cabecera (diseños `fm-app-seleccion` y
 * `f1-app-fijados`): la barrita partida dice cuál de todos es; tocar lleva al
 * mensaje y pasa al siguiente; «1 de 5» con la flecha abre la lista entera;
 * mantener ofrece desfijar (si se puede).
 */
export function FranjaDeFijados(props: {
  fijados: FijadoEnLista[];
  textoDe: (fijado: FijadoEnLista) => string;
  nombreDe: (userId: string) => string;
  puedeDesfijar: boolean;
  onIr: (seq: number) => void;
  onDesfijar: (seq: number) => void;
  onVerTodos: () => void;
}) {
  const colores = useColores();
  const [indice, setIndice] = useState(0);
  const total = props.fijados.length;
  useEffect(() => {
    if (indice >= total) setIndice(0);
  }, [indice, total]);
  // Un fijado nuevo se muestra primero (va al principio de la lista).
  const primero = props.fijados[0]?.seq;
  useEffect(() => {
    setIndice(0);
  }, [primero]);
  const actual = props.fijados[indice % Math.max(total, 1)];
  if (!actual) return null;
  const posicion = indice % total;
  const segmentos = Math.min(total, SEGMENTOS);

  const opciones = () =>
    Alert.alert('Mensaje fijado', props.textoDe(actual), [
      { text: 'Cancelar', style: 'cancel' },
      ...(props.puedeDesfijar ? [{ text: 'Desfijar', style: 'destructive' as const, onPress: () => props.onDesfijar(actual.seq) }] : []),
      { text: 'Ir al mensaje', onPress: () => props.onIr(actual.seq) },
    ]);

  return (
    <Pressable
      testID="franja-fijados"
      accessibilityLabel={`Mensaje fijado ${posicion + 1} de ${total}: ${props.textoDe(actual)}`}
      onPress={() => {
        props.onIr(actual.seq);
        setIndice((anterior) => (anterior + 1) % total);
      }}
      onLongPress={opciones}
      className="min-h-[52px] flex-row items-center gap-3 border-b border-outline/10 bg-surface pl-3"
    >
      <View className="gap-[3px] self-stretch py-2">
        {Array.from({ length: segmentos }, (_, i) => (
          <View key={i} className={`w-[3px] flex-1 rounded-full ${i === posicion % SEGMENTOS ? 'bg-primary' : 'bg-outline/25'}`} />
        ))}
      </View>
      <Pin size={16} color={colores.primary} />
      <Text testID="texto-fijado" numberOfLines={1} className="min-w-0 flex-1 text-sm text-on-surface">
        <Text className="font-semibold">{props.nombreDe(actual.vista.senderId)}</Text>
        <Text className="text-on-surface-variant">{`  ·  ${props.textoDe(actual)}`}</Text>
      </Text>
      <Pressable testID="btn-ver-fijados" accessibilityLabel="Ver todos los fijados" onPress={props.onVerTodos} className="min-h-[52px] flex-row items-center gap-1 pl-2 pr-4">
        {total > 1 ? (
          <Text testID="contador-fijados" className="text-xs tabular-nums text-on-surface-variant">
            {posicion + 1} de {total}
          </Text>
        ) : null}
        <ChevronDown size={18} color={colores['on-surface-variant']} />
      </Pressable>
    </Pressable>
  );
}
