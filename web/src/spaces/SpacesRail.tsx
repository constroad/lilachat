import { Plus } from 'lucide-react';
import { railSpaces, spaceInitials, type ClientWorkspace } from '@lilachat/shared';
import { SpaceLogo } from './SpaceLogo';

/** Over this, the badge says «99+». */
const BADGE_MAX = 99;

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-[20px] place-items-center rounded-full border-2 border-surface bg-primary px-1 text-[10px] font-bold text-on-primary">{count > BADGE_MAX ? `${BADGE_MAX}+` : count}</span>;
}

/**
 * The rail of spaces at the far left (design `e1-06-selector-espacios`, like
 * Slack): personal first, then each company space with its unread chats, and
 * «+» to join or create one. Only with a space: the personal account alone
 * keeps looking like WhatsApp Web.
 */
export function SpacesRail(props: { spaces: readonly ClientWorkspace[] | null; currentId: string | null; me: { name?: string | null; phone: string }; personalUnread: number; onPick: (spaceId: string | null) => void; onAdd: () => void }) {
  const spaces = railSpaces(props.spaces);
  const item = (active: boolean) => `relative grid h-12 w-12 place-items-center rounded-xl transition-shadow ${active ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface' : 'hover:ring-2 hover:ring-outline/30'}`;
  return (
    <nav data-testid="riel-de-espacios" aria-label="Espacios" className="flex h-full w-[72px] shrink-0 flex-col items-center gap-3 border-r border-outline/15 bg-background py-3">
      <button type="button" data-testid="riel-personal" title="Personal" aria-current={props.currentId === null} aria-label={props.personalUnread ? `Personal, ${props.personalUnread} sin leer` : 'Personal'} onClick={() => props.onPick(null)} className={`${item(props.currentId === null)} rounded-full bg-primary/10 text-sm font-bold text-primary`}>
        {spaceInitials(props.me.name || props.me.phone)}
        <Badge count={props.personalUnread} />
      </button>
      <div className="h-px w-8 bg-outline/20" />
      <ul className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto py-1.5">
        {spaces.map((space) => {
          const pending = space.status === 'pending';
          const label = pending ? `${space.name}, pendiente de aprobación` : space.unreadChats ? `${space.name}, ${space.unreadChats} sin leer` : space.name;
          return (
            <li key={space.id}>
              <button type="button" data-testid={`riel-espacio-${space.id}`} title={label} aria-label={label} aria-current={props.currentId === space.id} disabled={pending} onClick={() => props.onPick(space.id)} className={`${item(props.currentId === space.id)} ${pending ? 'opacity-50' : ''}`}>
                <SpaceLogo space={space} size={48} />
                {pending ? null : <Badge count={space.unreadChats} />}
              </button>
            </li>
          );
        })}
        <li>
          <button type="button" data-testid="riel-agregar-espacio" title="Unirme o crear un espacio" aria-label="Unirme o crear un espacio" onClick={props.onAdd} className="grid h-12 w-12 place-items-center rounded-xl border-2 border-dashed border-outline/40 text-on-surface-variant hover:border-primary hover:text-primary">
            <Plus size={20} />
          </button>
        </li>
      </ul>
    </nav>
  );
}
