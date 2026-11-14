import { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, Text, View } from 'react-native';
import { AlertTriangle, Camera, CheckCircle2, ChevronLeft, ClipboardList, FileText, ImagePlus, MapPin, Plus } from 'lucide-react-native';
import { formKeyOf, nextPointNumber, pointLine, visitNextStep, type OpenVisitRow, type VisitDocument } from '@lilachat/shared';
import { AppFormSheet } from '../../chat/commands/AppFormSheet';
import { EphemeralAnswers } from '../../chat/commands/EphemeralAnswers';
import { openCamera } from '../../chat/camara/cameraRequests';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import { useFileViewer } from '../clients/useFileViewer';
import { MarkPointSheet } from './MarkPointSheet';
import { useVisit } from './useVisit';
import type { VisitPlaceRef } from './visitsApi';

type Props = { place: VisitPlaceRef; visitId?: string | null; onClose: () => void };
type Visit = ReturnType<typeof useVisit>;

function Header({ document, onBack }: { document: VisitDocument | null; onBack: () => void }) {
  const colors = useColores();
  const kicker = document?.id ? `Visita técnica · ${document.code}` : 'Visitas técnicas';
  const title = document?.details?.prospect || (document?.id ? document.title : 'Nueva visita');
  return (
    <View className="flex-row items-start gap-2">
      <Pressable testID="visita-volver" onPress={onBack} accessibilityLabel="Volver" className="-ml-2 h-11 w-11 items-center justify-center rounded-full"><ChevronLeft size={22} color={colors.primary} /></Pressable>
      <View className="min-w-0 flex-1">
        <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-primary" numberOfLines={1}>{kicker}</Text>
        <Text className="mt-0.5 text-[20px] font-bold text-on-surface" numberOfLines={2}>{title}</Text>
      </View>
      {document?.id ? <Text testID="visita-estado" className="rounded-md border border-outline/30 px-2 py-1 text-[11px] font-bold uppercase text-on-surface-variant">{document.stageLabel}</Text> : null}
    </View>
  );
}

