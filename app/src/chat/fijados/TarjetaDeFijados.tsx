import { Pressable, Text, View } from 'react-native';
import { Pin } from 'lucide-react-native';
import { formatChatTimestamp } from '@lilachat/shared';
import type { FijadoEnLista } from '../../api/client';
import { useColores } from '../../ui/tema';

/** Cuántos se ven en la tarjeta; el resto, en «Ver los N fijados». */
const VISIBLES = 3;

/**
 * «Mensajes fijados · 5» en la info del chat (20/10; diseño
 * `f1-app-info-fijados`): los tres más recientes y el enlace a la lista.
 */
export function TarjetaDeFijados(props: { fijados: FijadoEnLista[]; textoDe: (fijado: FijadoEnLista) => string; nombreDe: (userId: string) => string; onVerTodos: () => void }) {
  const colores = useColores();
  if (props.fijados.length === 0) return null;
  return (
    <View testID="tarjeta-fijados" className="mx-4 mt-4 rounded-xl border border-outline/10 bg-surface px-4 pt-3">
      <View className="flex-row items-center gap-2 pb-2">
        <Pin size={16} color={colores.primary} />
        <Text className="text-[15px] font-semibold text-on-surface">Mensajes fijados</Text>
        <View className="rounded-full bg-primary/10 px-2 py-0.5">
          <Text className="text-[12px] font-semibold text-primary">{props.fijados.length}</Text>
        </View>
      </View>
      {props.fijados.slice(0, VISIBLES).map((fijado) => (
        <View key={fijado.seq} className="min-h-[44px] flex-row items-center gap-3 border-t border-outline/10">
          <Pin size={14} color={colores.primary} />
          <Text numberOfLines={1} className="min-w-0 flex-1 text-[14px] text-on-surface">
            <Text className="font-semibold">{props.nombreDe(fijado.vista.senderId)}: </Text>
            {props.textoDe(fijado)}
          </Text>
          <Text className="text-[12px] text-on-surface-variant">{formatChatTimestamp(fijado.en)}</Text>
        </View>
      ))}
      <Pressable testID="btn-ver-todos-fijados" onPress={props.onVerTodos} className="min-h-[44px] items-center justify-center border-t border-outline/10">
        <Text className="text-[14px] font-semibold text-primary">{props.fijados.length > VISIBLES ? `Ver los ${props.fijados.length} fijados` : 'Ver fijados'}</Text>
      </Pressable>
    </View>
  );
}
