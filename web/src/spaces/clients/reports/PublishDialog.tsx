import { ChevronRight } from 'lucide-react';
import { blockerPathOf, type FieldDocument, type SectionPath } from '@lilachat/shared';
import { Overlay, PrimaryButton } from '../../../ui/Overlay';

const CHANNEL_NOTE = 'El PDF se genera y llega al canal del cliente.';

/**
 * «Publicar informe» (design j-04): what Portal says is still missing, with
 * the button off until nothing is; ready, the button opens Portal's publish
 * form (the note for the channel). Published, the hub itself shows the PDF.
 */
export function PublishDialog(props: { report: FieldDocument; blockers: readonly string[]; onClose: () => void; onPublish: () => void; /** A line that names a unit opens it (José 09/11: «falta escantillón» was the cm, not the photo). */ onOpen?: (path: SectionPath) => void }) {
  const { blockers } = props;
  const ready = blockers.length === 0;
  const footer = (
    <div className="flex flex-col gap-2">
      <PrimaryButton testId="confirmar-publicar" onClick={props.onPublish} disabled={!ready}>{props.report.publish.label}</PrimaryButton>
      <button type="button" data-testid="seguir-llenando" onClick={props.onClose} className="h-11 w-full rounded-xl border border-outline/20 text-sm font-semibold hover:bg-background">Seguir llenando</button>
    </div>
  );
  return (
    <Overlay title="Publicar el informe" onClose={props.onClose} footer={footer}>
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Publicar informe</p>
      <h3 className="mt-1 text-xl font-bold">{ready ? 'Todo listo' : 'Todavía falta'}</h3>
      <ul className="mt-3 flex flex-col gap-2">
        {blockers.map((line) => {
          const path = props.onOpen ? blockerPathOf(props.report, line) : null;
          const body = <><span className="h-3 w-3 shrink-0 rounded-full border-2 border-error bg-error/30" /><span className="flex-1 text-sm font-semibold">{line}</span>{path ? <ChevronRight size={16} className="shrink-0 text-primary" /> : null}</>;
          return (
            <li key={line} data-testid="falta-publicar">
              {path
                ? <button type="button" onClick={() => props.onOpen?.(path)} className="flex w-full items-center gap-3 rounded-xl border border-outline/10 bg-background px-3 py-3 text-left hover:border-primary/40">{body}</button>
                : <div className="flex items-center gap-3 rounded-xl border border-outline/10 bg-background px-3 py-3">{body}</div>}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-on-surface-variant">{ready ? CHANNEL_NOTE : `Cuando lo completes, ${CHANNEL_NOTE.charAt(0).toLowerCase()}${CHANNEL_NOTE.slice(1)}`}</p>
    </Overlay>
  );
}
