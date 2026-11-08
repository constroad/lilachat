import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Copy, Download, Globe, Link2 } from 'lucide-react-native';
import { exportStageOptions, KMZ_MIME, kmzLayersOf, workMapFileName, workMapWorkFilter, workMapKml, workMapKmz, workMapScopeLabel, type WorkMap, type WorkMapFilter } from '@lilachat/shared';
import { Sheet } from '../../../ui/Sheet';
import { useColores } from '../../../ui/tema';
import { DayChips, SHEET_LABEL, StageChips } from './CutChips';

type Props = { open: boolean; map: WorkMap; filter: WorkMapFilter; onFilter: (filter: WorkMapFilter) => void; title: string; pageUrl: string; onClose: () => void };

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
    <Sheet visible={props.open} onClose={props.onClose} testID="mapa-exportar-panel" tone="background" className="gap-4 px-4 pt-2">
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
      <Card icon={<Link2 size={18} color={colors.primary} />} title="Enlace para el cliente" hint="Solo lo aprobado.">
        <Text numberOfLines={1} className="mt-2 rounded-lg border border-outline/20 bg-background px-2.5 py-1.5 font-mono text-[13px] text-on-surface-variant">{props.pageUrl}</Text>
        <Pressable testID="mapa-copiar-enlace-visor" onPress={copy} className="mt-2 min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl border border-primary/30">
          <Copy size={18} color={colors.primary} />
          <Text className="text-[15px] font-semibold text-primary">{copied ? 'Enlace copiado' : 'Copiar enlace de visor'}</Text>
        </Pressable>
      </Card>
      <KmzTree map={props.map} filter={props.filter} fileName={fileName} />
    </Sheet>
  );
}
