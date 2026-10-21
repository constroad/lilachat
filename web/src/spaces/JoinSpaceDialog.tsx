import { useEffect, useState } from 'react';
import { ArrowRight, Check, Lock } from 'lucide-react';
import { formatClock, normalizeJoinCode, spaceSubtitle, type WorkspacePreview } from '@lilachat/shared';
import { FieldError, Overlay, PrimaryButton } from '../ui/Overlay';
import { SpaceLogo } from './SpaceLogo';
import { joinSpace, leaveSpace, previewSpace } from './spacesApi';

/** A pause after the last key before asking for the preview. */
const PREVIEW_DELAY_MS = 350;

/**
 * «Unirme a un espacio» (designs `e1-02-unirse-codigo` and
 * `e1-03-solicitud-enviada`): the code, or the whole link, shows the space
 * before joining; an open space lets in at once, otherwise the request waits
 * for an admin and can be withdrawn. Personal chats are never shared.
 */
export function JoinSpaceDialog(props: { jwt: string; onJoined: (spaceId: string) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<WorkspacePreview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState<{ space: WorkspacePreview; at: string } | null>(null);
  const code = normalizeJoinCode(text);

  useEffect(() => {
    setPreview(null);
    if (!code) return;
    let current = true;
    const timer = setTimeout(() => {
      void previewSpace(props.jwt, code).then((response) => {
        if (!current) return;
        if (response.ok) {
          setPreview(response.data);
          setError('');
        } else setError(response.status === 404 ? 'No encontramos un espacio con ese código.' : response.message);
      });
    }, PREVIEW_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [code, props.jwt]);

  const join = async () => {
    if (!code || !preview || busy) return;
    setBusy(true);
    const response = await joinSpace(props.jwt, code);
    setBusy(false);
    if (!response.ok) return setError(response.message);
    if (response.data.status === 'active') return props.onJoined(response.data.workspaceId);
    setRequested({ space: preview, at: new Date().toISOString() });
  };
  const withdraw = async () => {
    if (!requested) return;
    const response = await leaveSpace(props.jwt, requested.space.id);
    if (!response.ok) return setError(response.message);
    props.onClose();
  };

  if (requested) {
    return (
      <Overlay title="Solicitud enviada" onClose={props.onClose} footer={
        <div className="space-y-1">
          <PrimaryButton testId="solicitud-ir-a-chats" onClick={props.onClose}>Ir a mis chats</PrimaryButton>
          <button type="button" data-testid="solicitud-cancelar" onClick={() => void withdraw()} className="h-11 w-full text-sm font-semibold text-error">Cancelar solicitud</button>
        </div>
      }>
        <div data-testid="solicitud-enviada" className="flex flex-col items-center py-4 text-center">
          <SpaceLogo space={requested.space} size={72} />
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Solicitud enviada</p>
          <h3 className="mt-1 text-xl font-bold tracking-tight">{`Pediste unirte a ${requested.space.name}`}</h3>
          <p className="mt-2 text-sm leading-5 text-on-surface-variant">Te avisamos cuando un admin apruebe tu ingreso. Mientras tanto puedes usar tus chats personales.</p>
          <p className="mt-3 flex items-center gap-2 text-[13px] text-on-surface-variant">
            <span className="rounded border border-primary/30 bg-primary/10 px-1.5 text-[11px] font-bold text-primary">PENDIENTE</span>
            {`Enviada hoy ${formatClock(requested.at)}`}
          </p>
          <FieldError>{error}</FieldError>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay title="Unirme a un espacio" onClose={props.onClose} footer={
      <PrimaryButton testId="btn-unirse" disabled={!preview || busy} onClick={() => void join()}>
        <span className="flex items-center gap-2">{preview?.joinPolicy === 'open' ? 'Entrar' : 'Pedir acceso'} <ArrowRight size={16} /></span>
      </PrimaryButton>
    }>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Unirme a un espacio</p>
      <h3 className="mt-1 text-xl font-bold tracking-tight">Escribe el código de tu empresa</h3>
      <p className="mt-1 text-sm text-on-surface-variant">Te lo manda un admin por WhatsApp o en un enlace.</p>
      <label htmlFor="codigo-espacio" className="mb-1.5 mt-5 block text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Código de ingreso</label>
      <div className={`flex h-14 items-center gap-2 rounded-xl border bg-background px-3 ${preview ? 'border-primary' : 'border-outline/25'}`}>
        <input id="codigo-espacio" data-testid="input-codigo-espacio" value={text} onChange={(event) => setText(event.target.value)} autoFocus autoComplete="off" spellCheck={false} placeholder="CONS-7K3P o el enlace" className="min-w-0 flex-1 bg-transparent font-mono text-lg uppercase tracking-widest outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-on-surface-variant" />
        {preview ? <span className="flex items-center gap-1 rounded-md border border-en-linea/40 bg-en-linea/10 px-2 py-0.5 text-[11px] font-bold text-en-linea"><Check size={12} /> VÁLIDO</span> : null}
      </div>
      {error ? <p data-testid="error-codigo" role="alert" className="mt-1.5 text-[12px] text-error">{error}</p> : null}
      {preview ? (
        <div data-testid="vista-previa-espacio" className="mt-4 overflow-hidden rounded-xl border border-outline/15">
          <div className="h-[3px] bg-primary" />
          <div className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Vista previa del espacio</p>
            <div className="mt-3 flex items-center gap-3">
              <SpaceLogo space={preview} size={48} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold">{preview.name}</p>
                <p className="text-[13px] text-on-surface-variant">{spaceSubtitle(preview)}</p>
              </div>
            </div>
            <p className={`mt-3 inline-block rounded-md border px-2 py-0.5 text-[11px] font-bold ${preview.joinPolicy === 'approval' ? 'border-primary/30 bg-primary/10 text-primary' : 'border-en-linea/40 bg-en-linea/10 text-en-linea'}`}>
              {preview.joinPolicy === 'approval' ? 'UN ADMIN APRUEBA TU INGRESO' : 'ENTRAS DE INMEDIATO'}
            </p>
          </div>
        </div>
      ) : null}
      <p className="mt-4 flex items-center justify-center gap-2 text-[13px] text-on-surface-variant"><Lock size={14} className="text-primary" /> Tus chats personales no se comparten con la empresa</p>
    </Overlay>
  );
}
