import { Plus, X } from 'lucide-react';
import { customEmojiToken } from '@lilachat/shared';
import { useMySpaces } from '../../spaces/currentSpace';
import { removeCustomEmoji, useSpaceEmojis } from '../../spaces/customEmojis';
import type { CustomEmoji } from '@lilachat/shared';
import { useConversacion } from '../contextoDeLaConversacion';

/** «De {espacio}» on top of the full picker (design c-06): the space's own emojis and «Agregar». */
export function SpaceEmojiSection(props: { onPick: (emoji: string) => void; onAdd: () => void }) {
  const { jwt, chat } = useConversacion();
  const { emojis, reload } = useSpaceEmojis(jwt, chat.workspaceId);
  const spaceName = useMySpaces(jwt).spaces?.find((space) => space.id === chat.workspaceId)?.name ?? 'el espacio';
  if (!chat.workspaceId) return null;
  const spaceId = chat.workspaceId;
  // The server decides who may (its author or an admin) and says why not.
  const remove = async (emoji: CustomEmoji) => {
    if (!window.confirm(`¿Quitar :${emoji.name}: de ${spaceName}?`)) return;
    const removed = await removeCustomEmoji(jwt, spaceId, emoji.id);
    if (!removed.ok) return window.alert(removed.message ?? 'No se pudo quitar el emoji.');
    await reload();
  };
  return (
    <div data-testid="emojis-del-espacio" className="border-b border-outline/15 px-3 pb-2">
      <div className="flex min-h-[36px] items-center">
        <span className="flex-1 truncate text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">De {spaceName} · {emojis.length}</span>
        <button type="button" data-testid="btn-agregar-emoji" onClick={props.onAdd} className="flex min-h-[32px] items-center gap-1 text-sm font-semibold text-primary hover:underline">
          <Plus size={14} /> Agregar
        </button>
      </div>
      {emojis.length === 0 ? (
        <p className="pb-1 text-[13px] text-on-surface-variant">Este espacio todavía no tiene emojis propios.</p>
      ) : (
        <div className="grid max-h-[148px] grid-cols-6 gap-1.5 overflow-y-auto">
          {emojis.map((emoji) => (
            <div key={emoji.id} className="group/emoji relative">
            <button type="button" data-testid={`emoji-propio-${emoji.name}`} title={`:${emoji.name}:`} aria-label={`Reaccionar con :${emoji.name}:`} onClick={() => props.onPick(customEmojiToken(emoji.name))} className="flex flex-col items-center rounded-lg p-1 hover:bg-background">
              <img src={emoji.url} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
              <span className="w-full truncate text-center font-mono text-[9px] text-on-surface-variant">:{emoji.name}:</span>
            </button>
            <button type="button" data-testid={`quitar-emoji-${emoji.name}`} aria-label={`Quitar :${emoji.name}:`} onClick={() => void remove(emoji)} className="absolute -right-1 -top-1 hidden h-5 w-5 place-items-center rounded-full border border-outline/20 bg-surface text-on-surface-variant hover:text-error group-hover/emoji:grid">
              <X size={11} />
            </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
