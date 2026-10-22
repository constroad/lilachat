import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowLeft, MoreVertical, Search, UserPlus, X } from 'lucide-react-native';
import { changeForAction, filterMembers, formatPhoneDisplay, memberActions, type ClientWorkspace, type ClientWorkspaceMember, type MemberAction } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { Segmentado } from '../ui/Segmentado';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { useOnlineIds } from '../chat/presenceStore';
import { SpaceLogo } from './SpaceSwitcherSheet';
import { MemberAvatar, memberLine, memberName, OnlinePill, RolePill } from './memberUi';
import { MemberActionsSheet } from './MemberActionsSheet';
import { RequestCard } from './RequestCard';
import { changeMember, rejectRequest, revokeSpaceInvite, spaceMembers } from './spacesApi';

export type MembersTab = 'active' | 'pending' | 'invited' | 'deactivated';
type Lists = Record<MembersTab, ClientWorkspaceMember[]>;

/**
 * «Miembros y roles» (design `e1-10-miembros-roles`), for admins: Activos ·
 * Pendientes · Desactivados with their counts; each active or deactivated
 * person with their role and a ⋮ to change it, deactivate or reactivate; the
 * pending ones as request cards to approve with an area and title (design
 * `e1-11-solicitudes`). Every change asks the lists again.
 */
