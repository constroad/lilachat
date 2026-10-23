import { Pressable, ScrollView, Text, View } from 'react-native';
import { Check, Minus, Plus } from 'lucide-react-native';
import { listMembership, type ChatList } from '@lilachat/shared';
import { Modal } from '../../ui/Modal';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';

/**
 * «Agregar a lista» for the chats chosen in the chat list (pending 45): each
 * list says whether they are all in it, some, or none. Tapping it puts them
 * all in, or takes them all out when they all were. «Nueva lista» starts one
 * with them. Since R154 the lists are sections (pending 62): putting a chat in
 * one takes it out of the one it was in.
 */
export function AddToListSheet(props: {
  visible: boolean;
  lists: readonly ChatList[];
  chatIds: readonly string[];
  onToggle: (list: ChatList, putIn: boolean) => void;
  onNewList: () => void;
  onClose: () => void;
}) {
  const colors = useColores();
  const margins = useMargenes();
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onClose} accessibilityLabel="Cerrar" />
      <View testID="hoja-agregar-a-lista" className="max-h-[75%] rounded-t-3xl bg-surface px-4 pt-3" style={{ paddingBottom: margins.pie + 8 }}>
        <View className="mb-2 h-1.5 w-11 self-center rounded-full bg-outline/30" />
        <Text className="mb-2 text-lg font-bold text-on-surface">Mover a sección</Text>
        <ScrollView className="flex-shrink">
          {props.lists.map((list) => {
            const membership = listMembership(list, props.chatIds);
            return (
              <Pressable key={list.id} testID={`lista-destino-${list.id}`} onPress={() => props.onToggle(list, membership !== 'all')} accessibilityRole="checkbox" accessibilityState={{ checked: membership === 'all' ? true : membership === 'some' ? 'mixed' : false }} className="min-h-[52px] flex-row items-center gap-3">
                <Text numberOfLines={1} className="flex-1 text-[15px] text-on-surface">{list.name}</Text>
                <Text className="text-[13px] text-on-surface-variant">{list.chatIds.length}</Text>
                <View className={`h-6 w-6 items-center justify-center rounded-md border-2 ${membership === 'none' ? 'border-outline/50' : 'border-primary bg-primary'}`}>
                  {membership === 'all' ? <Check size={14} color={colors['on-primary']} /> : membership === 'some' ? <Minus size={14} color={colors['on-primary']} /> : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable testID="btn-nueva-lista-desde-seleccion" onPress={props.onNewList} className="mt-1 min-h-[52px] flex-row items-center gap-3">
          <View className="h-6 w-6 items-center justify-center rounded-full bg-primary/10">
            <Plus size={16} color={colors.primary} />
          </View>
          <Text className="text-[15px] font-semibold text-primary">Nueva sección</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
