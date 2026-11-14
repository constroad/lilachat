import { useEffect, useMemo, useRef, useState } from 'react';
import { nextPointNumber, type VisitCardAction } from '@lilachat/shared';
import { openWebCamera } from '../../chat/camera/cameraRequests';
import { prepared } from '../clients/useDriveUpload';
import { usePortalFileViewer } from '../clients/PortalFileViewer';
import { MarkPointWeb } from './MarkPointWeb';
import { useVisit } from './useVisit';
import { VisitInterviewWeb } from './VisitInterviewWeb';
import type { VisitChatRef } from './visitsApi';
import type { OpenVisitAction } from './visitActionContext';


type Active = { visitId: string; action: VisitCardAction; at: number };

/** The quick ones (a loose photo, finishing, the PDF) run once the visit is read, then close. */
type OpenFile = ReturnType<typeof usePortalFileViewer>['open'];

function useQuickAction(active: Active, visit: ReturnType<typeof useVisit>, openFile: OpenFile, onDone: () => void) {
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current || !visit.draft?.ok || !['photo', 'finish', 'pdf'].includes(active.action)) return;
    ran.current = true;
    const document = visit.draft.document;
    const runs: Record<string, () => Promise<void>> = {
      photo: async () => {
        const file = await openWebCamera({ title: 'Foto de la visita' });
        if (file) await visit.screen.addPhoto((await prepared(file)).source);
      },
      finish: () => visit.screen.finish(),
      pdf: async () => {
        const url = await visit.screen.pdf();
        if (url) openFile({ url, name: `${document.code}.pdf`, mime: 'application/pdf' });
      },
    };
    void runs[active.action]!().finally(onDone);
  }, [active.action, visit.draft, visit.screen, openFile, onDone]);
}

function VisitActionScreen({ place, active, openFile, onClose }: { place: VisitChatRef; active: Active; openFile: OpenFile; onClose: (notice: string) => void }) {
  const visit = useVisit(place, active.visitId);
  const close = () => onClose(visit.screen.snapshot().notice);
  useQuickAction(active, visit, openFile, close);
  const document = visit.draft?.ok ? visit.draft.document : null;
  if (!document) return visit.draft && !visit.draft.ok ? <VisitNotice text={visit.draft.message} onClose={() => onClose('')} /> : null;
  if (active.action === 'interview') return <VisitInterviewWeb document={document} busy={Boolean(visit.busy)} onAnswer={(values) => void visit.screen.answer(values)} onClose={close} />;
  if (active.action === 'point') return <MarkPointWeb document={document} n={nextPointNumber(document)} onSave={(point, photo) => void visit.screen.markPoint(point, photo).then(close)} onClose={() => onClose('')} />;
  return null;
}

function VisitNotice({ text, onClose }: { text: string; onClose: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 4000);
    return () => window.clearTimeout(timer);
  }, [onClose]);
  return <p role="status" data-testid="visita-aviso" className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-on-surface px-4 py-2 text-[14px] text-surface shadow-lg">{text}</p>;
}

/** Mounted once per chat: the card's buttons open here; what Portal answered shows for a moment. */
export function useVisitCardActions(place: VisitChatRef | null) {
  const [active, setActive] = useState<Active | null>(null);
  const [notice, setNotice] = useState('');
  const files = usePortalFileViewer();
  const open = useMemo<OpenVisitAction | null>(() => (place ? (visitId, action) => setActive({ visitId, action, at: Date.now() }) : null), [place]);
  const finish = (said: string) => {
    setActive(null);
    setNotice(said);
  };
  const overlay = (
    <>
      {place && active ? <VisitActionScreen key={active.at} place={place} active={active} openFile={files.open} onClose={finish} /> : null}
      {files.viewer}
      {notice ? <VisitNotice text={notice} onClose={() => setNotice('')} /> : null}
    </>
  );
  return { open, overlay };
}
