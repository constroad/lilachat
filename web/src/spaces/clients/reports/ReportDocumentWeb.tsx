import { useState } from 'react';
import { AlertTriangle, ChevronLeft, ExternalLink, FileText } from 'lucide-react';
import { formKeyOf, isUnitsRepeat, itemsLine, pendingOf, publishBlockers, publishFooterLine, reportTypeLabel, reportViewOf, sectionBadge, STATUS_BADGE, type DocumentSection, type FieldDocument, type ReportDraftResult, type SectionPath, type SpaceClientService } from '@lilachat/shared';
import { loadPerfil } from '../../../api';
import { AppFormDialog } from '../../../chat/commands/AppFormDialog';
import { EphemeralAnswers } from '../../../chat/commands/EphemeralAnswers';
import { useReportPdf } from '../useReportPdf';
import type { ServiceAskTarget } from '../useServiceAsk';
import { PublishDialog } from './PublishDialog';
import { ReportItemsWeb } from './ReportItemsWeb';
import { ReportUnitsWeb } from './ReportUnitsWeb';
import { Pill, ProgressCard, QueueCard, SectionCard } from './ReportSectionsWeb';
import { useFieldDocument } from './useFieldDocument';
import { useReportForms } from './useReportForms';

type Props = { target: ServiceAskTarget; chatId: string; service: SpaceClientService; type: string; portalUrl?: string; onClose: (changed: boolean) => void };

/** Kicker, title and state (design j-02 desktop): the type over the service, the pill at the right. */
function ReportHeader({ kicker, title, report, onBack }: { kicker: string; title: string; report: FieldDocument | null; onBack: () => void }) {
  return (
    <header className="flex items-start gap-2">
      <button type="button" data-testid="volver-al-servicio" aria-label="Volver" onClick={onBack} className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-primary hover:bg-surface"><ChevronLeft size={22} /></button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{kicker}</p>
        <h2 className="mt-0.5 text-xl font-bold md:text-2xl">{title}</h2>
      </div>
      {report ? <Pill badge={STATUS_BADGE[report.status]} testId="estado-informe" /> : null}
    </header>
  );
}

