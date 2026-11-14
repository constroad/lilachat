import { useState, type ReactNode } from 'react';
import { AlertTriangle, Camera, CheckCircle2, ChevronLeft, ClipboardList, FileText, ImagePlus, Plus } from 'lucide-react';
import { formKeyOf, nextPointNumber, pointLine, visitNextStep, type OpenVisitRow, type VisitDocument } from '@lilachat/shared';
import { loadPerfil } from '../../api';
import { AppFormDialog } from '../../chat/commands/AppFormDialog';
import { EphemeralAnswers } from '../../chat/commands/EphemeralAnswers';
import { openWebCamera } from '../../chat/camera/cameraRequests';
import { prepared } from '../clients/useDriveUpload';
import { usePortalFileViewer } from '../clients/PortalFileViewer';
import { MarkPointWeb } from './MarkPointWeb';
import { useVisit } from './useVisit';
import type { VisitPlaceRef } from './visitsApi';

type Props = { place: VisitPlaceRef; visitId?: string | null; onClose: () => void };
type Visit = ReturnType<typeof useVisit>;

function Header({ document, onBack }: { document: VisitDocument | null; onBack: () => void }) {
  const kicker = document?.id ? `Visita técnica · ${document.code}` : 'Visitas técnicas';
  const title = document?.details?.prospect || (document?.id ? document.title : 'Nueva visita');
  return (
    <div className="flex items-start gap-2">
      <button type="button" data-testid="visita-volver" onClick={onBack} aria-label="Volver" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-primary"><ChevronLeft size={22} /></button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-bold uppercase tracking-[1.5px] text-primary">{kicker}</p>
        <h2 className="mt-0.5 text-[20px] font-bold text-on-surface">{title}</h2>
      </div>
      {document?.id ? <span data-testid="visita-estado" className="rounded-md border border-outline/30 px-2 py-1 text-[11px] font-bold uppercase text-on-surface-variant">{document.stageLabel}</span> : null}
    </div>
  );
}

function Figures({ document }: { document: VisitDocument }) {
  const { questions, answered, points, photos } = document.figures;
  const cell = (label: string, value: string, testId: string) => (
    <div className="flex-1 py-2 text-center">
      <p className="text-[11px] font-bold uppercase tracking-[1px] text-on-surface-variant">{label}</p>
      <p data-testid={testId} className="mt-0.5 text-[20px] font-bold tabular-nums text-on-surface">{value}</p>
    </div>
  );
  return (
    <div className="flex divide-x divide-outline/15 rounded-2xl border border-outline/15 bg-surface">
      {cell('Entrevista', `${answered} de ${questions}`, 'visita-entrevista')}
      {cell('Puntos', String(points), 'visita-puntos')}
      {cell('Fotos', String(photos), 'visita-fotos')}
    </div>
  );
}

function ActionButton({ testId, label, icon, primary, disabled, onClick }: { testId: string; label: string; icon: ReactNode; primary?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button type="button" data-testid={testId} disabled={disabled} onClick={onClick} className={`flex min-h-[56px] items-center justify-center gap-2 rounded-2xl px-3 text-[15px] font-bold uppercase disabled:opacity-50 ${primary ? 'bg-primary text-on-primary' : 'border border-outline/20 bg-surface text-on-surface'}`}>{icon}{label}</button>;
}

/** Marcar punto · Entrevista · Foto suelta · Terminar (design lv01); a finished visit only shows its PDF. */
function Actions({ document, visit, onMark, onPdf }: { document: VisitDocument; visit: Visit; onMark: () => void; onPdf: () => void }) {
  const busy = Boolean(visit.busy);
  if (document.finished) return <ActionButton testId="visita-pdf" label="Ver PDF" icon={<FileText size={18} />} primary disabled={busy} onClick={onPdf} />;
  const loosePhoto = async () => {
    const file = await openWebCamera({ title: 'Foto de la visita' });
    if (file) void visit.screen.addPhoto((await prepared(file)).source);
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      <ActionButton testId="visita-marcar-punto" label="Marcar punto" icon={<Camera size={18} />} primary disabled={busy} onClick={onMark} />
      <ActionButton testId="visita-abrir-entrevista" label="Entrevista" icon={<ClipboardList size={18} className="text-primary" />} disabled={busy} onClick={() => void visit.openSection('entrevista')} />
      <ActionButton testId="visita-foto-suelta" label="Foto suelta" icon={<ImagePlus size={18} className="text-primary" />} disabled={busy} onClick={() => void loosePhoto()} />
      <ActionButton testId="visita-terminar" label="Terminar" icon={<CheckCircle2 size={18} className="text-primary" />} disabled={busy} onClick={() => void visit.screen.finish()} />
    </div>
  );
}

function PointRows({ document }: { document: VisitDocument }) {
  if (!document.points.length) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-outline/15 bg-surface">
      <p className="border-b border-outline/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">Puntos</p>
      {document.points.map((point) => (
        <div key={point.id} data-testid={`visita-punto-${point.n}`} className="flex min-h-[52px] items-center gap-3 border-b border-outline/10 px-4 py-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-on-primary">{point.n}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-on-surface">{pointLine(point)}</p>
            {point.note ? <p className="truncate text-[12px] text-on-surface-variant">{point.note}</p> : null}
          </div>
          {point.media.length ? <span className="text-[12px] text-on-surface-variant">{`${point.media.length} foto${point.media.length === 1 ? '' : 's'}`}</span> : null}
        </div>
      ))}
    </div>
  );
}

