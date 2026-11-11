import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link2 } from 'lucide-react';
import { canManageMembers, shareInvitesStore, type ChannelShare, type ClientWorkspace } from '@lilachat/shared';
import { Overlay, PrimaryButton } from '../ui/Overlay';
import { SpaceLogo } from './SpaceLogo';
import { answerShareInvite, channelShares, endChannelShare, shareChannel, shareInvites } from './spacesApi';

/**
 * Channels shared between spaces on the web (José 11/11, like Slack Connect;
 * designs `sc-01` share, `sc-04` invitation). The rules are the server's and
 * `shared/sharedChannels.ts`; this only draws them.
 */

/** Channels offered to this space and waiting for an admin (design `sc-04`): a card on top of the list. */
export function ShareInvitesCard(props: { jwt: string; space: ClientWorkspace; onAnswered: () => void }) {
  const { jwt, space } = props;
  const store = useMemo(() => shareInvitesStore({ role: space.role, list: () => shareInvites(jwt, space.id), answer: (chatId, accept) => answerShareInvite(jwt, space.id, chatId, accept) }), [jwt, space.id, space.role]);
  const { invites, busy } = useSyncExternalStore(store.subscribe, store.get);
  // The space object changes when the server says something changed (`spaces.changed`): an invite arrives that way.
  useEffect(() => {
    void store.load();
  }, [store, space]);
  const answer = (chatId: string, accept: boolean) => void store.answer(chatId, accept).then(props.onAnswered);
  if (invites.length === 0) return null;
  return (
    <div className="space-y-2 px-3 pb-2">
      {invites.map((invite) => (
        <div key={invite.chatId} data-testid={`invitacion-canal-${invite.chatId}`} className="rounded-xl border border-outline/20 border-t-[3px] border-t-primary bg-surface p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Invitación de {invite.from.name}</p>
          <p className="mt-0.5 font-bold"># {invite.channelName}</p>
          <p className="mt-1 text-[13px] text-on-surface-variant">
            {invite.invitedBy ?? 'Alguien'} quiere compartir este canal con {props.space.name}. Si aceptas, entras al canal y puedes agregar a tu equipo.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" data-testid={`rechazar-canal-${invite.chatId}`} disabled={busy === invite.chatId} onClick={() => answer(invite.chatId, false)} className="h-9 rounded-lg border border-outline/30 px-3 text-sm font-semibold">Rechazar</button>
            <button type="button" data-testid={`aceptar-canal-${invite.chatId}`} disabled={busy === invite.chatId} onClick={() => answer(invite.chatId, true)} className="h-9 rounded-lg bg-primary px-3 text-sm font-semibold text-on-primary">Aceptar</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** The header of a section of channels from another space (design `sc-02`): its logo and name. */
export function SharedSectionTitle(props: { space: { name: string; logoUrl?: string } }) {
  return (
    <span className="flex flex-1 items-center gap-2">
      <SpaceLogo space={props.space} size={18} />
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{props.space.name}</span>
      <Link2 size={12} className="text-on-surface-variant" aria-label="Compartidos" />
    </span>
  );
}

const STATUS_PILL: Record<ChannelShare['status'], { label: string; className: string }> = {
  active: { label: 'Compartido', className: 'border-en-linea/30 bg-en-linea/10 text-en-linea' },
  pending: { label: 'Pendiente', className: 'border-warning/30 bg-warning/10 text-warning' },
};

/** «Compartir con otros espacios» (design `sc-01`): my other spaces, each shared, waiting or not yet. */
export function ShareChannelDialog(props: { jwt: string; ownerSpaceId: string; chatId: string; channelName: string; spaces: readonly ClientWorkspace[]; onClose: () => void }) {
  const [shares, setShares] = useState<ChannelShare[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void channelShares(props.jwt, props.ownerSpaceId, props.chatId).then((response) => setShares(response.ok ? response.data.shares : []));
  }, [props.jwt, props.ownerSpaceId, props.chatId]);
  const others = props.spaces.filter((space) => space.id !== props.ownerSpaceId && space.status === 'active');
  const owner = props.spaces.find((space) => space.id === props.ownerSpaceId);
  const act = async (spaceId: string, run: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(spaceId);
    setError(null);
    const response = await run();
    if (!response.ok) setError(response.message ?? 'No se pudo. Prueba de nuevo.');
    const fresh = await channelShares(props.jwt, props.ownerSpaceId, props.chatId);
    if (fresh.ok) setShares(fresh.data.shares);
    setBusy(null);
  };
  return (
    <Overlay title={`Compartir # ${props.channelName}`} onClose={props.onClose} footer={<PrimaryButton testId="listo-compartir" onClick={props.onClose}>Listo</PrimaryButton>}>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Canal de {owner?.name ?? 'este espacio'}</p>
      <p className="mt-1 text-sm text-on-surface-variant">Las personas que agregues desde otros espacios verán este canal en su espacio, sin cambiar de espacio. Los mensajes siguen siendo de {owner?.name ?? 'este espacio'}.</p>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Tus otros espacios</p>
      {others.length === 0 ? <p className="mt-2 text-sm text-on-surface-variant">No estás en otro espacio con quien compartirlo.</p> : null}
      <div className="mt-2 space-y-2">
        {others.map((space) => {
          const share = shares?.find((one) => one.workspaceId === space.id);
          return (
            <div key={space.id} data-testid={`compartir-con-${space.id}`} className="flex items-center gap-3 rounded-xl border border-outline/20 p-3">
              <SpaceLogo space={space} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{space.name}</p>
                {share ? <span className={`mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_PILL[share.status].className}`}>{STATUS_PILL[share.status].label}</span> : <p className="text-[12px] text-on-surface-variant">{space.members} miembros</p>}
                {share?.status === 'pending' ? <p className="mt-1 text-[12px] text-on-surface-variant">Esperando que un admin de {space.name} lo acepte</p> : null}
              </div>
              {shares === null ? null : share ? (
                <button type="button" data-testid={`dejar-de-compartir-${space.id}`} disabled={busy === space.id} onClick={() => void act(space.id, () => endChannelShare(props.jwt, props.ownerSpaceId, props.chatId, space.id))} className="h-9 shrink-0 rounded-lg border border-outline/30 px-3 text-sm font-semibold">
                  {share.status === 'pending' ? 'Cancelar' : 'Dejar de compartir'}
                </button>
              ) : (
                <button type="button" data-testid={`compartir-${space.id}`} disabled={busy === space.id} onClick={() => void act(space.id, () => shareChannel(props.jwt, props.ownerSpaceId, props.chatId, space.id))} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-primary px-3 text-sm font-semibold text-primary">
                  <Link2 size={14} /> Compartir
                </button>
              )}
            </div>
          );
        })}
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-error">{error}</p> : null}
      <p className="mt-4 text-[12px] text-on-surface-variant">Solo ven el canal las personas agregadas. Cualquiera del canal puede agregar gente de los espacios conectados. No se comparten # general ni los canales de clientes.</p>
    </Overlay>
  );
}

/** The settings row that opens it, for the owner space's admins on a channel that is not #general. */
export function ShareChannelRow(props: { jwt: string; chatId: string; channelName: string; ownerSpaceId: string; spaces: readonly ClientWorkspace[] | null; isGeneral: boolean; sharedFrom: boolean }) {
  const [open, setOpen] = useState(false);
  const owner = props.spaces?.find((space) => space.id === props.ownerSpaceId);
  if (!owner || !canManageMembers(owner.role) || props.isGeneral || props.sharedFrom) return null;
  return (
    <>
      <button type="button" data-testid="compartir-canal" onClick={() => setOpen(true)} className="flex min-h-[56px] w-full items-center gap-4 px-4 text-left hover:bg-background">
        <Link2 size={20} className="text-on-surface-variant" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Compartir con otros espacios</span>
          <span className="block text-[13px] text-on-surface-variant">Que otros espacios lo vean sin cambiar de espacio</span>
        </span>
      </button>
      {open && props.spaces ? <ShareChannelDialog jwt={props.jwt} ownerSpaceId={props.ownerSpaceId} chatId={props.chatId} channelName={props.channelName} spaces={props.spaces} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
