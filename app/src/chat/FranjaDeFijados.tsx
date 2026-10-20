import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Pin } from 'lucide-react-native';
import type { FijadoEnLista } from '../api/client';
import { useColores } from '../ui/tema';

/**
 * La franja del mensaje fijado bajo la cabecera (diseño `fm-app-seleccion.png`),
 * como WhatsApp: tocarla lleva al mensaje y pasa al siguiente fijado; mantenerla
 * ofrece desfijar (si se puede).
 */
export function FranjaDeFijados(props: {
  fijados: FijadoEnLista[];
  textoDe: (fijado: FijadoEnLista) => string;
  puedeDesfijar: boolean;
  onIr: (seq: number) => void;
  onDesfijar: (seq: number) => void;
}) {
  const colores = useColores();
  const [indice, setIndice] = useState(0);
  const total = props.fijados.length;
  useEffect(() => {
    if (indice >= total) setIndice(0);
  }, [indice, total]);
  // Un fijado nuevo se muestra primero (va al principio de la lista).
  const primero = props.fijados[0]?.seq;
  useEffect(() => setIndice(0), [primero]);
  const actual = props.fijados[indice % Math.max(total, 1)];
  if (!actual) return null;

  const opciones = () =>
    Alert.alert('Mensaje fijado', props.textoDe(actual), [
      { text: 'Cancelar', style: 'cancel' },
      ...(props.puedeDesfijar ? [{ text: 'Desfijar', style: 'destructive' as const, onPress: () => props.onDesfijar(actual.seq) }] : []),
      { text: 'Ir al mensaje', onPress: () => props.onIr(actual.seq) },
    ]);

  return (
    <Pressable
      testID="franja-fijados"
      accessibilityLabel={`Mensaje fijado: ${props.textoDe(actual)}`}
      onPress={() => {
        props.onIr(actual.seq);
        setIndice((anterior) => (anterior + 1) % total);
      }}
      onLongPress={opciones}
      className="min-h-[52px] flex-row items-center gap-3 border-b border-outline/10 bg-surface pr-4"
    >
      <View className="w-[3px] self-stretch bg-primary" />
      <Pin size={16} color={colores.primary} />
      <View className="min-w-0 flex-1 py-1.5">
        <Text className="text-[12px] font-semibold text-primary">Mensaje fijado</Text>
        <Text testID="texto-fijado" numberOfLines={1} className="text-sm text-on-surface-variant">
          {props.textoDe(actual)}
        </Text>
      </View>
      {total > 1 ? (
        <Text testID="contador-fijados" className="text-xs tabular-nums text-on-surface-variant">
          {(indice % total) + 1}/{total}
        </Text>
      ) : null}
    </Pressable>
  );
}
