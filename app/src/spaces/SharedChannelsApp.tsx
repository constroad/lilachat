import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link2, Link2Off } from 'lucide-react-native';
import { memberCountLabel, shareCardFor, shareInvitesStore, type ChannelShare, type ClientWorkspace } from '@lilachat/shared';
import { useColores } from '../ui/tema';
import { Sheet } from '../ui/Sheet';
import { useCurrentSpaceId, useMySpaces } from './currentSpace';
import { SpaceLogo } from './SpaceSwitcherSheet';
import { answerShareInvite, channelShares, endChannelShare, shareChannel, shareInvites } from './spacesApi';

/**
 * Channels shared between spaces on the phone (José 11/11, like Slack Connect;
 * designs `sc-02` and `sc-04`). The rules are the server's and
 * `shared/sharedChannels.ts`; this only draws them.
 */

/** The header of a section of channels from another space: its logo, its name and the link mark. */
export function SharedSectionTitle(props: { space: { name: string; logoUrl?: string } }) {
  const colors = useColores();
  return (
    <View className="flex-1 flex-row items-center gap-2">
      <SpaceLogo space={props.space} size={20} />
      <Text numberOfLines={1} className="shrink text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">{props.space.name}</Text>
      <Link2 size={13} color={colors['on-surface-variant']} accessibilityLabel="Compartidos" />
    </View>
  );
}

/** Channels offered to this space and waiting for an admin (design `sc-04`): a card on top of the list. */
export function ShareInvitesCard(props: { jwt: string; space: ClientWorkspace; onAnswered: () => void }) {
  const { jwt, space, onAnswered } = props;
  const store = useMemo(() => shareInvitesStore({ role: space.role, list: () => shareInvites(jwt, space.id), answer: (chatId, accept) => answerShareInvite(jwt, space.id, chatId, accept) }), [jwt, space.id, space.role]);
  const { invites, busy } = useSyncExternalStore(store.subscribe, store.get);
  // An invite arrives with `spaces.changed`, which hands a new space object.
  useEffect(() => {
    void store.load();
  }, [store, space]);
  const answer = (chatId: string, accept: boolean) => {
    void store.answer(chatId, accept).then(onAnswered);
  };
  if (invites.length === 0) return null;
  return (
    <View className="gap-2 px-4 pb-2 pt-1">
      {invites.map((invite) => (
        <View key={invite.chatId} testID={`invitacion-canal-${invite.chatId}`} className="rounded-2xl border border-outline/20 border-t-[3px] border-t-primary bg-surface p-4">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="shrink text-[11px] font-bold uppercase tracking-widest text-primary">{`Invitación de ${invite.from.name}`}</Text>
            <View className={`rounded-full border px-2 py-0.5 ${STATUS_PILL.pending.box}`}><Text className={`text-[10px] font-bold ${STATUS_PILL.pending.text}`}>{STATUS_PILL.pending.label}</Text></View>
          </View>
          <Text className="mt-0.5 text-[16px] font-bold text-on-surface">{`# ${invite.channelName}`}</Text>
          <Text className="mt-1 text-[14px] text-on-surface-variant">{`${invite.invitedBy ?? 'Alguien'} quiere compartir este canal con ${props.space.name}. Si aceptas, entras al canal y puedes agregar a tu equipo.`}</Text>
          <View className="mt-3 flex-row justify-end gap-2">
            <Pressable testID={`rechazar-canal-${invite.chatId}`} disabled={busy === invite.chatId} onPress={() => answer(invite.chatId, false)} className="min-h-[44px] items-center justify-center rounded-xl border border-outline/30 px-4">
              <Text className="text-[14px] font-semibold text-on-surface">Rechazar</Text>
            </Pressable>
            <Pressable testID={`aceptar-canal-${invite.chatId}`} disabled={busy === invite.chatId} onPress={() => answer(invite.chatId, true)} className="min-h-[44px] items-center justify-center rounded-xl bg-primary px-4">
              <Text className="text-[14px] font-bold text-on-primary">Aceptar</Text>
            </Pressable>
          </View>
          <Text className="mt-3 border-t border-outline/15 pt-2 text-[13px] text-on-surface-variant">{`Los mensajes siguen siendo de ${invite.from.name}; ${props.space.name} puede dejar de verlo cuando quiera.`}</Text>
        </View>
      ))}
    </View>
  );
}

