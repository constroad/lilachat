import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { AlertTriangle, ChevronLeft, ExternalLink, FileText } from 'lucide-react-native';
import { formKeyOf, itemsLine, pendingOf, publishBlockers, reportTypeLabel, reportViewOf, sectionBadge, STATUS_BADGE, type DocumentSection, type FieldDocument, type ReportDraftResult, type SectionPath, type SpaceClientService } from '@lilachat/shared';
import { AppFormSheet } from '../../../chat/commands/AppFormSheet';
import { EphemeralAnswers } from '../../../chat/commands/EphemeralAnswers';
import { useColores } from '../../../ui/tema';
import { useFileViewer } from '../useFileViewer';
import { useReportPdf } from '../useReportPdf';
import type { ServiceAskTarget } from '../useServiceAsk';
import { PublishSheet } from './PublishSheet';
import { ReportItemsView } from './ReportItemsView';
import { Pill, ProgressCard, QueueCard, SectionCard } from './ReportSections';
import { useFieldDocument } from './useFieldDocument';
import { useReportForms } from './useReportForms';

type Props = { target: ServiceAskTarget; chatId: string; service: SpaceClientService; type: string; portalUrl?: string; onClose: (changed: boolean) => void };

/** Kicker, title and state (design j-02): the type over the service, the pill at the right. */
function ReportHeader({ kicker, title, report, onBack }: { kicker: string; title: string; report: FieldDocument | null; onBack: () => void }) {
  const colors = useColores();
  return (
    <View className="flex-row items-start gap-2">
      <Pressable testID="volver-al-servicio" onPress={onBack} accessibilityLabel="Volver" className="-ml-2 h-11 w-11 items-center justify-center rounded-full">
        <ChevronLeft size={22} color={colors.primary} />
      </Pressable>
      <View className="min-w-0 flex-1">
        <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-primary" numberOfLines={1}>{kicker}</Text>
        <Text className="mt-0.5 text-[20px] font-bold text-on-surface" numberOfLines={2}>{title}</Text>
      </View>
      {report ? <Pill badge={STATUS_BADGE[report.status]} testID="estado-informe" /> : null}
    </View>
  );
}

function DraftFailure({ message, portalUrl }: { message: string; portalUrl?: string }) {
  const colors = useColores();
  return (
    <View testID="informe-fallo" className="rounded-2xl border border-outline/15 bg-surface p-4">
      <Text className="text-[15px] font-semibold text-on-surface">{message}</Text>
      {portalUrl ? (
        <Pressable testID="informe-fallo-portal" onPress={() => void Linking.openURL(portalUrl)} className="mt-2 min-h-[44px] flex-row items-center gap-1.5">
          <ExternalLink size={15} color={colors.primary} />
          <Text className="text-[14px] font-semibold text-primary">Abrir el servicio en el Portal</Text>
        </Pressable>
      ) : null}
    </View>
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
      return <SectionCard key={section.id} testID={`seccion-${section.id}`} title={section.title} badge={badge} state={section.state} summary={[itemsLine(section), ...(first?.summary ?? [])]} results={first?.results ?? []} onPress={open ? () => onOpenItems(section.id) : undefined} />;
    }
    return <SectionCard key={section.id} testID={`seccion-${section.id}`} title={section.title} badge={badge} state={section.state} summary={section.summary} results={section.results} onPress={open ? () => onOpen({ sectionId: section.id, itemId: null, key: section.id }) : undefined} />;
  };
  return <>{report.sections.map(cardOf)}</>;
}

