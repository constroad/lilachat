import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Check, Search, Trash2, X } from 'lucide-react-native';
import { CHAT_LIST_NAME_MAX, chatListNameError, type ChatList } from '@lilachat/shared';
import { Modal } from '../../ui/Modal';
import { Avatar } from '../../ui/Avatar';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import type { ListOutcome } from './useChatLists';

export type ListChat = { id: string; title: string; photo?: string | null };

/** Without accents and in lower case: «jose» finds «José», like the chat search. */
const key = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Create or edit a list of my own (pending 45): its name and its chats, like
 * WhatsApp's «Nueva lista». A new list can start with the chats chosen in the
 * chat list. Deleting a list never deletes its chats.
 */
export function ChatListEditor(props: {
  visible: boolean;
  /** null: a new list. */
  list: ChatList | null;
  lists: readonly ChatList[];
  chats: readonly ListChat[];
  initialChatIds?: readonly string[];
  onSave: (name: string, chatIds: string[]) => Promise<ListOutcome>;
  onDelete?: () => Promise<ListOutcome>;
  onClose: () => void;
}) {
  const colors = useColores();
  const margins = useMargenes();
  const { visible, list, initialChatIds } = props;
  const [name, setName] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // The sheet lives mounted behind the list: each opening starts from its list.
  useEffect(() => {
    if (!visible) return;
    setName(list?.name ?? '');
    setChosen(list ? [...list.chatIds] : [...(initialChatIds ?? [])]);
    setSearch('');
    setError('');
  }, [visible, list, initialChatIds]);

  const shown = useMemo(() => {
    const needle = key(search.trim());
    const matching = props.chats.filter((chat) => !needle || key(chat.title).includes(needle));
    // The chats already in the list first, like WhatsApp.
    return [...matching.filter((chat) => chosen.includes(chat.id)), ...matching.filter((chat) => !chosen.includes(chat.id))];
  }, [props.chats, search, chosen]);

  const toggle = (chatId: string) => setChosen((current) => (current.includes(chatId) ? current.filter((id) => id !== chatId) : [...current, chatId]));

  const save = async () => {
    const invalid = chatListNameError(name, props.lists, list?.id);
    if (invalid) return setError(invalid);
    setSaving(true);
    const outcome = await props.onSave(name.trim(), chosen);
    setSaving(false);
    if (outcome.ok) props.onClose();
    else setError(outcome.message);
  };

  const confirmDelete = () =>
    Alert.alert('¿Eliminar la lista?', 'Los chats no se borran: solo dejan de estar en esta lista.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => void props.onDelete?.().then((outcome) => (outcome.ok ? props.onClose() : setError(outcome.message))),
      },
    ]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onClose} accessibilityLabel="Cerrar" />
      <View testID="editor-de-lista" className="max-h-[90%] rounded-t-3xl bg-surface px-4 pt-3" style={{ paddingBottom: margins.pie + 8 }}>
        <View className="mb-2 h-1.5 w-11 self-center rounded-full bg-outline/30" />
        <View className="mb-3 flex-row items-center">
          <Text className="flex-1 text-lg font-bold text-on-surface">{list ? 'Editar lista' : 'Nueva lista'}</Text>
          <Pressable testID="btn-cerrar-editor-de-lista" accessibilityLabel="Cerrar" onPress={props.onClose} className="h-11 w-11 items-center justify-center">
            <X size={20} color={colors['on-surface-variant']} />
          </Pressable>
        </View>
        <TextInput
          testID="campo-nombre-de-lista"
          value={name}
          onChangeText={(text) => {
            setName(text);
            setError('');
          }}
          maxLength={CHAT_LIST_NAME_MAX}
          placeholder="Nombre, por ejemplo Familia"
          placeholderTextColor={colors['on-surface-variant']}
          className="min-h-[48px] rounded-xl border border-outline/30 px-4 text-[15px] text-on-surface"
        />
        {error ? <Text testID="error-de-lista" className="mt-1.5 text-[13px] text-error">{error}</Text> : null}
        <View className="mb-1 mt-4 flex-row items-center gap-2 rounded-full bg-primary/[0.07] px-4">
          <Search size={16} color={colors.primary} />
          <TextInput testID="buscar-chats-de-lista" value={search} onChangeText={setSearch} placeholder="Buscar chats" placeholderTextColor={colors['on-surface-variant']} className="min-h-[40px] flex-1 text-[14px] text-on-surface" />
        </View>
        <Text className="mb-1 mt-2 text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant">
          {chosen.length === 1 ? '1 chat elegido' : `${chosen.length} chats elegidos`}
        </Text>
        <ScrollView className="flex-shrink" keyboardShouldPersistTaps="handled">
          {shown.map((chat) => {
            const inside = chosen.includes(chat.id);
            return (
              <Pressable key={chat.id} testID={`chat-de-lista-${chat.id}`} onPress={() => toggle(chat.id)} accessibilityRole="checkbox" accessibilityState={{ checked: inside }} className="min-h-[56px] flex-row items-center gap-3">
                <Avatar nombre={chat.title} foto={chat.photo} tamano={40} />
                <Text numberOfLines={1} className="flex-1 text-[15px] text-on-surface">{chat.title}</Text>
                <View className={`h-6 w-6 items-center justify-center rounded-md border-2 ${inside ? 'border-primary bg-primary' : 'border-outline/50'}`}>
                  {inside ? <Check size={14} color={colors['on-primary']} /> : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable testID="btn-guardar-lista" disabled={saving} onPress={() => void save()} className={`mt-3 min-h-[48px] items-center justify-center rounded-full bg-primary ${saving ? 'opacity-60' : ''}`}>
          <Text className="text-sm font-semibold text-on-primary">{saving ? 'Guardando…' : 'Guardar'}</Text>
        </Pressable>
        {list && props.onDelete ? (
          <Pressable testID="btn-eliminar-lista" onPress={confirmDelete} className="mt-1 min-h-[48px] flex-row items-center justify-center gap-2">
            <Trash2 size={16} color={colors.error} />
            <Text className="text-sm font-semibold text-error">Eliminar lista</Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}