export function MembersScreen(props: { space: ClientWorkspace; jwt: string; myUserId: string; initialTab: MembersTab; onInvite: () => void; onChanged: () => void; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const online = useOnlineIds();
  const { space, jwt } = props;
  const [tab, setTab] = useState<MembersTab>(props.initialTab);
  const [lists, setLists] = useState<Lists | null>(null);
  const [query, setQuery] = useState('');
  const [acting, setActing] = useState<ClientWorkspaceMember | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [active, pending, invited, deactivated] = await Promise.all((['active', 'pending', 'invited', 'deactivated'] as const).map((status) => spaceMembers(jwt, space.id, status)));
    if (active?.ok && pending?.ok && invited?.ok && deactivated?.ok) setLists({ active: active.data.members, pending: pending.data.members, invited: invited.data.members, deactivated: deactivated.data.members });
    else setError('No se pudieron cargar los miembros.');
  }, [jwt, space.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const after = async (work: Promise<{ ok: boolean; message?: string }>) => {
    setBusy(true);
    const response = await work;
    setBusy(false);
    if (!response.ok) return setError(response.message ?? 'No se pudo guardar.');
    setError('');
    props.onChanged();
    await load();
  };
  const runAction = (member: ClientWorkspaceMember, action: MemberAction) => {
    setActing(null);
    const apply = () => void after(changeMember(jwt, space.id, member.id, changeForAction(action)));
    if (action !== 'deactivate') return apply();
    Alert.alert(`¿Desactivar a ${memberName(member)}?`, 'Deja de ver los canales y chats del espacio. Sus chats personales siguen igual.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Desactivar', style: 'destructive', onPress: apply }]);
  };
  const me = lists?.active.find((member) => member.userId === props.myUserId);
  const shown = filterMembers(lists?.[tab] ?? [], { query, area: null });

  return (
    <Modal visible animationType="slide" onRequestClose={props.onClose}>
      <View testID="pantalla-miembros" className="flex-1 bg-background" style={{ paddingTop: margins.cabecera }}>
        <View className="flex-row items-center gap-2 border-b border-outline/10 px-3 pb-2">
          <Pressable testID="miembros-volver" onPress={props.onClose} accessibilityLabel="Volver" className="h-11 w-11 items-center justify-center">
            <ArrowLeft size={22} color={colors['on-surface']} />
          </Pressable>
          <SpaceLogo space={space} size={34} />
          <View className="min-w-0 flex-1">
            <Text className="text-[11px] font-bold uppercase tracking-widest text-primary">Administración</Text>
            <Text numberOfLines={1} className="text-[17px] font-bold text-on-surface">{space.name}</Text>
          </View>
          <Pressable testID="miembros-invitar" onPress={props.onInvite} className="min-h-[44px] flex-row items-center gap-1.5 rounded-xl bg-primary px-3">
            <UserPlus size={16} color={colors['on-primary']} />
            <Text className="text-[14px] font-bold text-on-primary">Invitar</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: margins.pie + 24 }} keyboardShouldPersistTaps="handled">
          <Text className="text-[11px] font-bold uppercase tracking-widest text-primary">Gestión de accesos</Text>
          <Text className="mb-3 text-[24px] font-bold text-on-surface">{tab === 'pending' ? 'Solicitudes para entrar' : 'Miembros y roles'}</Text>
          <Segmentado<MembersTab>
            opciones={[
              { key: 'active', etiqueta: 'Activos', testID: 'tab-activos', cuenta: lists?.active.length },
              { key: 'pending', etiqueta: 'Pendientes', testID: 'tab-pendientes', cuenta: lists?.pending.length },
              { key: 'invited', etiqueta: 'Invitados', testID: 'tab-invitados', cuenta: lists?.invited.length },
              { key: 'deactivated', etiqueta: 'Desactivados', testID: 'tab-desactivados', cuenta: lists?.deactivated.length },
            ]}
            valor={tab}
            onCambiar={setTab}
          />
          {tab === 'pending' ? (
            <Text className="mt-3 text-[14px] text-on-surface-variant">{`Quienes entraron con el código de ${space.name} y esperan tu aprobación para ver los canales.`}</Text>
          ) : (
            <View className="mt-3 min-h-[48px] flex-row items-center gap-2 rounded-xl border border-outline/20 bg-surface px-3">
              <Search size={18} color={colors['on-surface-variant']} />
              <TextInput testID="buscar-miembros" value={query} onChangeText={setQuery} placeholder="Buscar por nombre, cargo o teléfono" placeholderTextColor={colors['on-surface-variant']} className="flex-1 text-[15px] text-on-surface" />
            </View>
          )}
          {error ? <Text testID="error-miembros" className="mt-3 text-[13px] text-error">{error}</Text> : null}
          {lists === null && !error ? [0, 1, 2].map((index) => <View key={index} className="mt-3 h-20 rounded-2xl bg-surface-variant" />) : null}
          {lists !== null && shown.length === 0 ? <Text className="mt-6 text-center text-[14px] text-on-surface-variant">{tab === 'pending' ? 'No hay solicitudes por aprobar.' : tab === 'deactivated' ? 'Nadie está desactivado.' : tab === 'invited' ? 'No hay invitaciones esperando.' : 'Nadie coincide con la búsqueda.'}</Text> : null}
          {tab === 'pending'
            ? shown.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  spaceName={space.name}
                  code={space.joinCode}
                  busy={busy}
                  onApprove={(area, title) => void after(changeMember(jwt, space.id, request.id, { status: 'active', area, title }))}
                  onReject={() => void after(rejectRequest(jwt, space.id, request.id))}
                />
              ))
            : shown.map((member) => {
                // An email invitation (22/10) is not a member yet: it can only be withdrawn.
                const byEmail = !member.phone && Boolean(member.email);
                const actions = me && !byEmail && member.userId !== props.myUserId ? memberActions({ actor: me.role, target: member }) : [];
                const isOnline = Boolean(member.userId && online.has(member.userId));
                return (
                  <View key={member.id} testID={`fila-miembro-${member.phone ?? member.email}`} className="mt-3 flex-row items-center gap-3 rounded-2xl border border-outline/15 bg-surface p-3">
                    <MemberAvatar member={member} size={48} online={isOnline} />
                    <View className="min-w-0 flex-1">
                      <Text numberOfLines={1} className="text-[16px] font-bold text-on-surface">{memberName(member)}{member.userId === props.myUserId ? ' (Tú)' : ''}</Text>
                      {memberLine(member) ? <Text numberOfLines={1} className="text-[13px] text-on-surface-variant">{memberLine(member)}</Text> : null}
                      <Text className="font-mono text-[13px] text-on-surface">{byEmail ? 'Invitado por correo' : formatPhoneDisplay(member.phone)}</Text>
                    </View>
                    <View className="items-end gap-1.5">
                      <RolePill role={member.role} />
                      {isOnline ? <OnlinePill /> : null}
                    </View>
                    {byEmail ? (
                      <Pressable testID={`retirar-${member.email}`} onPress={() => void after(revokeSpaceInvite(jwt, space.id, member.id))} accessibilityLabel={`Retirar la invitación de ${member.email}`} className="h-11 w-11 items-center justify-center">
                        <X size={20} color={colors['on-surface-variant']} />
                      </Pressable>
                    ) : null}
                    {actions.length ? (
                      <Pressable testID={`acciones-${member.phone}`} onPress={() => setActing(member)} accessibilityLabel={`Cambiar rol o acceso de ${memberName(member)}`} className="h-11 w-9 items-center justify-center">
                        <MoreVertical size={20} color={colors['on-surface-variant']} />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
        </ScrollView>
        {acting && me ? <MemberActionsSheet name={memberName(acting)} actions={memberActions({ actor: me.role, target: acting })} onPick={(action) => runAction(acting, action)} onClose={() => setActing(null)} /> : null}
      </View>
    </Modal>
  );
}
