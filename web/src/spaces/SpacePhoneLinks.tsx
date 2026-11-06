import { Inbox, Settings2, UserCog, UserPlus, type LucideIcon } from 'lucide-react';
import { canManageMembers, type ClientWorkspace } from '@lilachat/shared';
import type { WorkspaceLink } from './SpaceTitleMenu';

const ROW = 'flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-background';

function LinkRow(props: { testId: string; Icon: LucideIcon; label: string; badge?: number; onClick: () => void }) {
  return (
    <button type="button" data-testid={props.testId} onClick={props.onClick} className={ROW}>
      <props.Icon size={16} />
      <span className="min-w-0 flex-1 truncate">{props.label}</span>
      {props.badge ? <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-primary">{props.badge}</span> : null}
    </button>
  );
}

/**
 * What the title menu holds at the desk, in Ajustes on a phone (José 06/11: the
 * title opens the switcher there, like the APK, whose Ajustes has these links).
 * The directory has its own tab, and a member has nothing else to open here.
 */
export function SpacePhoneLinks(props: { space: ClientWorkspace; onOpen: (link: WorkspaceLink) => void; onInvite: () => void }) {
  const { space, onOpen } = props;
  if (!canManageMembers(space.role)) return null;
  const pending = space.pendingRequests ?? 0;
  return (
    <div data-testid="ajustes-del-espacio" className="mb-1 border-b border-outline/15 pb-1">
      <p className="truncate px-3 pb-1 pr-9 pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">{space.name}</p>
      <LinkRow testId="ajustes-espacio-invitar" Icon={UserPlus} label="Invitar personas" onClick={props.onInvite} />
      <LinkRow testId="ajustes-espacio-members" Icon={UserCog} label="Miembros y roles" onClick={() => onOpen('members')} />
      {pending > 0 ? <LinkRow testId="ajustes-espacio-requests" Icon={Inbox} label="Solicitudes" badge={pending} onClick={() => onOpen('requests')} /> : null}
      <LinkRow testId="ajustes-espacio-settings" Icon={Settings2} label="Ajustes del espacio" onClick={() => onOpen('settings')} />
    </div>
  );
}
