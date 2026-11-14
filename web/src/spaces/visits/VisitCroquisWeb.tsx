import { useCallback, useEffect, useState } from 'react';
import type { VisitDocument } from '@lilachat/shared';
import { FRAMED_ORIGINS, PortalEmbedFrame, type LinkState } from '../clients/reports/PortalEmbedWeb';
import type { useVisit } from './useVisit';

const CROQUIS_FAILED = 'No se pudo abrir el croquis.';

/**
 * «Abrir croquis» (Portal 14/11, agentes 5ea69d0): Portal's croquis editor of the visit, in the same frame as the
 * report editor. Its link lives only here, never in a message: it opens the visit to whoever has it (12 h).
 */
export function VisitCroquisWeb({ visit, document, onClose }: { visit: ReturnType<typeof useVisit>; document: VisitDocument; onClose: () => void }) {
  const [state, setState] = useState<LinkState>({ kind: 'asking' });
  const [round, setRound] = useState(0);
  const { screen } = visit;
  useEffect(() => {
    let alive = true;
    setState({ kind: 'asking' });
    void screen.croquis(FRAMED_ORIGINS).then((link) => {
      if (alive) setState(link ? { kind: 'ready', link } : { kind: 'failed', message: screen.snapshot().notice || CROQUIS_FAILED });
    });
    return () => { alive = false; };
  }, [screen, round]);
  const again = useCallback(() => setRound((count) => count + 1), []);
  // Each croquis change is saved by Portal at once; closing reads the visit again for its card and figures.
  const close = useCallback(() => {
    void screen.reload();
    onClose();
  }, [screen, onClose]);
  return <PortalEmbedFrame state={state} again={again} kicker={`Visita técnica · ${document.code}`} title="Croquis" onClose={close} />;
}