/** Under the cards: what still blocks «Publicar» and the button, or the PDF once published (design j-04). */
function ReportFooter({ report, blocker, asking, onPublish, onPdf, onDone }: { report: FieldDocument; blocker?: string; asking: boolean; onPublish: () => void; onPdf: () => void; onDone: () => void }) {
  const colors = useColores();
  if (report.status === 'published') {
    return (
      <View testID="informe-publicado" className="gap-2 border-t border-outline/10 px-4 pb-4 pt-3">
        <Text className="text-center text-[11px] font-bold uppercase tracking-[1.5px] text-primary">Informe publicado</Text>
        <Text className="text-center text-[14px] text-on-surface-variant">El PDF se genera y llega al canal del cliente.</Text>
        <Pressable testID="ver-pdf-informe" onPress={onPdf} disabled={asking} className={`min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 ${asking ? 'opacity-60' : ''}`}>
          <FileText size={18} color={colors.primary} />
          <Text className="text-[16px] font-semibold text-primary">{asking ? 'Pidiendo el PDF…' : 'Ver PDF'}</Text>
        </Pressable>
        <Pressable testID="volver-informe-listo" onPress={onDone} className="min-h-[52px] items-center justify-center rounded-2xl bg-primary">
          <Text className="text-[16px] font-bold text-on-primary">Volver al servicio</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View className="gap-2 border-t border-outline/10 px-4 pb-4 pt-3">
      {blocker ? (
        <View testID="falta-informe" className="flex-row items-center justify-center gap-2">
          <AlertTriangle size={15} color={colors.primary} />
          <Text className="text-[13px] font-semibold text-on-surface-variant">{blocker}</Text>
        </View>
      ) : null}
      <Pressable testID="abrir-publicar" onPress={onPublish} className="min-h-[56px] items-center justify-center rounded-2xl bg-primary">
        <Text className="text-[16px] font-bold text-on-primary">{report.publish.label}</Text>
      </Pressable>
    </View>
  );
}

/** What the screen shows under the header: the loading block, the failure, the tramos or the hub. */
function ReportBody({ draft, report, items, portalUrl, onOpen, onOpenItems }: { draft: ReportDraftResult | null; report: FieldDocument | null; items: DocumentSection | undefined; portalUrl?: string; onOpen: (path: SectionPath) => void; onOpenItems: (sectionId: string) => void }) {
  if (draft === null) return <View testID="informe-cargando" className="h-40 rounded-2xl bg-surface-variant" />;
  if (!draft.ok || !report) return <DraftFailure message={draft.ok ? 'No se pudo abrir el informe' : draft.message} portalUrl={portalUrl} />;
  if (items?.kind === 'repeat') return <ReportItemsView section={items} onOpen={onOpen} />;
  return (
    <>
      <ProgressCard document={report} />
      <HubCards report={report} onOpen={onOpen} onOpenItems={onOpenItems} />
    </>
  );
}

/** The state of the screen: the document, the open tramos list, «Publicar» and Android's back. */
function useReportScreen(props: Props) {
  const { target, chatId, service, type, onClose } = props;
  const document = useFieldDocument({ spaceId: target.spaceId, clientId: target.clientId, chatId, serviceId: service.id, type });
  const forms = useReportForms(target, chatId, service.id, document.actions.reload);
  const [itemsOf, setItemsOf] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const { changed } = document;
  // Inside the tramos, back goes to the hub; in the hub, back closes and the detail asks again if something was saved.
  const back = useCallback(() => (itemsOf ? setItemsOf(null) : onClose(changed)), [itemsOf, onClose, changed]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => subscription.remove();
  }, [back]);
  return { document, ...reportViewOf(document.draft, itemsOf), forms, publishing, setPublishing, setItemsOf, back };
}

/**
 * A field report filled from the client's channel (José 05/11, designs
 * j-02…j-04): the sections as cards with their state, the tramos in their
 * own list, each section a form of Portal's app, and «Publicar» at the
 * bottom. It takes the detail's place and goes back to it when closed.
 */
export function ReportDocumentScreen(props: Props) {
  const screen = useReportScreen(props);
  const { document, report, items, forms } = screen;
  const { actions, saves, offline } = document;
  const files = useFileViewer();
  const pdf = useReportPdf(props.target, props.service.id, files.open);
  const kicker = report ? report.title : reportTypeLabel(props.type);
  const notice = files.notice ?? pdf.message;
  const blockers = report ? publishBlockers(report, saves, offline) : [];
  const publish = () => {
    screen.setPublishing(false);
    if (report) void forms.openPublish(report);
  };
  return (
    <View className="flex-1">
      <ScrollView testID="informe-documento" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
        <ReportHeader kicker={items ? `${kicker} · ${items.title}` : kicker} title={props.service.name} report={report} onBack={screen.back} />
        <QueueCard saves={saves} offline={offline} onFix={(save) => actions.openSection(save.path)} onDiscard={(save) => void actions.discard(save.clientKey)} />
        <EphemeralAnswers answers={forms.answers.answers} onDismiss={forms.answers.dismiss} onOpenForm={forms.answers.showForm} chatId={props.chatId} jwt={props.target.jwt} embedded />
        <ReportBody draft={document.draft} report={report} items={items} portalUrl={props.portalUrl} onOpen={actions.openSection} onOpenItems={screen.setItemsOf} />
        {notice ? <Text className="text-center text-[13px] text-error">{notice}</Text> : null}
      </ScrollView>
      {report && !items ? <ReportFooter report={report} blocker={blockers[0]} asking={pdf.asking} onPublish={() => screen.setPublishing(true)} onPdf={() => void pdf.ask(report.id ?? '', `${report.title} · PDF`)} onDone={() => props.onClose(true)} /> : null}
      {files.viewer}
      {report ? <PublishSheet document={report} blockers={blockers} visible={screen.publishing} onClose={() => screen.setPublishing(false)} onPublish={publish} /> : null}
      {document.form ? <AppFormSheet key={formKeyOf(document.form)} answer={document.form} onSubmit={actions.submit} onUpload={actions.upload} onClose={actions.closeForm} /> : null}
      {forms.answers.openForm ? (
        <AppFormSheet key={formKeyOf(forms.answers.openForm)} answer={forms.answers.openForm} onSubmit={(values) => forms.answers.submitForm(forms.answers.openForm!, values)} onUpload={(photo, stamp) => forms.answers.uploadPhoto(forms.answers.openForm!.commandId, photo, stamp)} onRefresh={(values) => forms.answers.refreshForm(forms.answers.openForm!, values)} onPreview={(values) => forms.answers.previewForm(forms.answers.openForm!, values)} onClose={() => forms.answers.dismiss(forms.answers.openForm!.commandId)} />
      ) : null}
    </View>
  );
}
