import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Copy, Download, FileText, Globe, Link2, Printer } from 'lucide-react-native';
import { createProgressPdf, exportStageOptions, PLAN_SIZES, type PlanSize, KMZ_MIME, kmzLayersOf, workMapFileName, workMapWorkFilter, workMapKml, workMapKmz, workMapScopeLabel, type MapEditSend, type TraceUpload, type WorkMap, type WorkMapFilter } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { DayChips, PanelSheet, SHEET_LABEL, StageChips } from './CutChips';
import { ImportTrace } from './ImportTrace';
import { PdfAction } from './PdfAction';
import type { TraceFile } from '../useDriveUpload';

type Props = { open: boolean; map: WorkMap; filter: WorkMapFilter; onFilter: (filter: WorkMapFilter) => void; title: string; pageUrl: string; onClose: () => void; /** «Importar KMZ o KML» (o-12). */ send?: MapEditSend; uploadTrace?: TraceUpload<TraceFile> };

/** «Avance parcial» (o-08): which streets each work covered, for the stage and day the map shows. */
/** Writes the KMZ in the cache and opens the share sheet: Google Earth, WhatsApp or Drive. Never throws. */
async function shareKmz(map: WorkMap, filter: WorkMapFilter, title: string): Promise<string | null> {
  try {
    const file = new File(Paths.cache, workMapFileName(title, filter, new Date()));
    if (file.exists) file.delete();
    file.create();
    file.write(workMapKmz(workMapKml(map, filter, title)));
    await Sharing.shareAsync(file.uri, { mimeType: KMZ_MIME, dialogTitle: 'Exportar a Google Earth', UTI: 'com.google.earth.kmz' });
    return null;
  } catch (failure) {
    console.warn('work map: kmz not shared', failure instanceof Error ? failure.message : failure);
    return 'No se pudo exportar el mapa. Prueba de nuevo.';
  }
}

function Card(props: { icon: ReactNode; title: string; hint: string; children: ReactNode }) {
  return (
    <View className="rounded-2xl border border-outline/15 bg-surface p-4">
      <View className="flex-row items-center gap-2">{props.icon}<Text className="text-[16px] font-semibold text-on-surface">{props.title}</Text></View>
      <Text className="mt-0.5 text-[14px] text-on-surface-variant">{props.hint}</Text>
      {props.children}
    </View>
  );
}