function SectionRows({ document, visit }: { document: VisitDocument; visit: Visit }) {
  return (
    <>
      {document.sections.filter((section) => section.id === 'datos' || section.id === 'conclusion').map((section) => (
        <button key={section.id} type="button" data-testid={`visita-seccion-${section.id}`} disabled={document.finished} onClick={() => void visit.openSection(section.id as 'datos' | 'conclusion')} className="rounded-2xl border border-outline/15 bg-surface p-4 text-left">
          <p className="text-[15px] font-bold text-on-surface">{section.title}</p>
          {section.summary.slice(0, 2).map((line) => <p key={line} className="mt-0.5 truncate text-[13px] text-on-surface-variant">{line}</p>)}
        </button>
      ))}
    </>
  );
}

function MissingLine({ document }: { document: VisitDocument }) {
  const step = visitNextStep(document);
  if (step.kind !== 'interview' && step.kind !== 'missing') return null;
  return <p data-testid="visita-falta" className="flex items-center gap-2 px-1 text-[13px] text-on-surface-variant"><AlertTriangle size={15} className="text-primary" />{step.kind === 'interview' ? `Falta: ${step.unanswered} preguntas de la entrevista` : step.label}</p>;
}

/** A new visit: «Crear visita» and the ones still open, to go on with one. */
function OpenVisits({ rows, visit }: { rows: OpenVisitRow[]; visit: Visit }) {
  return (
    <>
      <button type="button" data-testid="visita-crear" disabled={Boolean(visit.busy)} onClick={() => void visit.openSection('datos')} className="flex min-h-[72px] items-center justify-center gap-2 rounded-2xl bg-primary text-[17px] font-bold text-on-primary"><Plus size={20} />Crear visita</button>
      {rows.length ? <p className="mt-2 text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">Visitas abiertas</p> : null}
      {rows.map((row) => (
        <button key={row.id} type="button" data-testid={`visita-abierta-${row.code}`} onClick={() => void visit.screen.choose(row.id)} className="rounded-2xl border border-outline/15 bg-surface p-4 text-left">
          <p className="font-mono text-[12px] text-primary">{`${row.code} · ${row.stageLabel}`}</p>
          <p className="mt-0.5 truncate text-[15px] font-bold text-on-surface">{row.prospect || row.place}</p>
          <p className="truncate text-[13px] text-on-surface-variant">{`${row.place} · ${row.points} punto${row.points === 1 ? '' : 's'}`}</p>
        </button>
      ))}
    </>
  );
}

function Body({ visit, onMark, onPdf }: { visit: Visit; onMark: () => void; onPdf: () => void }) {
  const { draft } = visit;
  if (draft === null) return <div data-testid="visita-cargando" className="h-40 animate-pulse rounded-2xl bg-surface-variant" />;
  if (!draft.ok) return <div data-testid="visita-fallo" className="rounded-2xl border border-outline/15 bg-surface p-4"><p className="text-[15px] font-semibold text-on-surface">{draft.message}</p><button type="button" data-testid="visita-reintentar" onClick={() => void visit.screen.reload()} className="mt-3 min-h-[48px] w-full rounded-xl border border-primary/30 bg-primary/10 text-[15px] font-semibold text-primary">Reintentar</button></div>;
  const { document } = draft;
  if (!document.id) return <OpenVisits rows={draft.visits} visit={visit} />;
  return (
    <>
      {document.details?.place ? <p className="text-[13px] text-on-surface-variant">{document.details.place}</p> : null}
      <Figures document={document} />
      <Actions document={document} visit={visit} onMark={onMark} onPdf={onPdf} />
      <MissingLine document={document} />
      <PointRows document={document} />
      <SectionRows document={document} visit={visit} />
    </>
  );
}

/**
 * The technical visit on the web (José 13/11; designs lv01–lv03), over the chat it was opened from:
 * the same flow as the APK. Behind `SITE_VISITS_OPEN_HERE`.
 */
export function VisitScreenWeb(props: Props) {
  const visit = useVisit(props.place, props.visitId ?? null);
  const files = usePortalFileViewer();
  const [marking, setMarking] = useState(false);
  const document = visit.draft?.ok ? visit.draft.document : null;
  const pdf = async () => {
    const url = await visit.screen.pdf();
    if (url && document) files.open({ url, name: `${document.code}.pdf`, mime: 'application/pdf' });
  };
  const openForm = visit.answers.openForm;
  return (
    <div data-testid="visita-pantalla" className="fixed inset-0 z-30 overflow-y-auto bg-background">
      <div className="mx-auto flex max-w-[720px] flex-col gap-3 p-4 pb-8">
        <Header document={document} onBack={props.onClose} />
        <EphemeralAnswers answers={visit.answers.answers} onDismiss={visit.answers.dismiss} onOpenForm={visit.answers.showForm} chatId={props.place.chatId} jwt={props.place.jwt} />
        <Body visit={visit} onMark={() => setMarking(true)} onPdf={() => void pdf()} />
        {visit.busy ? <p data-testid="visita-ocupada" className="text-center text-[13px] text-on-surface-variant">{visit.busy}</p> : null}
        {visit.notice ? <p data-testid="visita-aviso" className="text-center text-[13px] text-on-surface">{visit.notice}</p> : null}
      </div>
      {marking && document ? <MarkPointWeb document={document} n={nextPointNumber(document)} onClose={() => setMarking(false)} onSave={(point, photo) => { setMarking(false); void visit.screen.markPoint(point, photo); }} /> : null}
      {openForm ? <AppFormDialog key={formKeyOf(openForm)} answer={openForm} personName={loadPerfil()?.name} onSubmit={(values) => visit.answers.submitForm(openForm, values)} onUpload={(file, stamp) => visit.answers.uploadPhoto(openForm.commandId, file, stamp)} onClose={() => visit.answers.dismiss(openForm.commandId)} /> : null}
      {files.viewer}
    </div>
  );
}
