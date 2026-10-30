import { useState } from 'react';
import { acceptAppScopes } from '../spacesApi';

/**
 * A newer manifest asks for more (pending 95): the app keeps working with what
 * was accepted until an admin taps «Aceptar permisos» (José, 30/10: before,
 * only reinstalling did it). The directory refreshes by itself afterwards.
 */
export function NewPermissionsNotice(props: { jwt: string; spaceId: string; appId: string; lines: readonly string[]; admin: boolean }) {
  const [state, setState] = useState<{ busy: boolean; done?: boolean; error?: string }>({ busy: false });
  const accept = async () => {
    setState({ busy: true });
    const result = await acceptAppScopes(props.jwt, props.spaceId, props.appId);
    setState(result.ok ? { busy: false, done: true } : { busy: false, error: result.message ?? 'No se pudieron aceptar los permisos.' });
  };
  if (state.done) return <p data-testid="app-permisos-aceptados" className="rounded-xl border border-en-linea/30 bg-en-linea/10 p-3 text-[13px] font-semibold">Permisos aceptados</p>;
  return (
    <section data-testid="app-permisos-nuevos" className="space-y-1.5 rounded-xl border border-warning/30 bg-warning/10 p-3">
      <p className="text-[14px] font-semibold">Esta app pide permisos nuevos</p>
      {props.lines.map((line) => <p key={line} className="text-[13px]">· {line}</p>)}
      {props.admin ? (
        <button type="button" data-testid="app-aceptar-permisos" disabled={state.busy} onClick={() => void accept()} className="mt-1 h-9 rounded-lg bg-primary px-3 text-[13px] font-semibold text-on-primary disabled:opacity-60">
          {state.busy ? 'Aceptando…' : 'Aceptar permisos'}
        </button>
      ) : <p className="text-[12px] text-on-surface-variant">Un admin del espacio los acepta.</p>}
      {state.error ? <p role="alert" className="text-[12px] text-error">{state.error}</p> : null}
    </section>
  );
}
