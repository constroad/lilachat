import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { appLinkLine, type AppLink } from '@lilachat/shared';
import { appLink, unlinkApp } from '../spacesApi';

/**
 * «Tu cuenta en <app>» (pending 59; agentes f02cb99): the account I connected
 * is per app, like Slack. «Conectado como j•••@…» with «Desconectar», or how
 * I get connected; an app that does not answer hides the row.
 */
export function AppAccountSection(props: { jwt: string; spaceId: string; appId: string; appName: string }) {
  const [link, setLink] = useState<AppLink | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<{ busy: boolean; error?: string }>({ busy: false });

  useEffect(() => {
    let alive = true;
    setLink(null);
    setConfirming(false);
    void appLink(props.jwt, props.spaceId, props.appId).then((result) => alive && setLink(result.ok ? result.data : { unknown: true }));
    return () => {
      alive = false;
    };
  }, [props.jwt, props.spaceId, props.appId]);

  if (!link) return <div data-testid="cuenta-app-cargando" className="h-20 animate-pulse rounded-2xl bg-surface" />;
  const line = appLinkLine(link, props.appName);
  if (!line) return null;
  const disconnect = async () => {
    setStatus({ busy: true });
    const result = await unlinkApp(props.jwt, props.spaceId, props.appId);
    if (!result.ok) return setStatus({ busy: false, error: result.message });
    setConfirming(false);
    setStatus({ busy: false });
    setLink({ linked: false });
  };
  return (
    <section data-testid="cuenta-de-la-app" className="rounded-2xl border border-outline/15 bg-surface p-5">
      <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant"><UserRound size={15} className="text-primary" /> Tu cuenta en {props.appName}</p>
      <div className="flex flex-wrap items-center gap-3">
        <p data-testid="cuenta-app-linea" className={`min-w-0 flex-1 text-[14px] ${'linked' in link && link.linked ? 'font-semibold' : 'text-on-surface-variant'}`}>{line}</p>
        {'linked' in link && link.linked && !confirming ? (
          <button type="button" data-testid="app-desconectar" onClick={() => setConfirming(true)} className="h-10 rounded-xl border border-outline/25 px-4 text-[14px] font-semibold text-error hover:bg-background">Desconectar</button>
        ) : null}
      </div>
      {confirming ? (
        <div className="mt-3 rounded-xl border border-error/25 bg-error/5 p-3">
          <p className="text-[13px]">{`${props.appName} te volverá a pedir tu correo o número la próxima vez que la uses.`}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" data-testid="app-confirmar-desconectar" disabled={status.busy} onClick={() => void disconnect()} className="h-9 rounded-lg bg-error px-3 text-[13px] font-semibold text-on-primary disabled:opacity-50">{status.busy ? 'Desconectando…' : 'Desconectar'}</button>
            <button type="button" disabled={status.busy} onClick={() => setConfirming(false)} className="h-9 rounded-lg border border-outline/25 px-3 text-[13px]">Cancelar</button>
          </div>
        </div>
      ) : null}
      {status.error ? <p role="alert" className="mt-2 text-[13px] text-error">{status.error}</p> : null}
    </section>
  );
}
