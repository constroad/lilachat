import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Modal } from '../../ui/Modal';
import { EllipsisVertical, FileText, X } from 'lucide-react-native';
import { formatChatTimestamp, MAXIMO_DE_FIJADOS, textoDelVencimiento } from '@lilachat/shared';
import type { FijadoEnLista } from '../../api/client';
import { Avatar } from '../../ui/Avatar';
import { useMargenes } from '../../ui/useMargenes';
import { useColores } from '../../ui/tema';

/**
 * Todos los fijados del chat (20/10; diseño `f1-app-fijados`), como la lista
 * de Slack: autor y texto, quién lo fijó y cuánto le queda. Tocar lleva al
 * mensaje; «⋮» ofrece desfijar a quien puede.
 */
export function ListaDeFijados(props: {
  visible: boolean;
  fijados: FijadoEnLista[];
  textoDe: (fijado: FijadoEnLista) => string;
  nombreDe: (userId: string) => string;
  fotoDe: (userId: string) => string | undefined;
  puedeDesfijar: boolean;
  onIr: (seq: number) => void;
  onDesfijar: (seq: number) => void;
  onCerrar: () => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  const ahora = Date.now();
  const opciones = (fijado: FijadoEnLista) =>
    Alert.alert('Mensaje fijado', props.textoDe(fijado), [
      { text: 'Cancelar', style: 'cancel' },
      ...(props.puedeDesfijar ? [{ text: 'Desfijar', style: 'destructive' as const, onPress: () => props.onDesfijar(fijado.seq) }] : []),
      { text: 'Ir al mensaje', onPress: () => ir(fijado.seq) },
    ]);
  const ir = (seq: number) => {
    props.onCerrar();
    props.onIr(seq);
  };
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onCerrar}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onCerrar} accessibilityLabel="Cerrar" />
      <View testID="lista-fijados" className="max-h-[75%] rounded-t-xl bg-surface pt-3" style={{ paddingBottom: margenes.pie }}>
        <View className="mb-2 h-1.5 w-11 self-center rounded-full bg-outline/30" />
        <View className="flex-row items-center gap-2 px-5 pb-2">
          <Text className="text-[18px] font-semibold text-on-surface">Mensajes fijados</Text>
          <View className="rounded-full bg-primary/10 px-2 py-0.5">
            <Text className="text-[13px] font-semibold text-primary">{props.fijados.length}</Text>
          </View>
          <View className="flex-1" />
          <Pressable testID="btn-cerrar-fijados" accessibilityLabel="Cerrar" onPress={props.onCerrar} className="h-11 w-11 items-center justify-center">
            <X size={20} color={colores['on-surface-variant']} />
          </Pressable>
        </View>
        <ScrollView className="border-t border-outline/10">
          {props.fijados.map((fijado) => {
            const autor = props.nombreDe(fijado.vista.senderId);
            return (
              <Pressable key={fijado.seq} testID={`fila-fijado-${fijado.seq}`} onPress={() => ir(fijado.seq)} className="min-h-[64px] flex-row items-center gap-3 border-b border-outline/10 px-5 py-2">
                <Avatar nombre={autor} foto={props.fotoDe(fijado.vista.senderId)} tamano={40} />
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-1">
                    <Text className="text-[15px] font-semibold text-on-surface">{autor}</Text>
                    <Text className="text-on-surface-variant">·</Text>
                    {fijado.vista.mime && !fijado.vista.mime.startsWith('image/') ? <FileText size={14} color={colores.primary} /> : null}
                    <Text numberOfLines={1} className="min-w-0 flex-1 text-[15px] text-on-surface">{props.textoDe(fijado)}</Text>
                  </View>
                  <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>
                    Fijado por {props.nombreDe(fijado.por)} · {textoDelVencimiento(fijado.hasta, ahora)}
                  </Text>
                </View>
                <Text className="text-[12px] text-on-surface-variant">{formatChatTimestamp(fijado.en)}</Text>
                <Pressable testID={`opciones-fijado-${fijado.seq}`} accessibilityLabel="Opciones del fijado" onPress={() => opciones(fijado)} className="h-11 w-8 items-center justify-center">
                  <EllipsisVertical size={18} color={colores['on-surface-variant']} />
                </Pressable>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text className="px-5 py-3 text-center text-[12px] text-on-surface-variant">Se fijan hasta {MAXIMO_DE_FIJADOS} mensajes. Todos los ven.</Text>
      </View>
    </Modal>
  );
}