function DraftFailure({ message, portalUrl }: { message: string; portalUrl?: string }) {
  return (
    <div data-testid="informe-fallo" className="rounded-xl border border-outline/15 bg-surface p-4 text-sm">
      <p className="mb-2 font-semibold">{message}</p>
      {portalUrl ? <a href={portalUrl} target="_blank" rel="noreferrer" data-testid="informe-fallo-portal" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"><ExternalLink size={14} /> Abrir el servicio en el Portal</a> : null}
    </div>
  );
}

/** One card per section; a repeat (the tramos) opens its own list. Published, nothing opens. */
function HubCards({ report, onOpen, onOpenItems }: { report: FieldDocument; onOpen: (path: SectionPath) => void; onOpenItems: (sectionId: string) => void }) {
  const locked = report.status === 'published';
  const cardOf = (section: DocumentSection) => {
    const badge = sectionBadge(section.state, section.required, pendingOf(section));
    const open = section.enabled && !locked;
    if (section.kind === 'repeat') {
      const first = section.items[0];
      return <SectionCard key={section.id} testId={`seccion-${section.id}`} title={section.title} badge={badge} state={section.state} summary={[itemsLine(section), ...(first?.summary ?? [])]} results={first?.results ?? []} onPress={open ? () => onOpenItems(section.id) : undefined} />;
    }
    return <SectionCard key={section.id} testId={`seccion-${section.id}`} title={section.title} badge={badge} state={section.state} summary={section.summary} results={section.results} onPress={open ? () => onOpen({ sectionId: section.id, itemId: null, key: section.id }) : undefined} />;
  };
  return <>{report.sections.map(cardOf)}</>;
}

/** Under the cards: what still blocks «Publicar» and the button, or the PDF once published (design j-04). */
function ReportFooter({ report, blocker, pdf, onPublish, onDone }: { report: FieldDocument; blocker?: string; pdf: ReturnType<typeof useReportPdf>; onPublish: () => void; onDone: () => void }) {
  if (report.status === 'published') {
    return (
      <footer data-testid="informe-publicado" className="sticky bottom-0 flex flex-col gap-2 border-t border-outline/10 bg-background pt-3">
        <p className="text-center font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Informe publicado</p>
        <p className="text-center text-sm text-on-surface-variant">El PDF se genera y llega al canal del cliente.</p>
        {pdf.readyUrl ? <a href={pdf.readyUrl} target="_blank" rel="noreferrer" data-testid="abrir-pdf-informe" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 text-sm font-semibold text-primary"><FileText size={16} /> Abrir PDF</a> : null}
        {!pdf.readyUrl ? <button type="button" data-testid="ver-pdf-informe" disabled={pdf.asking} onClick={() => void pdf.ask(report.id ?? '')} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 text-sm font-semibold text-primary disabled:opacity-60"><FileText size={16} /> {pdf.asking ? 'Pidiendo el PDF…' : 'Ver PDF'}</button> : null}
        {pdf.message ? <p className="text-center text-[13px] text-error">{pdf.message}</p> : null}
        <button type="button" data-testid="volver-informe-listo" onClick={onDone} className="h-11 rounded-xl bg-primary text-sm font-bold text-on-primary">Volver al servicio</button>
      </footer>
    );
  }
  return (
    <footer className="sticky bottom-0 flex flex-col gap-2 border-t border-outline/10 bg-background pt-3">
      {blocker ? <p data-testid="falta-informe" className="inline-flex items-center justify-center gap-2 text-[13px] font-semibold text-on-surface-variant"><AlertTriangle size={15} className="text-primary" /> {blocker}</p> : null}
      <button type="button" data-testid="abrir-publicar" onClick={onPublish} className="h-12 rounded-xl bg-primary text-base font-bold text-on-primary">{report.publish.label}</button>
    </footer>
  );
}

/** What the page shows under the header: the loading block, the failure, the tramos or the hub. */
function ReportBody({ draft, report, items, portalUrl, onOpen, onOpenItems }: { draft: ReportDraftResult | null; report: FieldDocument | null; items: DocumentSection | undefined; portalUrl?: string; onOpen: (path: SectionPath) => void; onOpenItems: (sectionId: string) => void }) {
  if (draft === null) return <div data-testid="informe-cargando" className="h-40 animate-pulse rounded-xl bg-surface" />;
  if (!draft.ok || !report) return <DraftFailure message={draft.ok ? 'No se pudo abrir el informe' : draft.message} portalUrl={portalUrl} />;
  if (items?.kind === 'repeat') return isUnitsRepeat(items) ? <ReportUnitsWeb section={items} onOpen={onOpen} /> : <ReportItemsWeb section={items} onOpen={onOpen} />;
  return (
    <>
      <ProgressCard report={report} />
      <HubCards report={report} onOpen={onOpen} onOpenItems={onOpenItems} />
    </>
  );
}

/** The state of the page: the document, the open tramos list and «Publicar» (no hardware back here). */
function useReportPage(props: Props) {
  const { target, chatId, service, type, onClose } = props;
  const document = useFieldDocument(target.jwt, { spaceId: target.spaceId, clientId: target.clientId, chatId, serviceId: service.id, type });
  const forms = useReportForms(target, chatId, service.id, document.actions.reload);
  const [itemsOf, setItemsOf] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const view = reportViewOf(document.draft, itemsOf);
  // Inside the tramos, back goes to the hub; in the hub, back closes and the detail asks again if something was saved.
  const back = () => (itemsOf ? setItemsOf(null) : onClose(document.changed));
  const publish = () => {
    setPublishing(false);
    if (view.report) void forms.openPublish(view.report);
  };
  return { document, ...view, forms, publish, publishing, setPublishing, setItemsOf, back };
}

/**
 * A field report filled from the client's channel (José 05/11, designs
 * j-02…j-04): the sections as cards with their state, the tramos in their
 * own list, each section a form of Portal's app, and «Publicar» at the
 * bottom. It takes the detail's place and goes back to it when closed.
 */
export function ReportDocumentWeb(props: Props) {
  const page = useReportPage(props);
  const { document, report, items, forms } = page;
  const { actions, saves, offline } = document;
  const pdf = useReportPdf(props.target, props.service.id);
  const kicker = report ? report.title : reportTypeLabel(props.type);
  const blockers = report ? publishBlockers(report, saves, offline) : [];
  return (
    <div data-testid="informe-documento" className="mx-auto flex max-w-3xl flex-col gap-3">
      <ReportHeader kicker={items ? `${kicker} · ${items.title}` : kicker} title={props.service.name} report={report} onBack={page.back} />
      <QueueCard saves={saves} offline={offline} onFix={(save) => actions.openSection(save.path)} onDiscard={(save) => void actions.discard(save.clientKey)} />
      <EphemeralAnswers answers={forms.answers.answers} onDismiss={forms.answers.dismiss} onOpenForm={forms.answers.showForm} chatId={props.chatId} jwt={props.target.jwt} />
      <ReportBody draft={document.draft} report={report} items={items} portalUrl={props.portalUrl} onOpen={actions.openSection} onOpenItems={page.setItemsOf} />
      {report && (!items || (items.kind === 'repeat' && isUnitsRepeat(items))) ? <ReportFooter report={report} blocker={publishFooterLine(report, blockers)} pdf={pdf} onPublish={() => page.setPublishing(true)} onDone={() => props.onClose(true)} /> : null}
      {report && page.publishing ? <PublishDialog report={report} blockers={blockers} onClose={() => page.setPublishing(false)} onPublish={page.publish} /> : null}
      {document.form ? <AppFormDialog key={formKeyOf(document.form)} answer={document.form} personName={loadPerfil()?.name} onSubmit={actions.submit} onUpload={actions.upload} onClose={actions.closeForm} /> : null}
      {forms.answers.openForm ? (
        <AppFormDialog key={formKeyOf(forms.answers.openForm)} answer={forms.answers.openForm} personName={loadPerfil()?.name} onSubmit={(values) => forms.answers.submitForm(forms.answers.openForm!, values)} onUpload={(file, stamp) => forms.answers.uploadPhoto(forms.answers.openForm!.commandId, file, stamp)} onRefresh={(values) => forms.answers.refreshForm(forms.answers.openForm!, values)} onPreview={(values) => forms.answers.previewForm(forms.answers.openForm!, values)} onClose={() => forms.answers.dismiss(forms.answers.openForm!.commandId)} />
      ) : null}
    </div>
  );
}
