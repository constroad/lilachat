import { Rows3 } from 'lucide-react';
import { saveGroupsAsList, useGroupsAsList } from './groupsAsList';

/** «Grupos como lista», like Slack (design `s-01`): in this browser; a company space's chats are always a list. */
export function GroupsAsListChoice() {
  const on = useGroupsAsList();
  return (
    <label className="flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-background">
      <Rows3 size={16} className="shrink-0" />
      <span className="min-w-0 flex-1">
        Grupos como lista
        <span className="block text-[11px] text-on-surface-variant">{on ? 'Nombre, cargo y hora sobre cada mensaje' : 'Burbujas, como WhatsApp'}</span>
      </span>
      <input type="checkbox" data-testid="sw-grupos-como-lista" checked={on} onChange={(event) => saveGroupsAsList(event.target.checked)} className="h-4 w-4 accent-primary" />
    </label>
  );
}
