import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Hash, Info, Lock, RefreshCw, Trash2, X } from 'lucide-react';
import { activeChannelsLine, uninstallWarning, type AppChannel } from '@lilachat/shared';
import { appChannels, setAppInChannel, type AppChannels } from '../spacesApi';

/**
 * «En qué canales está» (pending 99, design c-05): a switch per channel that
 * takes the app out or puts it back through the chat's members routes, so the
 * channel shows «José sacó a Inframaq» like any member. The list reads again
 * after each switch: who may change it depends on being that channel's admin.
 */
export function AppChannelsSection(props: { jwt: string; spaceId: string; appId: string }) {
  const [state, setState] = useState<AppChannels | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const result = await appChannels(props.jwt, props.spaceId, props.appId);
    if (result.ok) setState(result.data);
    else setError(result.message ?? 'No se pudieron leer los canales.');
  }, [props.jwt, props.spaceId, props.appId]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!state) return error ? <p role="alert" className="text-[13px] text-error">{error}</p> : <div className="h-40 animate-pulse rounded-2xl bg-surface" />;
  const toggle = async (channel: AppChannel) => {
    setBusyId(channel.id);
    setError('');
    const result = await setAppInChannel(props.jwt, channel.id, state.botUserId, !channel.inChannel);
    if (!result.ok) setError(result.message ?? 'No se pudo cambiar.');
    await load();
    setBusyId(null);
  };
  return (
    <section data-testid="canales-de-la-app">
      <p className="mb-2 flex items-center justify-between px-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">En qué canales está</span>
        <span className="font-mono text-[12px] font-semibold uppercase text-primary">{activeChannelsLine(state.channels)}</span>
      </p>
      <div className="divide-y divide-outline/10 overflow-hidden rounded-2xl border border-outline/15 bg-surface">
        {state.channels.map((channel) => (
          <label key={channel.id} data-testid={`canal-app-${channel.name}`} className="flex min-h-[60px] items-center gap-3 px-4 py-2">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${channel.inChannel ? 'bg-primary/10 text-primary' : 'bg-background text-on-surface-variant'}`}>
              {channel.private ? <Lock size={15} /> : <Hash size={15} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{channel.name}</span>
              {channel.description ? <span className="block truncate text-[12px] text-on-surface-variant">{channel.description}</span> : null}
            </span>
            <input type="checkbox" role="switch" data-testid={`interruptor-canal-${channel.name}`} checked={channel.inChannel} disabled={!channel.canChange || busyId !== null} onChange={() => void toggle(channel)} className="h-5 w-5 accent-primary" />
          </label>
        ))}
      </div>
      {error ? <p role="alert" className="mt-2 px-1 text-[13px] text-error">{error}</p> : null}
      <p className="mt-2 flex items-center gap-1.5 px-1 text-[12px] text-on-surface-variant">
        <Info size={13} /> {state.canEdit ? 'Puedes cambiarlo en los canales donde eres admin.' : 'Solo los admins cambian esto.'}
      </p>
    </section>
  );
}

/** «Reinstalar» and «Desinstalar» (design c-05), only for admins: the ⋮ of the old detail moved here. */
export function AppInstallSection(props: { appName: string; spaceName: string; uninstalling?: boolean; onReinstall?: () => void; onUninstall: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <section data-testid="instalacion-de-la-app">
      <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Solo admins</p>
      <div className="divide-y divide-outline/10 overflow-hidden rounded-2xl border border-outline/15 bg-surface">
        {props.onReinstall ? (
          <button type="button" data-testid="app-reinstalar" onClick={props.onReinstall} className="flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left hover:bg-background">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><RefreshCw size={16} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-primary">Reinstalar app</span>
              <span className="block text-[12px] text-on-surface-variant">Vuelve a pedir los permisos de la app</span>
            </span>
            <ChevronRight size={16} className="text-on-surface-variant" />
          </button>
        ) : null}
        {confirming ? (
          <div className="px-4 py-3">
            <p className="text-[14px] font-semibold">¿Desinstalar {props.appName} de {props.spaceName}?</p>
            <p className="mt-1 text-[12px] text-on-surface-variant">{uninstallWarning(props.spaceName)}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" data-testid="app-confirmar-desinstalar" onClick={() => { setConfirming(false); props.onUninstall(); }} className="h-10 flex-1 rounded-lg bg-error text-[14px] font-semibold text-on-primary">Desinstalar</button>
              <button type="button" aria-label="Cancelar" onClick={() => setConfirming(false)} className="grid h-10 w-10 place-items-center rounded-lg border border-outline/20"><X size={15} /></button>
            </div>
          </div>
        ) : (
          <button type="button" data-testid="app-desinstalar" disabled={props.uninstalling} onClick={() => setConfirming(true)} className="flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left hover:bg-background disabled:opacity-50">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-error/10 text-error"><Trash2 size={16} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-error">{props.uninstalling ? 'Desinstalando…' : `Desinstalar de ${props.spaceName}`}</span>
              <span className="block text-[12px] text-on-surface-variant">La app sale de todos los canales. Lo que ya publicó se queda.</span>
            </span>
            <ChevronRight size={16} className="text-on-surface-variant" />
          </button>
        )}
      </div>
    </section>
  );
}
