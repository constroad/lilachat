import { useState, type ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import type { ProgressPdfResult } from '@lilachat/shared';

type State = { kind: 'idle' } | { kind: 'busy' } | { kind: 'ready'; url: string } | { kind: 'failed'; message: string };

/** A map PDF made by Portal: the button asks for it, then the sheet opens from a real link (no blocked pop-up). */
export function PdfAction(props: { testId: string; label: string; icon: ReactNode; className: string; create: () => Promise<ProgressPdfResult> }) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const make = async () => {
    setState({ kind: 'busy' });
    const made = await props.create();
    setState(made.ok ? { kind: 'ready', url: made.url } : { kind: 'failed', message: made.message });
  };
  if (state.kind === 'ready') {
    return <a data-testid={`${props.testId}-abrir`} href={state.url} target="_blank" rel="noopener noreferrer" className={props.className}><ExternalLink size={16} />Abrir PDF</a>;
  }
  return (
    <div>
      <button type="button" data-testid={props.testId} disabled={state.kind === 'busy'} onClick={() => void make()} className={`${props.className} disabled:opacity-60`}>{props.icon}{state.kind === 'busy' ? 'Generando PDF…' : props.label}</button>
      {state.kind === 'failed' ? <p role="alert" data-testid={`${props.testId}-error`} className="mt-1.5 text-[12px] font-semibold text-error">{state.message}</p> : null}
    </div>
  );
}
