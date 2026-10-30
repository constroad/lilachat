import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ArrowLeftRight, ChevronDown, Inbox, Settings2, UserCog, Users, type LucideIcon } from 'lucide-react';
import { canManageMembers, membersLabel, spaceSubtitle, type ClientWorkspace } from '@lilachat/shared';
import { SpaceLogo } from './SpaceLogo';

export type WorkspaceLink = 'directory' | 'members' | 'requests' | 'settings';

/**
 * The space's name opens its menu, like Slack's (José 30/10: the
 * «Espacio de trabajo» section on top of the list only took room). The
 * directory for everyone; members, requests and settings for its admins;
 * and switching space. Waiting requests keep a dot on the title.
 */
export function SpaceTitleMenu(props: { space: ClientWorkspace; onOpen: (link: WorkspaceLink) => void; onSwitch: () => void }) {
  const { space } = props;
  const admin = canManageMembers(space.role);
  const pending = admin ? space.pendingRequests ?? 0 : 0;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" data-testid="titulo-espacio" aria-label={`Menú de ${space.name}`} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left outline-none">
          <SpaceLogo space={space} size={36} />
          <span className="min-w-0">
            <span className="flex items-center gap-1">
              <span className="truncate text-base font-extrabold tracking-tight">{space.name}</span>
              <ChevronDown size={16} className="shrink-0 text-on-surface-variant" />
              {pending > 0 ? <span data-testid="aviso-solicitudes" aria-label={`${pending} solicitudes`} className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
            </span>
            <span className="block truncate text-[12px] text-on-surface-variant">{spaceSubtitle(space, { membersFirst: true })}</span>
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={6} onCloseAutoFocus={(event) => event.preventDefault()} className="z-40 min-w-[260px] rounded-xl border border-outline/15 bg-surface p-1 shadow-lg">
          <MenuRow Icon={Users} label="Directorio de equipo" trailing={membersLabel(space.members)} onSelect={() => props.onOpen('directory')} />
          {admin ? <MenuRow Icon={UserCog} label="Miembros y roles" onSelect={() => props.onOpen('members')} /> : null}
          {pending > 0 ? <MenuRow Icon={Inbox} label="Solicitudes" badge={String(pending)} onSelect={() => props.onOpen('requests')} /> : null}
          {admin ? <MenuRow Icon={Settings2} label="Ajustes del espacio" onSelect={() => props.onOpen('settings')} /> : null}
          <DropdownMenu.Separator className="my-1 h-px bg-outline/15" />
          <MenuRow Icon={ArrowLeftRight} label="Cambiar de espacio" onSelect={props.onSwitch} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuRow(props: { Icon: LucideIcon; label: string; trailing?: string; badge?: string; onSelect: () => void }) {
  return (
    <DropdownMenu.Item onSelect={props.onSelect} className="flex min-h-[40px] cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 text-sm outline-none data-[highlighted]:bg-background">
      <props.Icon size={16} className={props.badge ? 'text-primary' : 'text-on-surface-variant'} />
      <span className={`min-w-0 flex-1 truncate ${props.badge ? 'font-bold' : ''}`}>{props.label}</span>
      {props.trailing ? <span className="text-[11px] text-on-surface-variant">{props.trailing}</span> : null}
      {props.badge ? <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-primary">{props.badge}</span> : null}
    </DropdownMenu.Item>
  );
}
