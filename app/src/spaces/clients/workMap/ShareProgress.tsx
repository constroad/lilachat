import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Copy, Download, Link2, ShieldCheck } from 'lucide-react-native';
import { createProgressLink, createProgressPdf, inReportViewOf, nextInReportView, type InReportView, type ServiceMapInReport, partialProgressOf, partialStreetsLabel, progressLinkExpiry, shareStageOptions, type MapEditSend, type ProgressLink, type WorkMap, type WorkMapFilter } from '@lilachat/shared';
import { Interruptor } from '../../../ui/Interruptor';
import { Sheet } from '../../../ui/Sheet';
import { useColores } from '../../../ui/tema';
import { DayChips, SHEET_LABEL, StageChips } from './CutChips';
import { PdfAction } from './PdfAction';

type Props = { open: boolean; map: WorkMap; filter: WorkMapFilter; onFilter: (filter: WorkMapFilter) => void; /** Portal's map tools through the door. */ send?: MapEditSend; /** «Incluir en el informe» as Portal has it. */ mapInReport?: ServiceMapInReport; onClose: () => void };

/** «Resumen consolidado»: which streets each work covered at this cut, and the approved metres. */
function FrontSummary(props: { map: WorkMap; filter: WorkMapFilter }) {
  const summary = partialProgressOf(props.map, props.filter);
  return (
    <View testID="mapa-avance-parcial" className="rounded-2xl border border-outline/15 bg-surface p-4">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-[14px] font-bold text-on-surface">Resumen consolidado</Text>
        <Text testID="mapa-parcial-vias" className="font-mono text-[13px] font-semibold text-primary">{partialStreetsLabel(summary)}</Text>
      </View>
      {summary.rows.length ? summary.rows.map((row) => (
        <View key={row.workId} testID={`mapa-parcial-${row.workId}`} className="mt-2.5 flex-row items-start gap-2">
          <View className="mt-1.5 h-3 w-3 rounded-sm" style={{ backgroundColor: row.color }} />
          <Text className="flex-1 text-[15px] text-on-surface"><Text className="font-bold">{row.name}:</Text> {row.streets}</Text>
        </View>
      )) : <Text className="mt-2 text-[14px] text-on-surface-variant">Todavía no hay avance aprobado en este corte.</Text>}
      <View className="mt-3 flex-row items-end justify-between border-t border-outline/15 pt-3">
        <Text className="text-[13px] text-on-surface-variant">Metrado aprobado</Text>
        <Text testID="mapa-parcial-metrado" className="font-mono text-[20px] font-bold text-primary">{summary.doneLabel}</Text>
      </View>
    </View>
  );
}

/** «Incluir en el informe del servicio»: the client's report PDF adds the map at this cut. */
function InReport(props: { map: WorkMap; filter: WorkMapFilter; send: MapEditSend; saved?: ServiceMapInReport }) {
  const [view, setView] = useState<InReportView>(() => inReportViewOf(props.map, props.saved));
  const { on, busy, note } = view;
  const change = async (include: boolean) => {
    setView({ ...view, busy: true });
    setView(await nextInReportView(props.send, props.map, props.filter, include, view));
  };
  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1"><Text className="text-[15px] font-semibold text-on-surface">Incluir en el informe del servicio</Text><Text className="text-[13px] text-on-surface-variant">El PDF del servicio suma una hoja con el mapa de este corte.</Text></View>
        <Interruptor testID="compartir-informe" value={on} disabled={busy} onValueChange={(include) => void change(include)} />
      </View>
      {note ? <Text testID="compartir-informe-nota" className={`text-[13px] ${note.ok ? 'text-on-surface-variant' : 'font-semibold text-error'}`}>{note.text}</Text> : null}
    </View>
  );
}

type LinkState = { busy: boolean; link: ProgressLink | null; error: string | null };
const IDLE: LinkState = { busy: false, link: null, error: null };

