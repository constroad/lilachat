import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowLeft, CircleCheck, Circle, Search } from 'lucide-react-native';
import { filterMembers, type ClientWorkspace, type ClientWorkspaceMember } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { MemberAvatar, memberLine, memberName } from './memberUi';
import { createSpaceChat, spaceMembers } from './spacesApi';

const NAME_MAX = 60;

/**
 * A group INSIDE the space (the «+» of GRUPOS): its name and who is in, among
 * the space's active people. It opens at once in the Slack format.
 */
export function NewSpaceGroupScreen(props: { space: ClientWorkspace; jwt: string; myUserId: string; onCreated: (chat: { id: string; name: string; memberIds: string[] }) => void; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const [members, setMembers] = useState<ClientWorkspaceMember[] | null>(null);
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void spaceMembers(props.jwt, props.space.id).then((response) => (response.ok ? setMembers(response.data.members.filter((member) => member.userId && member.userId !== props.myUserId)) : setError(response.message ?? 'No se pudo cargar el espacio.')));
  }, [props.jwt, props.space.id, props.myUserId]);
  const toggle = (userId: string) => setChosen((before) => {
    const next = new Set(before);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    return next;
  });
  const clean = name.trim();
  const create = async () => {
    if (!clean || chosen.size === 0 || busy) return;
    setBusy(true);
    const memberIds = [...chosen];
    const response = await createSpaceChat(props.jwt, props.space.id, { kind: 'group', name: clean, memberIds });
    setBusy(false);
    if (!response.ok) return setError(response.message ?? 'No se pudo crear el grupo.');
    props.onCreated({ id: response.data.chatId, name: clean, memberIds: [props.myUserId, ...memberIds] });
  };

  return (
    <Modal visible animationType="slide" onRequestClose={props.onClose}>
      <View testID="pantalla-grupo-espacio" className="flex-1 bg-background" style={{ paddingTop: margins.cabecera }}>
        <View className="flex-row items-center gap-2 border-b border-outline/10 px-3 pb-2">
          <Pressable testID="grupo-espacio-volver" onPress={props.onClose} accessibilityLabel="Volver" className="h-11 w-11 items-center justify-center">
            <ArrowLeft size={22} color={colors['on-surface']} />
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-[11px] font-bold uppercase tracking-widest text-primary">{props.space.name}</Text>
            <Text className="text-[18px] font-bold text-on-surface">Nuevo grupo</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <Text className="mb-1.5 text-[12px] font-bold uppercase tracking-widest text-on-surface">Nombre del grupo</Text>
          <TextInput testID="input-nombre-grupo-espacio" value={name} onChangeText={setName} maxLength={NAME_MAX} placeholder="Compras de obra" placeholderTextColor={colors['on-surface-variant']} className="min-h-[52px] rounded-xl border border-outline/25 bg-surface px-3 text-[16px] text-on-surface" />
          <Text className="mb-1.5 mt-4 text-[12px] font-bold uppercase tracking-widest text-on-surface">{`Personas (${chosen.size})`}</Text>
          <View className="min-h-[48px] flex-row items-center gap-2 rounded-xl border border-outline/20 bg-surface px-3">
            <Search size={18} color={colors['on-surface-variant']} />
            <TextInput testID="buscar-grupo-espacio" value={query} onChangeText={setQuery} placeholder="Buscar por nombre, cargo o área" placeholderTextColor={colors['on-surface-variant']} className="flex-1 text-[15px] text-on-surface" />
          </View>
          {error ? <Text className="mt-3 text-[13px] text-error">{error}</Text> : null}
          {members === null && !error ? [0, 1, 2].map((index) => <View key={index} className="mt-3 h-14 rounded-2xl bg-surface-variant" />) : null}
          {members !== null && members.length === 0 ? <Text className="mt-6 text-center text-[14px] text-on-surface-variant">Todavía no hay nadie más en el espacio: invita a tu equipo.</Text> : null}
          {filterMembers(members ?? [], { query, area: null }).map((member) => {
            const on = chosen.has(member.userId!);
            return (
              <Pressable key={member.id} testID={`elegir-${member.phone}`} onPress={() => toggle(member.userId!)} accessibilityState={{ selected: on }} className="min-h-[60px] flex-row items-center gap-3 border-b border-outline/10">
                <MemberAvatar member={member} size={40} online={false} />
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-[15px] font-semibold text-on-surface">{memberName(member)}</Text>
                  {memberLine(member) ? <Text numberOfLines={1} className="text-[13px] text-on-surface-variant">{memberLine(member)}</Text> : null}
                </View>
                {on ? <CircleCheck size={22} color={colors.primary} /> : <Circle size={22} color={colors.outline} />}
              </Pressable>
            );
          })}
        </ScrollView>
        <View className="border-t border-outline/10 px-4 pt-3" style={{ paddingBottom: margins.pie + 12 }}>
          <Pressable testID="crear-grupo-espacio" disabled={!clean || chosen.size === 0 || busy} onPress={() => void create()} className={`min-h-[54px] items-center justify-center rounded-2xl bg-primary ${!clean || chosen.size === 0 || busy ? 'opacity-50' : ''}`}>
            <Text className="text-[17px] font-bold text-on-primary">{busy ? 'Creando…' : 'Crear grupo'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