function Figures({ document }: { document: VisitDocument }) {
  const { questions, answered, points, photos } = document.figures;
  const cell = (label: string, value: string, testID: string) => (
    <View className="flex-1 items-center py-2">
      <Text className="text-[11px] font-bold uppercase tracking-[1px] text-on-surface-variant">{label}</Text>
      <Text testID={testID} className="mt-0.5 text-[20px] font-bold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
  return (
    <View className="flex-row divide-x divide-outline/15 rounded-2xl border border-outline/15 bg-surface">
      {cell('Entrevista', `${answered} de ${questions}`, 'visita-entrevista')}
      {cell('Puntos', String(points), 'visita-puntos')}
      {cell('Fotos', String(photos), 'visita-fotos')}
    </View>
  );
}

function ActionButton({ testID, label, icon, primary, disabled, onPress }: { testID: string; label: string; icon: React.ReactNode; primary?: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable testID={testID} disabled={disabled} onPress={onPress} className={`min-h-[56px] basis-[48%] grow flex-row items-center justify-center gap-2 rounded-2xl px-3 ${primary ? 'bg-primary' : 'border border-outline/20 bg-surface'} ${disabled ? 'opacity-50' : ''}`}>
      {icon}
      <Text className={`text-[15px] font-bold uppercase ${primary ? 'text-on-primary' : 'text-on-surface'}`}>{label}</Text>
    </Pressable>
  );
}

/** Marcar punto · Entrevista · Foto suelta · Terminar (design lv01); a finished visit only shows its PDF. */
function Actions({ document, visit, onMark, onPdf }: { document: VisitDocument; visit: Visit; onMark: () => void; onPdf: () => void }) {
  const colors = useColores();
  const busy = Boolean(visit.busy);
  if (document.finished) return <ActionButton testID="visita-pdf" label="Ver PDF" icon={<FileText size={18} color={colors['on-primary']} />} primary disabled={busy} onPress={onPdf} />;
  const loosePhoto = async () => {
    const shot = await openCamera({ title: 'Foto de la visita' });
    if (shot && shot !== 'denied') void visit.screen.addPhoto({ uri: shot.uri, name: `visita-${Date.now()}.jpg`, mime: shot.mime, stamp: shot.stamp });
  };
  return (
    <View className="flex-row flex-wrap gap-2">
      <ActionButton testID="visita-marcar-punto" label="Marcar punto" icon={<Camera size={18} color={colors['on-primary']} />} primary disabled={busy} onPress={onMark} />
      <ActionButton testID="visita-abrir-entrevista" label="Entrevista" icon={<ClipboardList size={18} color={colors.primary} />} disabled={busy} onPress={() => void visit.openSection('entrevista')} />
      <ActionButton testID="visita-foto-suelta" label="Foto suelta" icon={<ImagePlus size={18} color={colors.primary} />} disabled={busy} onPress={() => void loosePhoto()} />
      <ActionButton testID="visita-terminar" label="Terminar" icon={<CheckCircle2 size={18} color={colors.primary} />} disabled={busy} onPress={() => void visit.screen.finish()} />
    </View>
  );
}

function SectionRows({ document, visit }: { document: VisitDocument; visit: Visit }) {
  const editable = document.sections.filter((section) => section.id === 'datos' || section.id === 'conclusion');
  return (
    <>
      {editable.map((section) => (
        <Pressable key={section.id} testID={`visita-seccion-${section.id}`} disabled={document.finished} onPress={() => void visit.openSection(section.id as 'datos' | 'conclusion')} className="rounded-2xl border border-outline/15 bg-surface p-4">
          <Text className="text-[15px] font-bold text-on-surface">{section.title}</Text>
          {section.summary.slice(0, 2).map((line) => <Text key={line} numberOfLines={1} className="mt-0.5 text-[13px] text-on-surface-variant">{line}</Text>)}
        </Pressable>
      ))}
    </>
  );
}

function PointRows({ document }: { document: VisitDocument }) {
  const colors = useColores();
  if (!document.points.length) return null;
  return (
    <View className="overflow-hidden rounded-2xl border border-outline/15 bg-surface">
      <Text className="border-b border-outline/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">Puntos</Text>
      {document.points.map((point) => (
        <View key={point.id} testID={`visita-punto-${point.n}`} className="min-h-[52px] flex-row items-center gap-3 border-b border-outline/10 px-4 py-2">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-primary"><Text className="text-[13px] font-bold text-on-primary">{point.n}</Text></View>
          <View className="min-w-0 flex-1">
            <Text className="text-[15px] font-semibold text-on-surface">{pointLine(point)}</Text>
            {point.note ? <Text numberOfLines={1} className="text-[12px] text-on-surface-variant">{point.note}</Text> : null}
          </View>
          {point.media.length ? <Text className="text-[12px] text-on-surface-variant">{`${point.media.length} foto${point.media.length === 1 ? '' : 's'}`}</Text> : <MapPin size={16} color={colors['on-surface-variant']} />}
        </View>
      ))}
    </View>
  );
}

function MissingLine({ document }: { document: VisitDocument }) {
  const colors = useColores();
  const step = visitNextStep(document);
  if (step.kind !== 'interview' && step.kind !== 'missing') return null;
  return (
    <View testID="visita-falta" className="flex-row items-center gap-2 px-1">
      <AlertTriangle size={15} color={colors.primary} />
      <Text className="flex-1 text-[13px] text-on-surface-variant">{step.kind === 'interview' ? `Falta: ${step.unanswered} preguntas de la entrevista` : step.label}</Text>
    </View>
  );
}

/** A new visit: «Crear visita» and the ones still open, to go on with one. */
function OpenVisits({ rows, visit }: { rows: OpenVisitRow[]; visit: Visit }) {
  const colors = useColores();
  return (
    <>
      <Pressable testID="visita-crear" disabled={Boolean(visit.busy)} onPress={() => void visit.openSection('datos')} className="min-h-[72px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary">
        <Plus size={20} color={colors['on-primary']} />
        <Text className="text-[17px] font-bold text-on-primary">Crear visita</Text>
      </Pressable>
      {rows.length ? <Text className="mt-2 text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">Visitas abiertas</Text> : null}
      {rows.map((row) => (
        <Pressable key={row.id} testID={`visita-abierta-${row.code}`} onPress={() => void visit.screen.choose(row.id)} className="rounded-2xl border border-outline/15 bg-surface p-4">
          <Text className="font-mono text-[12px] text-primary">{`${row.code} · ${row.stageLabel}`}</Text>
          <Text className="mt-0.5 text-[15px] font-bold text-on-surface" numberOfLines={1}>{row.prospect || row.place}</Text>
          <Text className="text-[13px] text-on-surface-variant" numberOfLines={1}>{`${row.place} · ${row.points} punto${row.points === 1 ? '' : 's'}`}</Text>
        </Pressable>
      ))}
    </>
  );
}

function Body({ visit, onMark, onPdf }: { visit: Visit; onMark: () => void; onPdf: () => void }) {
  const { draft } = visit;
  if (draft === null) return <View testID="visita-cargando" className="h-40 rounded-2xl bg-surface-variant" />;
  if (!draft.ok) return <View testID="visita-fallo" className="rounded-2xl border border-outline/15 bg-surface p-4"><Text className="text-[15px] font-semibold text-on-surface">{draft.message}</Text><Pressable testID="visita-reintentar" onPress={() => void visit.screen.reload()} className="mt-3 min-h-[48px] items-center justify-center rounded-xl border border-primary/30 bg-primary/10"><Text className="text-[15px] font-semibold text-primary">Reintentar</Text></Pressable></View>;
  const { document } = draft;
  if (!document.id) return <OpenVisits rows={draft.visits} visit={visit} />;
  const place = document.details?.place;
  return (
    <>
      {place ? <Text className="text-[13px] text-on-surface-variant" numberOfLines={2}>{place}</Text> : null}
      <Figures document={document} />
      <Actions document={document} visit={visit} onMark={onMark} onPdf={onPdf} />
      <MissingLine document={document} />
      <PointRows document={document} />
      <SectionRows document={document} visit={visit} />
    </>
  );
}

/**
 * The technical visit (José 13/11; designs lv01–lv03), in place of the chat it was opened from. Each
 * section is Portal's form; a point opens the camera first. Behind `SITE_VISITS_OPEN_HERE`.
 */
export function VisitScreen(props: Props) {
  const margins = useMargenes();
  const visit = useVisit(props.place, props.visitId ?? null);
  const files = useFileViewer();
  const [marking, setMarking] = useState(false);
  const document = visit.draft?.ok ? visit.draft.document : null;
  const { onClose } = props;
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (marking) setMarking(false);
      else onClose();
      return true;
    });
    return () => subscription.remove();
  }, [marking, onClose]);
  const pdf = async () => {
    const url = await visit.screen.pdf();
    if (url && document) files.open({ url, name: `${document.code}.pdf`, mime: 'application/pdf' });
  };
  const openForm = visit.answers.openForm;
  return (
    <View testID="visita-pantalla" className="absolute inset-0 bg-background" style={{ paddingTop: margins.cabecera }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: margins.pie + 24 }}>
        <Header document={document} onBack={onClose} />
        <EphemeralAnswers answers={visit.answers.answers} onDismiss={visit.answers.dismiss} onOpenForm={visit.answers.showForm} chatId={props.place.chatId} jwt={props.place.jwt} embedded />
        <Body visit={visit} onMark={() => setMarking(true)} onPdf={() => void pdf()} />
        {visit.busy ? <Text testID="visita-ocupada" className="text-center text-[13px] text-on-surface-variant">{visit.busy}</Text> : null}
        {visit.notice || files.notice ? <Text testID="visita-aviso" className="text-center text-[13px] text-on-surface">{visit.notice || files.notice}</Text> : null}
      </ScrollView>
      {marking && document ? <MarkPointSheet document={document} n={nextPointNumber(document)} onClose={() => setMarking(false)} onSave={(point, photo) => { setMarking(false); void visit.screen.markPoint(point, photo); }} /> : null}
      {openForm ? <AppFormSheet key={formKeyOf(openForm)} answer={openForm} onSubmit={(values) => visit.answers.submitForm(openForm, values)} onUpload={(photo, stamp) => visit.answers.uploadPhoto(openForm.commandId, photo, stamp)} onClose={() => visit.answers.dismiss(openForm.commandId)} /> : null}
      {files.viewer}
    </View>
  );
}
