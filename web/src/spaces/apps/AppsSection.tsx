import { ChevronDown, ChevronRight, LayoutGrid, Plus } from 'lucide-react';
import { installedWithoutChat, type DirectoryApp } from '@lilachat/shared';
import type { ChatSummary } from '../../chat/types';
import { AppBadge, AppLogo } from './AppLogo';
import type { SpaceApps } from './useSpaceApps';

/**
 * «Apps» in the space's list (design e-23, like Slack's): the 1:1s with apps,
 * as compact as the direct messages, plus the installed apps not talked to
 * yet. «Explorar apps» and «+» open the directory.
 */
export function AppsSection(props: { chats: ChatSummary[]; apps: SpaceApps; folded: boolean; onToggle: () => void; selectedChatId: string | null; onOpenChat: (chat: ChatSummary) => void }) {
  const installed = (props.apps.directory?.apps ?? []).filter((app) => app.installation);
  const appOf = (appId?: string) => installed.find((app) => app.appId === appId) ?? props.apps.directory?.apps.find((app) => app.appId === appId);
  const withoutChat = installedWithoutChat(installed, props.chats);
  if (props.chats.length === 0 && installed.length === 0 && !props.apps.directory?.canInstall) return null;
  const row = (key: string, app: DirectoryApp | undefined, name: string, onOpen: () => void, chat?: ChatSummary) => {
    const unread = chat ? chat.unread : 0;
    const chatId = chat?.id ?? (app ? props.apps.openedChats[app.appId] : undefined);
    const selected = Boolean(chatId) && chatId === props.selectedChatId;
    return (
      <button key={key} type="button" data-testid={`app-fila-${app?.appId ?? key}`} aria-current={selected} onClick={onOpen} className={`flex h-11 w-full items-center gap-2.5 px-4 text-left ${selected ? 'bg-primary/10' : 'hover:bg-background'}`}>
        <AppLogo avatarUrl={app?.avatarUrl} size={24} rounded="rounded-md" />
        <span className={`min-w-0 truncate text-sm ${unread > 0 ? 'font-bold' : ''}`}>{name}</span>
        <AppBadge />
        <span className="flex-1" />
        {unread > 0 ? <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-primary">{unread}</span> : null}
      </button>
    );
  };
  return (
    <section data-testid="seccion-apps" className="pt-1">
      <div className="flex items-center pr-2">
        <button type="button" data-testid="plegar-apps" aria-expanded={!props.folded} onClick={props.onToggle} className="flex h-10 flex-1 items-center gap-1.5 px-4 text-left">
          {props.folded ? <ChevronRight size={14} className="text-on-surface-variant" /> : <ChevronDown size={14} className="text-on-surface-variant" />}
          <span className="flex-1 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Apps</span>
        </button>
        <button type="button" data-testid="explorar-apps" aria-label="Explorar apps" title="Explorar apps" onClick={() => props.apps.openDirectory()} className="grid h-8 w-8 place-items-center rounded-full text-on-surface-variant hover:bg-background"><LayoutGrid size={15} /></button>
        <button type="button" data-testid="nuevo-apps" aria-label="Agregar apps" title="Agregar apps" onClick={() => props.apps.openDirectory()} className="grid h-8 w-8 place-items-center rounded-full text-on-surface-variant hover:bg-background"><Plus size={16} /></button>
      </div>
      {props.folded ? null : (
        <>
          {props.chats.map((chat) => row(chat.id, appOf(chat.appId), chat.name ?? 'App', () => props.onOpenChat(chat), chat))}
          {withoutChat.map((app) => row(app.appId, app, app.name, () => props.apps.message(app)))}
        </>
      )}
    </section>
  );
}