/** «Trabajos» (o-12): all of them, or the one tapped; the map behind follows. */
function WorkChips(props: { map: WorkMap; filter: WorkMapFilter; onFilter: (filter: WorkMapFilter) => void }) {
  if (!props.map.works.length) return null;
  return (
    <View className="gap-1.5">
      <Text className={SHEET_LABEL}>Trabajos</Text>
      <View className="flex-row flex-wrap gap-2">
        {props.map.works.map((work) => {
          const on = !props.filter.workId || props.filter.workId === work.id;
          return (
            <Pressable key={work.id} testID={`exportar-trabajo-${work.id}`} accessibilityState={{ selected: on }} onPress={() => props.onFilter(workMapWorkFilter(props.filter, props.filter.workId === work.id ? undefined : work.id))} className={`h-10 flex-row items-center gap-1.5 rounded-full border px-3 ${on ? 'border-outline/25 bg-surface' : 'border-outline/10 opacity-60'}`}>
              <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: work.color }} />
              <Text className="text-[14px] font-semibold text-on-surface">{work.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** «Plano PDF» (o-12): the plan with its legend and the table of metres, A3 or A1, at this cut. */
function PlanPdf(props: { filter: WorkMapFilter; send: MapEditSend }) {
  const colors = useColores();
  const [size, setSize] = useState<PlanSize>('A3');
  return (
    <Card icon={<FileText size={18} color={colors.primary} />} title="Plano PDF" hint="Plano con leyenda y cuadro de metrados.">
      <View className="mt-2 flex-row gap-2">
        {PLAN_SIZES.map((one) => <Pressable key={one} testID={`plano-${one}`} accessibilityState={{ selected: size === one }} onPress={() => setSize(one)} className={`h-10 justify-center rounded-lg border px-3 ${size === one ? 'border-primary' : 'border-outline/20'}`}><Text className={`font-mono text-[14px] font-bold ${size === one ? 'text-primary' : 'text-on-surface-variant'}`}>{one}</Text></Pressable>)}
      </View>
      <View className="mt-3"><PdfAction testID="plano-pdf" label="Generar Plano PDF" icon={<Printer size={18} color={colors['on-surface']} />} className="min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl border border-outline/25" textClassName="text-[15px] font-semibold text-on-surface" create={() => createProgressPdf(props.send, props.filter, 'plan', size)} /></View>
    </Card>
  );
}

/** «Estructura de capas KMZ generada»: the folders Google Earth will show, with their metres. */
function KmzTree(props: { map: WorkMap; filter: WorkMapFilter; fileName: string }) {
  const layers = kmzLayersOf(props.map, props.filter);
  return (
    <View testID="exportar-capas" className="gap-1 rounded-2xl bg-on-surface p-4">
      <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-surface/70">Estructura de capas KMZ</Text>
      <Text className="font-mono text-[13px] text-surface">{props.fileName.replace(/\.kmz$/, '')}/</Text>
      <Text className="ml-3 font-mono text-[13px] text-primary-container">Ejecutado/</Text>
      {layers.done.map((layer) => <Text key={layer.workId} className="ml-6 font-mono text-[13px] text-surface">{layer.name} ({layer.meters})</Text>)}
      <Text className="ml-3 font-mono text-[13px] text-surface/80">Pendiente ({layers.pending})</Text>
    </View>
  );
}

/** «Exportar» on the phone (design `o-12-mapa-exportar`): what leaves the map, to Google Earth and to the client. */
export function WorkMapExport(props: Props) {
  const colors = useColores();
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copy = () => void Clipboard.setStringAsync(props.pageUrl).then(() => setCopied(true));
  const fileName = workMapFileName(props.title, props.filter, new Date());
  return (
    <PanelSheet open={props.open} onClose={props.onClose} testID="mapa-exportar-panel">
      <View>
        <Text className="text-[12px] font-bold uppercase tracking-[1.5px] text-primary">Sacar la obra</Text>
        <Text className="text-[22px] font-bold text-on-surface">Exportar</Text>
        <Text testID="mapa-exportar-alcance" className="mt-0.5 text-[14px] text-on-surface-variant">Sale lo que ves: {workMapScopeLabel(props.map, props.filter)}</Text>
      </View>
      <StageChips map={props.map} filter={props.filter} onFilter={props.onFilter} options={exportStageOptions(props.map)} label="Qué" />
      <DayChips map={props.map} filter={props.filter} onFilter={props.onFilter} />
      <WorkChips map={props.map} filter={props.filter} onFilter={props.onFilter} />
      <Card icon={<Globe size={18} color={colors.primary} />} title="Google Earth (KMZ)" hint="Carpetas Ejecutado, por trabajo, y Pendiente.">
        <Text testID="exportar-archivo" numberOfLines={1} className="mt-2 rounded-lg border border-outline/20 bg-background px-2.5 py-1.5 font-mono text-[13px] text-on-surface-variant">{fileName}</Text>
        <Pressable testID="mapa-descargar-kmz" onPress={() => void shareKmz(props.map, props.filter, props.title).then(setNotice)} className="mt-3 min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl bg-primary">
          <Download size={18} color={colors['on-primary']} />
          <Text className="text-[15px] font-semibold text-on-primary">Descargar KMZ</Text>
        </Pressable>
        {notice ? <Text accessibilityRole="alert" className="mt-2 text-[14px] text-error">{notice}</Text> : null}
      </Card>
      {props.send ? <PlanPdf filter={props.filter} send={props.send} /> : null}
      <Card icon={<Link2 size={18} color={colors.primary} />} title="Enlace para el cliente" hint="Solo lo aprobado.">
        <Text numberOfLines={1} className="mt-2 rounded-lg border border-outline/20 bg-background px-2.5 py-1.5 font-mono text-[13px] text-on-surface-variant">{props.pageUrl}</Text>
        <Pressable testID="mapa-copiar-enlace-visor" onPress={copy} className="mt-2 min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl border border-primary/30">
          <Copy size={18} color={colors.primary} />
          <Text className="text-[15px] font-semibold text-primary">{copied ? 'Enlace copiado' : 'Copiar enlace de visor'}</Text>
        </Pressable>
      </Card>
      {props.send && props.uploadTrace ? <><Text className={SHEET_LABEL}>Traer un trazado</Text><ImportTrace send={props.send} upload={props.uploadTrace} /></> : null}
      <KmzTree map={props.map} filter={props.filter} fileName={fileName} />
    </PanelSheet>
  );
}
