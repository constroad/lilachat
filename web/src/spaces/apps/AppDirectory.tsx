import { useMemo, useState } from 'react';
import { ArrowLeft, MessageSquare, Search } from 'lucide-react';
import { directoryChips, filterDirectory, type ClientWorkspace, type DirectoryFilter } from '@lilachat/shared';
import { AppBadge, AppLogo } from './AppLogo';
import { AppDetail } from './AppDetail';
import type { SpaceApps } from './useSpaceApps';

/**
 * «Apps de <espacio>» (design e-24, like Slack's directory): the list with its
 * search and chips, and the chosen app's detail beside it. On a narrow window
 * the detail replaces the list, with a way back.
 */
export function AppDirectory(props: { space: ClientWorkspace; apps: SpaceApps }) {
  const { space, apps } = props;
  const all = apps.directory?.apps ?? [];
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DirectoryFilter>('all');
  const [chosenId, setChosenId] = useState<string | null>(apps.open?.appId ?? null);
  const shown = useMemo(() => filterDirectory(all, { filter, query }), [all, filter, query]);
  const chosen = all.find((app) => app.appId === chosenId) ?? null;
  /** A wide window always shows a detail (the first app until one is chosen); a narrow one opens on the list. */
  const detailed = chosen ?? all[0] ?? null;
  const admin = apps.directory?.canInstall ?? false;

  return (
    <div data-testid="directorio-apps" role="dialog" aria-label={`Apps de ${space.name}`} className="fixed inset-0 z-40 flex flex-col bg-background md:left-[72px]">
      <header className="flex items-center gap-3 border-b border-outline/15 bg-surface px-4 py-3">
        <button type="button" aria-label="Volver" onClick={chosen && window.innerWidth < 768 ? () => setChosenId(null) : apps.closeDirectory} className="grid h-10 w-10 place-items-center rounded-full hover:bg-background md:hidden"><ArrowLeft size={20} /></button>
        <p className="min-w-0 flex-1 truncate text-[15px]"><span className="font-semibold">{space.name}</span><span className="text-on-surface-variant"> / </span><span className="font-semibold text-primary">Directorio de apps</span></p>
        <button type="button" data-testid="volver-al-chat" onClick={apps.closeDirectory} className="hidden h-10 items-center gap-2 rounded-xl border border-outline/20 px-4 text-[14px] font-semibold hover:bg-background md:flex"><MessageSquare size={16} /> Volver al chat</button>
      </header>
      <div className="flex min-h-0 flex-1">
        <section data-testid="directorio-lista" className={`min-h-0 w-full flex-col border-r border-outline/15 bg-surface md:flex md:w-[480px] lg:w-[560px] ${chosen ? 'hidden' : 'flex'}`}>
          <div className="px-6 pb-3 pt-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Apps</h2>
                <p className="mt-1 text-[14px] text-on-surface-variant">Las apps que trabajan en los chats de {space.name}.</p>
              </div>
              <span className="shrink-0 rounded-full border border-outline/20 px-3 py-1 text-[12px] text-on-surface-variant">{all.length} {all.length === 1 ? 'app' : 'apps'}</span>
            </div>
            <label className="mt-4 flex items-center gap-2 rounded-xl border border-outline/20 bg-background px-3 py-2.5">
              <Search size={16} className="text-on-surface-variant" />
              <input data-testid="buscar-apps" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busca por nombre o categoría" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-on-surface-variant" />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {directoryChips(all).map((chip) => (
                <button key={chip.key} type="button" data-testid={`chip-apps-${chip.key}`} aria-pressed={filter === chip.key} onClick={() => setFilter(chip.key)} className={`h-9 rounded-lg px-3 text-[13px] font-medium ${filter === chip.key ? 'bg-primary text-on-primary' : 'border border-outline/20 hover:bg-background'}`}>{chip.label}</button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-outline/10">
            {apps.directory === null ? <div className="space-y-2 p-4">{[0, 1, 2].map((index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-background" />)}</div> : null}
            {apps.directory !== null && shown.length === 0 ? <p className="p-6 text-[14px] text-on-surface-variant">No hay apps con ese nombre o categoría.</p> : null}
            {shown.map((app) => (
              <button key={app.appId} type="button" data-testid={`fila-app-${app.appId}`} aria-current={app.appId === detailed?.appId} onClick={() => setChosenId(app.appId)} className={`flex w-full items-center gap-3 border-b border-outline/10 px-6 py-3 text-left ${app.appId === detailed?.appId ? 'bg-primary/[0.06] shadow-[inset_3px_0_0] shadow-primary' : 'hover:bg-background'}`}>
                <AppLogo avatarUrl={app.avatarUrl} size={44} rounded="rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[15px] font-semibold">{app.name} <AppBadge /></span>
                  {app.description ? <span className="block truncate text-[13px] text-on-surface-variant">{app.description}</span> : null}
                </span>
                {app.installation ? (
                  <span className="shrink-0 rounded-full border border-en-linea/30 bg-en-linea/10 px-2.5 py-1 text-[12px] font-semibold text-en-linea">Instalada</span>
                ) : admin && app.installUrl ? (
                  <span className="shrink-0 rounded-lg border border-outline/25 px-3 py-1.5 text-[13px] font-semibold text-primary">Instalar</span>
                ) : null}
              </button>
            ))}
            {!admin && apps.directory !== null ? <p className="px-6 py-4 text-[12px] text-on-surface-variant">Las apps las instala un admin del espacio.</p> : null}
          </div>
        </section>
        <section data-testid="directorio-detalle" className={`min-h-0 flex-1 overflow-y-auto p-4 md:block md:p-8 ${chosen ? 'block' : 'hidden'}`}>
          {detailed ? (
            <div className="mx-auto max-w-3xl">
              <AppDetail key={detailed.appId} app={detailed} jwt={apps.jwt} spaceId={apps.spaceId} spaceName={space.name} admin={admin} onMessage={() => apps.message(detailed)} onInstall={() => apps.install(detailed)} onUninstall={admin ? () => apps.uninstall(detailed) : undefined} uninstalling={apps.uninstallingId === detailed.appId} onChannelsChanged={apps.refresh} />
            </div>
          ) : (
            <p className="mt-24 text-center text-[14px] text-on-surface-variant">Elige una app para ver qué hace.</p>
          )}
        </section>
      </div>
    </div>
  );
}
