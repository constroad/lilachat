import { Plus } from 'lucide-react';
import { railSpaces, spaceInitials, type ClientWorkspace } from '@lilachat/shared';
import { SpaceLogo } from './SpaceLogo';

/** Over this, the badge says «99+». */
const BADGE_MAX = 99;

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-[20px] place-items-center rounded-full border-2 border-background bg-primary px-1 text-[10px] font-bold text-on-primary">{count > BADGE_MAX ? `${BADGE_MAX}+` : count}</span>;
}

/**
 * The rail of spaces at the far left (design `e1-06-selector-espacios`, like
 * Slack): personal first, then each company space with its unread chats, and
 * «+» to join or create one. Only with a space: the personal account alone
 * keeps looking like WhatsApp Web.
 */
const RAIL_LOGO = 40;

export function SpacesRail(props: { spaces: readonly ClientWorkspace[] | null; currentId: string | null; me: { name?: string | null; phone: string }; personalUnread: number; onPick: (spaceId: string | null) => void; onAdd: () => void; embedded?: boolean }) {
  const spaces = railSpaces(props.spaces);
  // The ring's offset is the rail's own color (`background`), in light and in dark. The corners are the
  // logo's (10 px, `SpaceLogo` at 40): the token `rounded-xl` is 24 px, a circle whose ring cut the square's corners.
  // 40 px, not 48 (José 30/10: a bit smaller squares).
  const item = (active: boolean, shape = 'rounded-[10px]') => `relative grid h-10 w-10 shrink-0 place-items-center ${shape} transition-shadow ${active ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'hover:ring-2 hover:ring-outline/30'}`;
  // Inside the app's rail (pending 38) it is its middle part; alone, a rail of its own.
  const Wrapper = props.embedded ? 'div' : 'nav';
  return (
    // A scrolling box also clips sideways: both boxes take the rail's full width, so the ring and the
    // badges that stick out of each 40 px icon have room, and the scrollbar is hidden so it eats none.
    <Wrapper data-testid="riel-de-espacios" aria-label="Espacios" className={props.embedded ? 'rail-scroll flex min-h-0 w-full flex-1 flex-col items-center gap-2.5 overflow-y-auto py-2' : 'flex h-full w-[64px] shrink-0 flex-col items-center gap-2.5 border-r border-outline/15 bg-background py-3'}>
      <button type="button" data-testid="riel-personal" title="Personal" aria-current={props.currentId === null} aria-label={props.personalUnread ? `Personal, ${props.personalUnread} sin leer` : 'Personal'} onClick={() => props.onPick(null)} className={`${item(props.currentId === null, 'rounded-full')} bg-primary/10 text-sm font-bold text-primary`}>
        {spaceInitials(props.me.name || props.me.phone)}
        <Badge count={props.personalUnread} />
      </button>
      <div className="h-px w-8 bg-outline/20" />
      <ul className="rail-scroll flex min-h-0 w-full flex-1 flex-col items-center gap-2.5 overflow-y-auto py-2">
        {spaces.map((space) => {
          const pending = space.status === 'pending';
          const label = pending ? `${space.name}, pendiente de aprobación` : space.unreadChats ? `${space.name}, ${space.unreadChats} sin leer` : space.name;
          return (
            <li key={space.id}>
              <button type="button" data-testid={`riel-espacio-${space.id}`} title={label} aria-label={label} aria-current={props.currentId === space.id} disabled={pending} onClick={() => props.onPick(space.id)} className={`${item(props.currentId === space.id)} ${pending ? 'opacity-50' : ''}`}>
                <SpaceLogo space={space} size={RAIL_LOGO} />
                {pending ? null : <Badge count={space.unreadChats} />}
              </button>
            </li>
          );
        })}
        <li>
          <button type="button" data-testid="riel-agregar-espacio" title="Unirme o crear un espacio" aria-label="Unirme o crear un espacio" onClick={props.onAdd} className="grid h-10 w-10 place-items-center rounded-[10px] border-2 border-dashed border-outline/40 text-on-surface-variant hover:border-primary hover:text-primary">
            <Plus size={20} />
          </button>
        </li>
      </ul>
    </Wrapper>
  );
}
