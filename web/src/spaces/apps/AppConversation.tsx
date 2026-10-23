import { ArrowLeft } from 'lucide-react';
import type { BotCommand, DirectoryApp } from '@lilachat/shared';
import { insertIntoComposer } from '../../chat/composerInsert';
import { AppBadge, AppLogo } from './AppLogo';

export type AppConversationTab = 'messages' | 'info';

/**
 * The head of a 1:1 with an app (designs e-23 web and e-26): its logo, «APP»,
 * who made it and the Mensajes / Información tabs. No calls: an app does not
 * answer the phone.
 */
export function AppConversationHeader(props: { app: DirectoryApp; tab: AppConversationTab; onTab: (tab: AppConversationTab) => void; showBack: boolean; onBack: () => void }) {
  const tabs: { key: AppConversationTab; label: string }[] = [{ key: 'messages', label: 'Mensajes' }, { key: 'info', label: 'Información' }];
  return (
    <header data-testid="cabecera-app" className="border-b border-outline/15 bg-surface">
      <div className="flex items-center gap-3 px-4 py-3">
        {props.showBack ? (
          <button type="button" data-testid="btn-volver" aria-label="Volver" onClick={props.onBack} className="grid h-11 w-11 place-items-center rounded-full text-on-surface-variant hover:bg-background"><ArrowLeft size={20} /></button>
        ) : null}
        <AppLogo avatarUrl={props.app.avatarUrl} size={40} rounded="rounded-xl" />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 truncate text-base font-bold">{props.app.name} <AppBadge /></h2>
          {props.app.developer ? <p className="truncate text-[13px] text-on-surface-variant">de {props.app.developer}</p> : null}
        </div>
      </div>
      <nav className="flex gap-6 px-6" aria-label="Secciones de la app">
        {tabs.map((tab) => (
          <button key={tab.key} type="button" data-testid={`pestana-app-${tab.key}`} aria-pressed={props.tab === tab.key} onClick={() => props.onTab(tab.key)} className={`border-b-2 pb-2.5 text-[15px] font-medium ${props.tab === tab.key ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}>
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

/** The app's own commands over the bar (design e-23): a tap writes «/command » in the field. */
export function AppCommandsBar(props: { commands: readonly BotCommand[] }) {
  if (props.commands.length === 0) return null;
  return (
    <div data-testid="comandos-de-la-app" className="flex items-center gap-2 overflow-x-auto border-t border-outline/10 bg-surface px-4 pt-2">
      <span className="shrink-0 text-[12px] text-on-surface-variant">Comandos:</span>
      {props.commands.map((entry) => (
        <button key={entry.command} type="button" title={entry.description} onClick={() => insertIntoComposer(`/${entry.command} `)} className="shrink-0 rounded-md border border-outline/20 px-2 py-1 font-mono text-[12px] text-primary hover:bg-primary/5">
          /{entry.command}
        </button>
      ))}
    </div>
  );
}
