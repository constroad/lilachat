import { useState } from 'react';
import { Check, Copy, Link2, Loader2, Share2 } from 'lucide-react';
import { SERVICE_LINK_DAY_OPTIONS, type ServiceLinkChoice, type ServiceMapResult } from '@lilachat/shared';
import { Overlay } from '../../ui/Overlay';

export type ServiceLinkCreate = (choice: ServiceLinkChoice) => Promise<ServiceMapResult>;
type LinkState = { busy: boolean; url: string | null; error: string | null };
const IDLE: LinkState = { busy: false, url: null, error: null };
const OPTION = 'h-10 flex-1 rounded-xl border text-[13px] font-semibold';

/** The term of the link: 7, 30 or 60 days, or «No expira». */
function TermPicker(props: { choice: ServiceLinkChoice; onChoice: (choice: ServiceLinkChoice) => void }) {
  const { choice } = props;
  const tone = (on: boolean) => (on ? 'border-primary bg-primary/10 text-primary' : 'border-outline/20 text-on-surface');
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] font-semibold text-on-surface">Vigencia</p>
      <div className="flex gap-2">
        {SERVICE_LINK_DAY_OPTIONS.map((days) => (
          <button key={days} type="button" data-testid={`enlace-servicio-dias-${days}`} aria-pressed={!choice.never && choice.days === days} onClick={() => props.onChoice({ days, never: false })} className={`${OPTION} ${tone(!choice.never && choice.days === days)}`}>{`${days} días`}</button>
        ))}
        <button type="button" data-testid="enlace-servicio-no-expira" aria-pressed={choice.never} onClick={() => props.onChoice({ ...choice, never: true })} className={`${OPTION} ${tone(choice.never)}`}>No expira</button>
      </div>
    </div>
  );
}

/** The link made: its address, «Copiar» and, where the browser shares, «Compartir». */
function MadeLink({ url }: { url: string }) {
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const copy = () => navigator.clipboard.writeText(url).then(() => setCopied('done'), (failure: Error) => {
    console.warn('service link: copy refused', failure.name);
    setCopied('failed');
  });
  const share = () => navigator.share({ url }).catch((failure: Error) => console.warn('service link: share closed', failure.name));
  return (
    <div className="flex flex-col gap-2">
      <p data-testid="enlace-servicio-url" className="truncate rounded-lg border border-outline/20 bg-background px-2.5 py-2 font-mono text-[12px] text-on-surface">{url}</p>
      <div className="flex gap-2">
        <button type="button" data-testid="enlace-servicio-copiar" onClick={() => void copy()} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary/10 text-[13px] font-semibold text-primary">{copied === 'done' ? <Check size={15} /> : <Copy size={15} />}{copied === 'done' ? 'Copiado' : 'Copiar'}</button>
        {typeof navigator.share === 'function' ? <button type="button" data-testid="enlace-servicio-compartir" onClick={() => void share()} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-outline/20 text-[13px] font-semibold text-on-surface"><Share2 size={15} /> Compartir</button> : null}
      </div>
      {copied === 'failed' ? <p role="alert" className="text-[12px] text-error">El navegador no dejó copiar. Selecciona el enlace y cópialo.</p> : null}
    </div>
  );
}

/**
 * «Enlace del servicio» (José 20/11: it only took him to the chat and did nothing): the public link
 * of the service made here, over the service, with its term; copied or shared from the sheet.
 */
export function ServiceLinkSheetWeb(props: { serviceName: string; create: ServiceLinkCreate; onClose: () => void }) {
  const [choice, setChoice] = useState<ServiceLinkChoice>({ days: SERVICE_LINK_DAY_OPTIONS[0], never: false });
  const [state, setState] = useState<LinkState>(IDLE);
  const pick = (next: ServiceLinkChoice) => { setChoice(next); setState(IDLE); };
  const create = async () => {
    setState({ busy: true, url: null, error: null });
    const made = await props.create(choice);
    setState(made.ok ? { busy: false, url: made.url, error: null } : { busy: false, url: null, error: made.message });
  };
  return (
    <Overlay title="Enlace del servicio" onClose={props.onClose}>
      <div data-testid="hoja-enlace-servicio" className="flex flex-col gap-4">
        <p className="text-[13px] text-on-surface-variant">{`El cliente abre «${props.serviceName}» sin cuenta de Portal.`}</p>
        <TermPicker choice={choice} onChoice={pick} />
        {state.url ? <MadeLink url={state.url} /> : null}
        {state.error ? <p role="alert" data-testid="enlace-servicio-error" className="text-[13px] font-semibold text-error">{state.error}</p> : null}
        {!state.url ? (
          <button type="button" data-testid="enlace-servicio-crear" disabled={state.busy} onClick={() => void create()} className="flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary text-[15px] font-semibold text-on-primary disabled:opacity-60">
            {state.busy ? <Loader2 size={17} className="animate-spin" /> : <Link2 size={17} />}{state.busy ? 'Creando…' : 'Crear enlace'}
          </button>
        ) : null}
      </div>
    </Overlay>
  );
}
