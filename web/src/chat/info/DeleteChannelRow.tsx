import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { canManageMembers } from '@lilachat/shared';
import { api } from '../../api';
import { Overlay } from '../../ui/Overlay';
import { useMySpaces } from '../../spaces/currentSpace';
import { useClientOfChat } from '../../spaces/clients/useSpaceClients';

/**
 * «Eliminar canal» (José 30/10: there was no way to delete one). Only a space
 * admin sees it, never in #general nor in a client's channel (the server
 * refuses those too). Everyone loses the channel; it cannot be undone.
 */
export function DeleteChannelRow(props: {
  chatId: string;
  workspaceId: string;
  name: string;
  jwt: string;
  canDelete: boolean;
  onNotice: (text: string) => void;
  onDeleted: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);
  if (!props.canDelete) return null;
  const confirm = async () => {
    setSending(true);
    const response = await api(`/workspaces/${props.workspaceId}/channels/${props.chatId}`, { method: 'DELETE', jwt: props.jwt });
    setSending(false);
    if (!response.ok) return props.onNotice(response.message);
    setAsking(false);
    props.onNotice('Canal eliminado');
    props.onDeleted();
  };
  return (
    <>
      <button type="button" data-testid="btn-eliminar-canal" onClick={() => setAsking(true)} className="flex min-h-[52px] w-full items-center gap-4 px-6 text-left text-[15px] text-error hover:bg-background">
        <Trash2 size={18} /> Eliminar canal
      </button>
      {asking ? (
        <Overlay
          title={`¿Eliminar #${props.name}?`}
          onClose={() => setAsking(false)}
          footer={
            <div className="flex gap-2">
              <button type="button" onClick={() => setAsking(false)} className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-outline/25 text-sm font-semibold hover:bg-background">
                Cancelar
              </button>
              <button type="button" data-testid="btn-confirmar-eliminar-canal" disabled={sending} onClick={() => void confirm()} className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-error text-sm font-semibold text-white disabled:opacity-60">
                {sending ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          }
        >
          <p className="text-sm leading-6 text-on-surface-variant">Sale de la lista de todos sus miembros, con sus mensajes y archivos. No se puede deshacer.</p>
        </Overlay>
      ) : null}
    </>
  );
}

/** Whether I may delete this chat as a channel: a space admin, not #general, not a client's channel. */
export function useChannelDeletable(params: { jwt: string; chatId: string; workspaceId?: string; isChannel: boolean; isGeneral: boolean }): boolean {
  const { spaces } = useMySpaces(params.jwt);
  const client = useClientOfChat(params.chatId);
  if (!params.isChannel || params.isGeneral || client || !params.workspaceId) return false;
  const space = spaces?.find((candidate) => candidate.id === params.workspaceId);
  return Boolean(space && canManageMembers(space.role));
}
