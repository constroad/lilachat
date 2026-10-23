import { useEffect, useState } from 'react';
import { AlertTriangle, Bot } from 'lucide-react';
import { appDeliveryWarning, appInstalledLine, type SpaceApp } from '@lilachat/shared';
import { spaceApps, uninstallApp } from './spacesApi';
import { AvailableApps } from './AvailableApps';

/**
 * Integraciones in the space's settings (`specs/BOTS-API.spec.md`): the
 * installed apps (Lila), who installed them, whether their last event arrived,
 * and «Desinstalar» (the app hears it and its token dies). «Instalar» lists
 * the apps with an install page (agentes, 23/10).
 */
export function IntegrationsSection(props: { jwt: string; spaceId: string }) {
  const [apps, setApps] = useState<SpaceApp[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void spaceApps(props.jwt, props.spaceId).then((result) => (result.ok ? setApps(result.data.apps) : setFailed(true)));
  }, [props.jwt, props.spaceId]);
  const uninstall = async (app: SpaceApp) => {
    setBusy(true);
    const result = await uninstallApp(props.jwt, props.spaceId, app.id);
    setBusy(false);
    setConfirming(null);
    if (result.ok) setApps((before) => (before ?? []).filter((one) => one.id !== app.id));
    else setFailed(true);
  };
  return (
    <section data-testid="seccion-integraciones" className="mt-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Integraciones</p>
      {apps === null && !failed ? <div className="mt-2 h-14 animate-pulse rounded-xl bg-background" /> : null}
      {failed ? <p role="alert" className="mt-2 text-[13px] text-error">No se pudieron cargar las apps. Vuelve a abrir los ajustes.</p> : null}
      {apps && apps.length === 0 ? <p className="mt-2 rounded-xl bg-background px-3 py-3 text-[13px] text-on-surface-variant">No hay apps instaladas.</p> : null}
      <div className="mt-2 space-y-2">
        {apps?.map((app) => (
          <div key={app.id} data-testid={`app-${app.id}`} className="rounded-xl border border-outline/15 p-3">
            <div className="flex items-center gap-3">
              {app.avatarUrl ? <img src={app.avatarUrl} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Bot size={20} /></span>}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-semibold">{app.name}<span className="rounded-md bg-background px-1.5 py-px text-[10px] font-bold text-on-surface-variant">App</span></p>
                <p className="text-[12px] text-on-surface-variant">{appInstalledLine(app)}</p>
              </div>
              {confirming === app.id ? null : <button type="button" data-testid={`desinstalar-${app.id}`} onClick={() => setConfirming(app.id)} className="h-9 rounded-lg border border-error/30 px-3 text-sm font-semibold text-error hover:bg-error/5">Desinstalar</button>}
            </div>
            {appDeliveryWarning(app) ? <p className="mt-2 flex items-start gap-1.5 text-[12px] text-warning"><AlertTriangle size={14} className="mt-px shrink-0" />{appDeliveryWarning(app)}</p> : null}
            {confirming === app.id ? (
              <div className="mt-3 rounded-lg bg-error/5 p-3">
                <p className="text-[13px]">{`¿Desinstalar ${app.name}? Dejará de publicar y de recibir mensajes en este espacio.`}</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => setConfirming(null)} className="h-9 flex-1 rounded-lg border border-outline/25 text-sm font-semibold">Cancelar</button>
                  <button type="button" data-testid={`confirmar-desinstalar-${app.id}`} disabled={busy} onClick={() => void uninstall(app)} className="h-9 flex-1 rounded-lg bg-error text-sm font-semibold text-white disabled:opacity-60">Desinstalar</button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <AvailableApps jwt={props.jwt} spaceId={props.spaceId} />
    </section>
  );
}
