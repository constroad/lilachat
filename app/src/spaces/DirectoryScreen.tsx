import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowLeft, MessageCircle, Search, UserPlus, Users } from 'lucide-react-native';
import { directoryAreas, filterMembers, formatPhoneDisplay, membersLabel, type ClientWorkspace, type ClientWorkspaceMember } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { useOnlineIds } from '../chat/presenceStore';
import { SpaceLogo } from './SpaceSwitcherSheet';
import { MemberAvatar, memberLine, memberName, OnlinePill } from './memberUi';
import { spaceMembers } from './spacesApi';

/**
 * «Directorio» of a space (design `e1-08-directorio`): its active people,
 * searched by name, title, area or phone, by area, each with a button to
 * write to them in the space. As a picker («Nuevo mensaje directo») a tap
 * writes at once.
 */
export function DirectoryScreen(props: { space: ClientWorkspace; jwt: string; myUserId: string; picking?: boolean; onOpenMember: (member: ClientWorkspaceMember) => void; onMessage: (member: ClientWorkspaceMember) => void; onInvite?: () => void; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const online = useOnlineIds();
  const [members, setMembers] = useState<ClientWorkspaceMember[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [area, setArea] = useState<string | null>(null);

  useEffect(() => {
    void spaceMembers(props.jwt, props.space.id).then((response) => (response.ok ? setMembers(response.data.members) : setError(response.message ?? 'No se pudo cargar el directorio.')));
  }, [props.jwt, props.space.id]);
  const people = useMemo(() => (members ?? []).filter((member) => !props.picking || member.userId !== props.myUserId), [members, props.picking, props.myUserId]);
  const chips = useMemo(() => directoryAreas(people), [people]);
  const shown = filterMembers(people, { query, area });

  return (
    <Modal visible animationType="slide" onRequestClose={props.onClose}>
      <View testID="pantalla-directorio" className="flex-1 bg-background" style={{ paddingTop: margins.cabecera }}>
        <View className="flex-row items-center gap-2 border-b border-outline/10 px-3 pb-2">
          <Pressable testID="directorio-volver" onPress={props.onClose} accessibilityLabel="Volver" className="h-11 w-11 items-center justify-center">
            <ArrowLeft size={22} color={colors['on-surface']} />
          </Pressable>
          <SpaceLogo space={props.space} size={34} />
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">{props.space.name}</Text>
            <Text className="text-[18px] font-bold text-on-surface">{props.picking ? 'Nuevo mensaje directo' : 'Directorio'}</Text>
          </View>
          {props.onInvite ? (
            <Pressable testID="directorio-invitar" onPress={props.onInvite} className="min-h-[44px] flex-row items-center gap-1.5 rounded-xl border border-outline/20 px-3">
              <UserPlus size={16} color={colors.primary} />
              <Text className="text-[14px] font-semibold text-on-surface">Invitar</Text>
            </Pressable>
          ) : null}
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: margins.pie + 24 }} keyboardShouldPersistTaps="handled">
          <View className="min-h-[48px] flex-row items-center gap-2 rounded-xl border border-outline/20 bg-surface px-3">
            <Search size={18} color={colors['on-surface-variant']} />
            <TextInput testID="buscar-directorio" value={query} onChangeText={setQuery} placeholder="Buscar por nombre, cargo o área" placeholderTextColor={colors['on-surface-variant']} className="flex-1 text-[15px] text-on-surface" />
          </View>
          {chips.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3" contentContainerStyle={{ gap: 8 }}>
              {chips.map((chip) => (
                <Pressable key={chip.label} testID={`area-${chip.label}`} onPress={() => setArea(chip.area)} className={`min-h-[40px] flex-row items-center gap-1 rounded-xl border px-3 ${area === chip.area ? 'border-primary bg-primary' : 'border-outline/20 bg-surface'}`}>
                  <Text className={`text-[14px] font-semibold ${area === chip.area ? 'text-on-primary' : 'text-on-surface'}`}>{chip.label}</Text>
                  <Text className={`text-[13px] ${area === chip.area ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>{chip.count}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          {error ? <Text className="mt-3 text-[13px] text-error">{error}</Text> : null}
          {members === null && !error ? [0, 1, 2, 3].map((index) => <View key={index} className="mt-3 h-16 rounded-2xl bg-surface-variant" />) : null}
          {members !== null && shown.length === 0 ? <Text className="mt-6 text-center text-[14px] text-on-surface-variant">{query || area ? 'Nadie coincide con la búsqueda.' : 'Todavía no hay nadie más en el espacio.'}</Text> : null}
          {shown.length ? (
            <View className="mt-3 overflow-hidden rounded-2xl border border-outline/15 bg-surface">
              {shown.map((member, index) => {
                const isOnline = Boolean(member.userId && online.has(member.userId));
                return (
                  <Pressable key={member.id} testID={`miembro-${member.phone}`} onPress={() => (props.picking ? props.onMessage(member) : props.onOpenMember(member))} className={`min-h-[68px] flex-row items-center gap-3 px-3 py-2 ${index ? 'border-t border-outline/10' : ''}`}>
                    <MemberAvatar member={member} size={44} online={isOnline} />
                    <View className="min-w-0 flex-1">
                      <View className="flex-row items-center gap-1.5">
                        <Text numberOfLines={1} className="shrink text-[15px] font-bold text-on-surface">{memberName(member)}{member.userId === props.myUserId ? ' (Tú)' : ''}</Text>
                        {isOnline ? <OnlinePill /> : null}
                      </View>
                      {memberLine(member) ? <Text numberOfLines={1} className="text-[13px] text-on-surface-variant">{memberLine(member)}</Text> : null}
                      <Text className="font-mono text-[12px] text-on-surface-variant">{formatPhoneDisplay(member.phone)}</Text>
                    </View>
                    {member.userId && member.userId !== props.myUserId ? (
                      <Pressable testID={`escribir-${member.phone}`} onPress={() => props.onMessage(member)} accessibilityLabel={`Escribir a ${memberName(member)}`} className="h-11 w-11 items-center justify-center">
                        <MessageCircle size={20} color={colors.primary} />
                      </Pressable>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {props.picking ? null : (
            <View className="mt-4 flex-row items-center gap-3 rounded-2xl border border-outline/15 bg-surface p-3">
              <View className="h-11 w-11 items-center justify-center rounded-xl bg-surface-variant"><Users size={20} color={colors['on-surface-variant']} /></View>
              <View className="min-w-0 flex-1">
                <Text className="text-[15px] font-bold text-on-surface">{`Espacio ${props.space.name}`}</Text>
                <Text className="text-[13px] text-on-surface-variant">{`${membersLabel(props.space.members)} activos`}</Text>
              </View>
              {props.space.joinCode ? <Text className="rounded-md border border-primary/30 bg-primary/5 px-2 py-1 font-mono text-[12px] font-bold text-primary">{props.space.joinCode}</Text> : null}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
