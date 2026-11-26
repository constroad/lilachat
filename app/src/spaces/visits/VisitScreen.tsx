import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AlertTriangle, Camera, CheckCircle2, ChevronLeft, ClipboardList, FileText, ImagePlus, MapPin, Plus } from 'lucide-react-native';
import { DRIVE_VIDEO_SECONDS, formKeyOf, nextPointNumber, pointLine, visitNextStep, visitPhotosLabel, type OpenVisitRow, type VisitCardAction, type VisitDocument } from '@lilachat/shared';
import { AppFormSheet } from '../../chat/commands/AppFormSheet';
import { openCamera } from '../../chat/camara/cameraRequests';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import { devicePlaceNow } from '../clients/reports/devicePlace';
import { useFileViewer } from '../clients/useFileViewer';
import { FieldQueueStrip } from '../clients/FieldQueueStrip';
import { MarkPointSheet } from './MarkPointSheet';
import { VisitCroquis } from './VisitCroquis';
import { VisitEvidenceSheet, type VisitEvidenceOption } from './VisitEvidenceSheet';
import { useVisit } from './useVisit';
import type { VisitPlaceRef } from './visitsApi';

/** `startAction`: the visit card's button that opened it (lv01); it runs once the visit is read. */
/** Above the chat's header (zIndex 2) and list (1): with no layer the screen drew under them (APK 14/11). */
const VISIT_SCREEN_LAYER = 10;

/** The PDF and the croquis are Portal's: a visit still on the phone has neither yet. */
const NEEDS_PORTAL = 'Primero la visita tiene que llegar al Portal: se envía sola apenas haya señal.';
const NO_PHOTO_FIELD = 'Esta parte no lleva fotos.';
const stringValues = (values: Record<string, unknown>): Record<string, string> => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)]));

type Props = { place: VisitPlaceRef; visitId?: string | null; startAction?: VisitCardAction; onClose: () => void };
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
  const { questions, answered, points } = document.figures;
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
      {cell('Fotos', visitPhotosLabel(document.figures), 'visita-fotos')}
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
function Actions({ document, visit, onMark, onPdf, onEvidence }: { document: VisitDocument; visit: Visit; onMark: () => void; onPdf: () => void; onEvidence: () => void }) {
  const colors = useColores();
  const busy = Boolean(visit.busy);
  if (document.finished) return <ActionButton testID="visita-pdf" label="Ver PDF" icon={<FileText size={18} color={colors['on-primary']} />} primary disabled={busy} onPress={onPdf} />;
  return (
    <View className="flex-row flex-wrap gap-2">
      <ActionButton testID="visita-marcar-punto" label="Marcar punto" icon={<Camera size={18} color={colors['on-primary']} />} primary disabled={busy} onPress={onMark} />
      <ActionButton testID="visita-abrir-entrevista" label="Entrevista" icon={<ClipboardList size={18} color={colors.primary} />} disabled={busy} onPress={() => void visit.openSection('entrevista')} />
      <ActionButton testID="visita-foto-suelta" label="Foto suelta" icon={<ImagePlus size={18} color={colors.primary} />} disabled={busy} onPress={onEvidence} />
      <ActionButton testID="visita-terminar" label="Terminar" icon={<CheckCircle2 size={18} color={colors.primary} />} disabled={busy} onPress={() => void visit.finish()} />
    </View>
  );
}

type PickedEvidence = Parameters<Visit['addPhoto']>[0];

/** Foto, video or a file already in the gallery (Portal 23/11): a fresh ticket for each, one after another. */
async function pickedEvidence(option: VisitEvidenceOption): Promise<PickedEvidence | null> {
  if (option === 'gallery') {
    // gates-allow: camara a gallery pick has no live stamp to burn, same as Drive's own gallery (useDriveUpload.ts)
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 1 });
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return null;
    const mime = asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
    return { uri: asset.uri, name: asset.fileName ?? `visita-${Date.now()}.${mime.split('/')[1]}`, mime };
  }
  const shot = await openCamera({ title: option === 'video' ? 'Video de la visita' : 'Foto de la visita', video: { maxSeconds: DRIVE_VIDEO_SECONDS, first: option === 'video' } });
  if (!shot || shot === 'denied') return null;
  return { uri: shot.uri, name: `visita-${Date.now()}.${shot.mime.split('/')[1]}`, mime: shot.mime, stamp: shot.stamp };
}

/** One piece of evidence with where and when it was taken: Portal draws it as «F» on the card (43a1f701). */
async function addEvidence(visit: Visit, option: VisitEvidenceOption) {
  const file = await pickedEvidence(option);
  if (!file) return;
  const where = await devicePlaceNow();
  await visit.addPhoto(file, { lat: where.lat, lng: where.lng, takenAt: file.stamp?.takenAt ?? where.at });
}

