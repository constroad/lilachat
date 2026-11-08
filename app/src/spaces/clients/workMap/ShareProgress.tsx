import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Copy, ShieldCheck } from 'lucide-react-native';
import { partialProgressOf, partialStreetsLabel, shareStageOptions, type WorkMap, type WorkMapFilter } from '@lilachat/shared';
import { Sheet } from '../../../ui/Sheet';
import { useColores } from '../../../ui/tema';
import { DayChips, SHEET_LABEL, StageChips } from './CutChips';

type Props = { open: boolean; map: WorkMap; filter: WorkMapFilter; onFilter: (filter: WorkMapFilter) => void; pageUrl: string; onClose: () => void };

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

/** «Compartir avance» on the phone (design o-08 mobile): the cut, what it shows, and the link the client opens. */
export function ShareProgress(props: Props) {
  const colors = useColores();
  const [copied, setCopied] = useState(false);
  const copy = () => void Clipboard.setStringAsync(props.pageUrl).then(() => setCopied(true));
  return (
    <Sheet visible={props.open} onClose={props.onClose} testID="mapa-compartir-panel" tone="background" className="gap-4 px-4 pt-2">
      <View>
        <Text className="text-[12px] font-bold uppercase tracking-[1.5px] text-primary">Compartir avance</Text>
        <Text className="text-[22px] font-bold text-on-surface">Avance parcial</Text>
        <Text className="mt-0.5 text-[14px] text-on-surface-variant">Elige el corte de obra para el enlace que verá el cliente.</Text>
      </View>
      <StageChips map={props.map} filter={props.filter} onFilter={props.onFilter} options={shareStageOptions(props.map)} />
      <DayChips map={props.map} filter={props.filter} onFilter={props.onFilter} />
      <FrontSummary map={props.map} filter={props.filter} />
      <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-4">
        <Text className={SHEET_LABEL}>Enlace público seguro</Text>
        <Text testID="mapa-enlace-cliente" numberOfLines={1} className="rounded-lg border border-outline/20 bg-background px-2.5 py-2 font-mono text-[13px] text-on-surface">{props.pageUrl}</Text>
        <View className="flex-row items-start gap-1.5"><ShieldCheck size={15} color={colors.primary} /><Text className="flex-1 text-[13px] text-on-surface-variant">El cliente ve solo lo aprobado por la inspección técnica.</Text></View>
      </View>
      <Pressable testID="mapa-copiar-enlace" onPress={copy} className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-xl bg-primary">
        <Copy size={18} color={colors['on-primary']} />
        <Text className="text-[16px] font-semibold text-on-primary">{copied ? 'Enlace copiado' : 'Copiar enlace de avance'}</Text>
      </Pressable>
    </Sheet>
  );
}