/** «Enlace público seguro»: the link Portal made for this cut, to copy. */
function PublicLink(props: { state: LinkState }) {
  const colors = useColores();
  const [copied, setCopied] = useState(false);
  const { link, error } = props.state;
  const expiry = link ? progressLinkExpiry(link) : null;
  return (
    <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-4">
      <Text className={SHEET_LABEL}>Enlace público seguro</Text>
      {link ? (
        <Pressable testID="mapa-copiar-enlace" onPress={() => void Clipboard.setStringAsync(link.url).then(() => setCopied(true))} className="flex-row items-center gap-2 rounded-lg border border-outline/20 bg-background px-2.5 py-2">
          <Text testID="mapa-enlace-cliente" numberOfLines={1} className="flex-1 font-mono text-[13px] text-on-surface">{link.url}</Text>
          <Copy size={16} color={colors.primary} /><Text className="text-[14px] font-semibold text-primary">{copied ? 'Copiado' : 'Copiar'}</Text>
        </Pressable>
      ) : <Text className="text-[14px] text-on-surface-variant">Crea el enlace con este corte. El cliente no puede ver más que eso.</Text>}
      {expiry ? <Text className="text-[13px] text-on-surface-variant">{expiry}</Text> : null}
      {error ? <Text testID="compartir-error" accessibilityRole="alert" className="text-[14px] font-semibold text-error">{error}</Text> : null}
      <View className="flex-row items-start gap-1.5"><ShieldCheck size={15} color={colors.primary} /><Text className="flex-1 text-[13px] text-on-surface-variant">El cliente ve solo lo aprobado por la inspección técnica.</Text></View>
    </View>
  );
}

/** «Compartir avance» on the phone (design o-08 mobile): the cut, what it shows, and the link Portal signs for it. */
export function ShareProgress(props: Props) {
  const colors = useColores();
  const [photos, setPhotos] = useState(false);
  const [state, setState] = useState<LinkState>(IDLE);
  const cut = (filter: WorkMapFilter) => { setState(IDLE); props.onFilter(filter); };
  const create = async (send: MapEditSend) => {
    setState({ ...IDLE, busy: true });
    const made = await createProgressLink(send, props.filter, photos);
    setState(made.ok ? { ...IDLE, link: made.link } : { ...IDLE, error: made.message });
  };
  return (
    <Sheet visible={props.open} onClose={props.onClose} testID="mapa-compartir-panel" tone="background" className="gap-4 px-4 pt-2">
      <View>
        <Text className="text-[12px] font-bold uppercase tracking-[1.5px] text-primary">Compartir avance</Text>
        <Text className="text-[22px] font-bold text-on-surface">Avance parcial</Text>
        <Text className="mt-0.5 text-[14px] text-on-surface-variant">Elige el corte de obra para el enlace que verá el cliente.</Text>
      </View>
      <StageChips map={props.map} filter={props.filter} onFilter={cut} options={shareStageOptions(props.map)} />
      <DayChips map={props.map} filter={props.filter} onFilter={cut} />
      <FrontSummary map={props.map} filter={props.filter} />
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1"><Text className="text-[15px] font-semibold text-on-surface">Mostrar fotos de inspección</Text><Text className="text-[13px] text-on-surface-variant">Las de la obra hasta el día del corte.</Text></View>
        <Interruptor testID="compartir-fotos" value={photos} onValueChange={(on) => { setPhotos(on); setState(IDLE); }} />
      </View>
      {props.send ? <InReport map={props.map} filter={props.filter} send={props.send} saved={props.mapInReport} /> : null}
      <PublicLink state={state} />
      {props.send ? <PdfAction testID="compartir-pdf" label="Descargar PDF para cliente" icon={<Download size={18} color={colors['on-surface']} />} className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-xl border border-outline/25 bg-surface" textClassName="text-[16px] font-semibold text-on-surface" create={() => createProgressPdf(props.send!, props.filter, 'client')} /> : null}
      {props.send ? (
        <Pressable testID="compartir-crear-enlace" disabled={state.busy} onPress={() => void create(props.send!)} className={`min-h-[52px] flex-row items-center justify-center gap-2 rounded-xl bg-primary ${state.busy ? 'opacity-60' : ''}`}>
          <Link2 size={18} color={colors['on-primary']} />
          <Text className="text-[16px] font-semibold text-on-primary">{state.busy ? 'Creando…' : 'Crear enlace de avance'}</Text>
        </Pressable>
      ) : null}
    </Sheet>
  );
}
