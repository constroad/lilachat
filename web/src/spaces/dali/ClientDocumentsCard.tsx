import { useEffect, useState } from 'react';
import { Download, FileText, Film, Image as ImageIcon } from 'lucide-react';
import { documentSentLabelOf, downloadUrlOf, readableFileName, type ProspectDocument, type ProspectView } from '@lilachat/shared';
import { Kicker } from './daliParts';
import { Card } from './prospectSheetBlocks';
import { fetchProspectDocuments } from './prospectsApi';

/** «Documentos del cliente» (José 17/11): what the prospect sent in their channel; a tap downloads it. */

type DocumentsState = { status: 'loading' } | { status: 'ready'; documents: ProspectDocument[] } | { status: 'failed' };
const KIND_ICON = { image: ImageIcon, video: Film, file: FileText } as const;

/** Refetched when the prospect writes again (lastActivityAt), never on a timer. */
function useClientDocuments(jwt: string, spaceId: string, prospect: ProspectView): DocumentsState {
  const [state, setState] = useState<DocumentsState>({ status: 'loading' });
  useEffect(() => {
    const abort = new AbortController();
    const settle = (next: DocumentsState) => { if (!abort.signal.aborted) setState(next); };
    fetchProspectDocuments(jwt, spaceId, prospect.id, abort.signal)
      .then((answer) => settle(answer.ok ? { status: 'ready', documents: answer.data.documents } : { status: 'failed' }))
      .catch(() => settle({ status: 'failed' }));
    return () => abort.abort();
  }, [jwt, spaceId, prospect.id, prospect.lastActivityAt]);
  return state;
}

export function ClientDocumentsCard({ jwt, spaceId, prospect }: { jwt: string; spaceId: string; prospect: ProspectView }) {
  const state = useClientDocuments(jwt, spaceId, prospect);
  if (state.status === 'loading' || (state.status === 'ready' && !state.documents.length)) return null;
  return (
    <Card testId="ficha-documentos">
      <Kicker>Documentos del cliente</Kicker>
      {state.status === 'failed' ? <p className="mt-2 text-[13px] text-on-surface-variant">No pudimos cargar los documentos. Ábrelos desde el chat.</p> : (
        <ul className="mt-2 divide-y divide-outline/10">
          {state.documents.map((document) => {
            const Icon = KIND_ICON[document.kind];
            return (
              <li key={document.seq}>
                <a href={downloadUrlOf(document.url, document.name)} download={readableFileName(document.name)} target="_blank" rel="noreferrer" data-testid={`documento-${document.seq}`} className="flex min-h-11 items-center gap-3 py-1.5 text-[13px]">
                  <Icon size={18} className="shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{document.name}</span>
                    <span className="block text-[12px] text-on-surface-variant">{documentSentLabelOf(document.at)}</span>
                  </span>
                  <Download size={16} className="shrink-0 text-on-surface-variant" aria-label="Descargar" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
