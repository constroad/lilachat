import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Copy, Download, Globe, Link2 } from 'lucide-react-native';
import { KMZ_MIME, partialProgressOf, partialStreetsLabel, workMapFileName, workMapKml, workMapKmz, workMapScopeLabel, type WorkMap, type WorkMapFilter } from '@lilachat/shared';
import { Sheet } from '../../../ui/Sheet';
import { useColores } from '../../../ui/tema';

type Props = { open: boolean; map: WorkMap; filter: WorkMapFilter; title: string; pageUrl: string; onClose: () => void };

/** «Avance parcial» (o-08): which streets each work covered, for the stage and day the map shows. */
function PartialProgress(props: { map: WorkMap; filter: WorkMapFilter }) {
  const summary = partialProgressOf(props.map, props.filter);
  return (
    <View testID="mapa-avance-parcial" className="rounded-2xl border border-outline/15 bg-surface p-4">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-[16px] font-semibold text-on-surface">Avance parcial</Text>
        <Text testID="mapa-parcial-vias" className="font-mono text-[13px] font-semibold text-primary">{partialStreetsLabel(summary)}</Text>
      </View>
      {summary.rows.length ? summary.rows.map((row) => (
        <View key={row.workId} testID={`mapa-parcial-${row.workId}`} className="mt-2 flex-row items-start gap-2">
          <View className="mt-1.5 h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: row.color }} />
          <Text className="flex-1 text-[14px] text-on-surface"><Text className="font-bold">{row.name}:</Text> {row.streets}</Text>
        </View>
      )) : <Text className="mt-2 text-[14px] text-on-surface-variant">Todavía no hay avance aprobado en este corte.</Text>}
      <View className="mt-3 flex-row items-baseline justify-between border-t border-outline/15 pt-2">
        <Text className="text-[13px] text-on-surface-variant">Metrado aprobado acumulado</Text>
        <Text testID="mapa-parcial-metrado" className="font-mono text-[16px] font-bold text-primary">{summary.doneLabel}</Text>
      </View>
    </View>
  );
}

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

/** «Exportar» of the map (design `o-12-mapa-exportar`): what the map shows, to Google Earth and to the client. */
export function WorkMapExport(props: Props) {
  const colors = useColores();
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copy = () => void Clipboard.setStringAsync(props.pageUrl).then(() => setCopied(true));
  return (
    <Sheet visible={props.open} onClose={props.onClose} testID="mapa-exportar-panel" tone="background" className="gap-3 px-4 pt-2">
      <View>
        <Text className="text-[12px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">Sacar la obra</Text>
        <Text className="text-[18px] font-semibold text-on-surface">Exportar</Text>
        <Text testID="mapa-exportar-alcance" className="mt-0.5 text-[14px] text-on-surface-variant">Sale lo que ves: {workMapScopeLabel(props.map, props.filter)}</Text>
      </View>
      <PartialProgress map={props.map} filter={props.filter} />
      <Card icon={<Globe size={18} color={colors['on-surface']} />} title="Google Earth (KMZ)" hint="Carpetas Ejecutado, por trabajo, y Pendiente.">
        <Pressable testID="mapa-descargar-kmz" onPress={() => void shareKmz(props.map, props.filter, props.title).then(setNotice)} className="mt-3 min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl bg-primary">
          <Download size={18} color={colors['on-primary']} />
          <Text className="text-[15px] font-semibold text-on-primary">Exportar KMZ</Text>
        </Pressable>
        {notice ? <Text accessibilityRole="alert" className="mt-2 text-[14px] text-error">{notice}</Text> : null}
      </Card>
      <Card icon={<Link2 size={18} color={colors['on-surface']} />} title="Enlace para el cliente" hint="El cliente solo ve lo aprobado.">
        <Text testID="mapa-enlace-cliente" numberOfLines={1} className="mt-2 rounded-lg bg-surface-variant px-2 py-1.5 font-mono text-[13px] text-on-surface-variant">{props.pageUrl}</Text>
        <Pressable testID="mapa-copiar-enlace" onPress={copy} className="mt-2 min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl border border-primary/30">
          <Copy size={18} color={colors.primary} />
          <Text className="text-[15px] font-semibold text-primary">{copied ? 'Enlace copiado' : 'Copiar enlace'}</Text>
        </Pressable>
      </Card>
    </Sheet>
  );
}