const STATUS_PILL: Record<ChannelShare['status'], { label: string; box: string; text: string }> = {
  active: { label: 'COMPARTIDO', box: 'border-en-linea/30 bg-en-linea/10', text: 'text-en-linea' },
  pending: { label: 'PENDIENTE', box: 'border-warning/30 bg-warning/10', text: 'text-warning' },
};

/** «Compartir con otros espacios» in a channel's settings (design `sc-01`), for the owner space's admins. */
export function ShareChannelCard(props: { jwt: string; chatId: string; channelName: string; ownerSpaceId?: string; isGeneral: boolean }) {
  const colors = useColores();
  const { spaces } = useMySpaces(props.jwt);
  const [open, setOpen] = useState(false);
  const viewingSpaceId = useCurrentSpaceId() ?? props.ownerSpaceId ?? null;
  const card = shareCardFor({ ownerSpaceId: props.ownerSpaceId, viewingSpaceId, spaces, isGeneral: props.isGeneral });
  const owner = spaces?.find((space) => space.id === props.ownerSpaceId);
  const viewing = spaces?.find((space) => space.id === viewingSpaceId);
  if (card === 'leave' && viewing) return <LeaveSharedChannelCard jwt={props.jwt} chatId={props.chatId} channelName={props.channelName} viewing={viewing} />;
  if (card !== 'share' || !owner) return null;
  return (
    <>
      <Pressable testID="compartir-canal" onPress={() => setOpen(true)} className="mx-4 mt-3 min-h-[56px] flex-row items-center gap-3 rounded-2xl border border-outline/15 bg-surface px-4 py-3">
        <Link2 size={20} color={colors['on-surface-variant']} />
        <View className="flex-1">
          <Text className="text-[15px] font-semibold text-on-surface">Compartir con otros espacios</Text>
          <Text className="text-[13px] text-on-surface-variant">Que otros espacios lo vean sin cambiar de espacio</Text>
        </View>
      </Pressable>
      {open && spaces ? <ShareChannelSheet jwt={props.jwt} chatId={props.chatId} channelName={props.channelName} owner={owner} spaces={spaces} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ShareChannelSheet(props: { jwt: string; chatId: string; channelName: string; owner: ClientWorkspace; spaces: readonly ClientWorkspace[]; onClose: () => void }) {
  const [shares, setShares] = useState<ChannelShare[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    const response = await channelShares(props.jwt, props.owner.id, props.chatId);
    setShares(response.ok ? response.data.shares : []);
  }, [props.jwt, props.owner.id, props.chatId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const act = async (spaceId: string, run: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(spaceId);
    setError('');
    const response = await run();
    if (!response.ok) setError(response.message ?? 'No se pudo. Prueba de nuevo.');
    await refresh();
    setBusy(null);
  };
  const others = props.spaces.filter((space) => space.id !== props.owner.id && space.status === 'active');
  return (
    <Sheet visible onClose={props.onClose} testID="hoja-compartir-canal" className="px-4 pb-2 pt-1" maxHeight="85%">
      <Text className="text-[11px] font-bold uppercase tracking-widest text-primary">{`Canal de ${props.owner.name}`}</Text>
      <Text className="mt-0.5 text-[20px] font-bold text-on-surface">{`Compartir # ${props.channelName}`}</Text>
      <Text className="mt-1 text-[14px] text-on-surface-variant">{`Las personas que agregues desde otros espacios verán este canal en su espacio, sin cambiar de espacio. Los mensajes siguen siendo de ${props.owner.name}.`}</Text>
      <Text className="mt-4 text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Tus otros espacios</Text>
      {others.length === 0 ? <Text className="mt-2 text-[14px] text-on-surface-variant">No estás en otro espacio con quien compartirlo.</Text> : null}
      {others.map((space) => {
        const share = shares?.find((one) => one.workspaceId === space.id);
        return (
          <View key={space.id} testID={`compartir-con-${space.id}`} className="mt-2 flex-row items-center gap-3 rounded-2xl border border-outline/20 p-3">
            <SpaceLogo space={space} size={40} />
            <View className="flex-1">
              <Text numberOfLines={1} className="text-[15px] font-semibold text-on-surface">{space.name}</Text>
              {share ? (
                <View className={`mt-1 self-start rounded-full border px-2 py-0.5 ${STATUS_PILL[share.status].box}`}><Text className={`text-[10px] font-bold ${STATUS_PILL[share.status].text}`}>{STATUS_PILL[share.status].label}</Text></View>
              ) : (
                <Text className="text-[13px] text-on-surface-variant">{memberCountLabel(space.members)}</Text>
              )}
            </View>
            {shares === null ? null : (
              <Pressable
                testID={share ? `dejar-de-compartir-${space.id}` : `compartir-${space.id}`}
                disabled={busy === space.id}
                onPress={() => void act(space.id, () => (share ? endChannelShare(props.jwt, props.owner.id, props.chatId, space.id) : shareChannel(props.jwt, props.owner.id, props.chatId, space.id)))}
                className={`min-h-[44px] items-center justify-center rounded-xl px-3 ${share ? 'border border-outline/30' : 'border border-primary'}`}
              >
                <Text className={`text-[14px] font-semibold ${share ? 'text-on-surface' : 'text-primary'}`}>{share ? (share.status === 'pending' ? 'Cancelar' : 'Dejar de compartir') : 'Compartir'}</Text>
              </Pressable>
            )}
          </View>
        );
      })}
      {error ? <Text className="mt-3 text-[14px] text-error">{error}</Text> : null}
      <Text className="mt-4 text-[13px] text-on-surface-variant">Solo ven el canal las personas agregadas. Cualquiera del canal puede agregar gente de los espacios conectados.</Text>
      <Pressable testID="listo-compartir" onPress={props.onClose} className="mt-4 min-h-[52px] items-center justify-center rounded-2xl bg-primary"><Text className="text-[16px] font-bold text-on-primary">Listo</Text></Pressable>
    </Sheet>
  );
}

/** The receiving side (design `sc-04`): an admin of the space it is seen from stops receiving it. */
function LeaveSharedChannelCard(props: { jwt: string; chatId: string; channelName: string; viewing: ClientWorkspace }) {
  const colors = useColores();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const leave = async () => {
    const response = await endChannelShare(props.jwt, props.viewing.id, props.chatId, props.viewing.id);
    if (response.ok) setConfirming(false);
    else setError(response.message ?? 'No se pudo. Prueba de nuevo.');
  };
  return (
    <>
      <Pressable testID="dejar-canal-compartido" onPress={() => setConfirming(true)} className="mx-4 mt-3 min-h-[56px] flex-row items-center gap-3 rounded-2xl border border-outline/15 bg-surface px-4 py-3">
        <Link2Off size={20} color={colors.error} />
        <View className="flex-1">
          <Text className="text-[15px] font-semibold text-error">{`Dejar de ver este canal en ${props.viewing.name}`}</Text>
          <Text className="text-[13px] text-on-surface-variant">Es un canal compartido: termina para todo el espacio</Text>
        </View>
      </Pressable>
      <Sheet visible={confirming} onClose={() => setConfirming(false)} testID="hoja-dejar-canal" className="px-4 pb-2 pt-1">
        <Text className="text-[20px] font-bold text-on-surface">{`Dejar de ver # ${props.channelName} en ${props.viewing.name}`}</Text>
        <Text className="mt-2 text-[15px] text-on-surface-variant">{`Las personas de ${props.viewing.name} salen del canal y deja de aparecer en su lista. Los mensajes siguen en el espacio que lo compartió.`}</Text>
        {error ? <Text className="mt-3 text-[14px] text-error">{error}</Text> : null}
        <Pressable testID="confirmar-dejar-canal" onPress={() => void leave()} className="mt-4 min-h-[56px] items-center justify-center rounded-2xl bg-error"><Text className="text-[16px] font-bold text-white">Dejar de verlo</Text></Pressable>
        <Pressable onPress={() => setConfirming(false)} className="mt-2 min-h-[48px] items-center justify-center"><Text className="text-[15px] font-semibold text-on-surface">Cancelar</Text></Pressable>
      </Sheet>
    </>
  );
}

