import { Images, ListTodo, MessageCircle, Phone, Plus, Settings, Star, type LucideIcon } from 'lucide-react';
import { railSpaces, type ClientWorkspace } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';
import { SpacesRail } from '../spaces/SpacesRail';

function RailButton(props: { testId: string; label: string; Icon: LucideIcon; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" data-testid={props.testId} aria-label={props.label} title={props.label} aria-current={props.active || undefined} onClick={props.onClick} className={`grid h-11 w-11 place-items-center rounded-full ${props.active ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface'}`}>
      <props.Icon size={21} />
    </button>
  );
}

/**
 * The rail of the web, like WhatsApp Web's (pending 38, José 21/10: a panel
 * on the left that groups messages, calls and the rest): Chats,
 * Pendientes y encuestas and Destacados on top; the company spaces in the
 * middle (personal and each space, or «+» while there are none); Medios,
 * Ajustes and me at the bottom. Llamadas (22/10) is the call history.
 */
export function AppRail(props: {
  spaces: readonly ClientWorkspace[] | null;
  currentSpaceId: string | null;
  me: { name?: string | null; phone: string };
  personalUnread: number;
  onChats: () => void;
  onCalls: () => void;
  onAgenda: () => void;
  onStarred: () => void;
  onMedia: () => void;
  onSettings: () => void;
  onPickSpace: (spaceId: string | null) => void;
  onAddSpace: () => void;
}) {
  const withSpaces = railSpaces(props.spaces).length > 0;
  return (
    <nav data-testid="riel" aria-label="Lilachat" className="flex h-full w-[64px] shrink-0 flex-col items-center gap-1.5 border-r border-outline/15 bg-background py-3">
      <RailButton testId="riel-chats" label="Chats" Icon={MessageCircle} active onClick={props.onChats} />
      <RailButton testId="riel-llamadas" label="Llamadas" Icon={Phone} onClick={props.onCalls} />
      <RailButton testId="riel-pendientes" label="Pendientes y encuestas" Icon={ListTodo} onClick={props.onAgenda} />
      <RailButton testId="riel-destacados" label="Mensajes destacados" Icon={Star} onClick={props.onStarred} />
      <div className="my-1.5 h-px w-8 bg-outline/20" />
      {withSpaces ? (
        <SpacesRail embedded spaces={props.spaces} currentId={props.currentSpaceId} me={props.me} personalUnread={props.personalUnread} onPick={props.onPickSpace} onAdd={props.onAddSpace} />
      ) : (
        <div className="min-h-0 flex-1">
          <button type="button" data-testid="riel-agregar-espacio" aria-label="Espacios de empresa: unirme o crear uno" title="Espacios de empresa: unirme o crear uno" onClick={props.onAddSpace} className="grid h-10 w-10 place-items-center rounded-[10px] border-2 border-dashed border-outline/40 text-on-surface-variant hover:border-primary hover:text-primary">
            <Plus size={18} />
          </button>
        </div>
      )}
      <div className="my-1.5 h-px w-8 bg-outline/20" />
      <RailButton testId="riel-medios" label="Medios" Icon={Images} onClick={props.onMedia} />
      <RailButton testId="btn-ajustes" label="Ajustes" Icon={Settings} onClick={props.onSettings} />
      <button type="button" data-testid="riel-perfil" aria-label={`Mi perfil: ${props.me.name ?? props.me.phone}`} title={props.me.name ?? props.me.phone} onClick={props.onSettings} className="mt-1 rounded-full">
        <Avatar name={props.me.name ?? props.me.phone} size={36} />
      </button>
    </nav>
  );
}