/** The card's button runs once the visit is read: a point opens its sheet, the rest do their step. */
function useStartAction(action: VisitCardAction | undefined, visit: Visit, run: { mark: () => void; pdf: () => void; croquis: () => void; evidence: () => void }) {
  const ran = useRef(false);
  const ready = Boolean(visit.draft?.ok && visit.draft.document.id);
  useEffect(() => {
    if (ran.current || !ready || !action) return;
    ran.current = true;
    const steps: Record<VisitCardAction, () => void> = {
      point: run.mark,
      interview: () => void visit.openSection('entrevista'),
      photo: run.evidence,
      finish: () => void visit.finish(),
      pdf: run.pdf,
      croquis: run.croquis,
    };
    steps[action]();
  }, [action, ready, visit, run]);
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
          {point.pending ? <Text testID={`visita-punto-${point.n}-sin-enviar`} className="text-[12px] font-semibold text-primary">Sin enviar</Text> : point.media.length ? <Text className="text-[12px] text-on-surface-variant">{`${point.media.length} foto${point.media.length === 1 ? '' : 's'}`}</Text> : <MapPin size={16} color={colors['on-surface-variant']} />}
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

function Body({ visit, onMark, onPdf, onEvidence }: { visit: Visit; onMark: () => void; onPdf: () => void; onEvidence: () => void }) {
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
      <Actions document={document} visit={visit} onMark={onMark} onPdf={onPdf} onEvidence={onEvidence} />
      <MissingLine document={document} />
      <PointRows document={document} />
      <SectionRows document={document} visit={visit} />
    </>
  );
}

/**
 * The technical visit (José 13/11; designs lv01–lv03), in place of the chat it was opened from. Each
 * section is Portal's form; a point opens the camera first. Shown where the space admin turned the visit on.
 */
export function VisitScreen(props: Props) {
  const margins = useMargenes();
  const visit = useVisit(props.place, props.visitId ?? null);
  const files = useFileViewer();
  const [marking, setMarking] = useState(false);
  const [croquis, setCroquis] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [localNotice, setLocalNotice] = useState('');
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
    if (visit.isLocal) return setLocalNotice(NEEDS_PORTAL);
    const url = await visit.screen.pdf();
    if (url && document) files.open({ url, name: `${document.code}.pdf`, mime: 'application/pdf' });
  };
  const openCroquis = () => (visit.isLocal ? setLocalNotice(NEEDS_PORTAL) : setCroquis(true));
  useStartAction(props.startAction, visit, { mark: () => setMarking(true), pdf: () => void pdf(), croquis: openCroquis, evidence: () => setEvidenceOpen(true) });
  const openForm = visit.localForm;
  return (
    <View testID="visita-pantalla" className="absolute inset-0 bg-background" style={{ paddingTop: margins.cabecera, zIndex: VISIT_SCREEN_LAYER, elevation: VISIT_SCREEN_LAYER }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: margins.pie + 24 }}>
        <Header document={document} onBack={onClose} />
        {document?.id ? <FieldQueueStrip serviceId={`visit:${document.id}`} alsoIds={visit.visitScopes} /> : null}
        <Body visit={visit} onMark={() => setMarking(true)} onPdf={() => void pdf()} onEvidence={() => setEvidenceOpen(true)} />
        {visit.busy ? <Text testID="visita-ocupada" className="text-center text-[13px] text-on-surface-variant">{visit.busy}</Text> : null}
        {localNotice || visit.notice || files.notice ? <Text testID="visita-aviso" className="text-center text-[13px] text-on-surface">{localNotice || visit.notice || files.notice}</Text> : null}
      </ScrollView>
      {marking && document ? <MarkPointSheet document={document} n={nextPointNumber(document)} onClose={() => setMarking(false)} onSave={(point, photo) => { setMarking(false); void visit.markPoint(point, photo); }} /> : null}
      {openForm ? <AppFormSheet key={formKeyOf(openForm)} answer={openForm} onSubmit={async (values) => { await visit.submitSection(stringValues(values)); return { done: true, answer: null }; }} onUpload={async () => ({ ok: false, message: NO_PHOTO_FIELD })} onClose={visit.closeForm} /> : null}
      {files.viewer}
      {croquis && document && !visit.isLocal ? <VisitCroquis visit={visit} document={document} onClose={() => setCroquis(false)} /> : null}
      <VisitEvidenceSheet visible={evidenceOpen} onClose={() => setEvidenceOpen(false)} onPick={(option) => void addEvidence(visit, option)} />
    </View>
  );
}
