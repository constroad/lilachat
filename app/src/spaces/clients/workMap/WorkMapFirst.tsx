import type { ReactNode } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { WORK_MAP_FIRST } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { KICKER } from './WorkMapPanel';

/** Design o-10: a service without streets, and where to draw them (José 07/11: everyone draws and updates). */
/** `trace`: «Importar KMZ o KML» (o-12), so a service without streets can start from a file (audit 08/11). */
export function WorkMapFirst({ drawUrl, onDraw, trace }: { drawUrl: string | null; onDraw?: () => void; trace?: ReactNode }) {
  const colores = useColores();
  return (
    <View testID="mapa-primera-calle" className="rounded-2xl border border-outline/15 bg-surface p-5">
      <Text className={`${KICKER} text-primary`}>{WORK_MAP_FIRST.kicker}</Text>
      <Text className="mt-1 text-[20px] font-bold text-on-surface">{WORK_MAP_FIRST.title}</Text>
      <Text className="mt-1 text-[14px] text-on-surface-variant">{WORK_MAP_FIRST.hint}</Text>
      <View className="mt-4 rounded-xl border border-outline/15 bg-background">
        {WORK_MAP_FIRST.steps.map((step, index) => (
          <View key={step} className={`flex-row items-center gap-3 px-3 py-2.5 ${index ? 'border-t border-outline/10' : ''}`}>
            <View className="h-6 w-6 items-center justify-center rounded-full border border-primary/30">
              <Text className="text-[12px] text-primary">{index + 1}</Text>
            </View>
            <Text className="text-[14px] font-semibold text-on-surface">{step}</Text>
          </View>
        ))}
      </View>
      {onDraw ? (
        <Pressable testID="mapa-dibujar-calle" accessibilityRole="button" onPress={onDraw} className="mt-4 min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl bg-primary">
          <Plus size={18} color={colores['on-primary']} />
          <Text className="text-[15px] font-semibold text-on-primary">{WORK_MAP_FIRST.draw}</Text>
        </Pressable>
      ) : null}
      {trace ? <View className="mt-4">{trace}</View> : null}
      {drawUrl ? (
        <Pressable testID="mapa-dibujar-portal" accessibilityRole="link" onPress={() => void Linking.openURL(drawUrl)} className="mt-1 min-h-[44px] items-center justify-center">
          <Text className="text-[14px] font-semibold text-primary">{WORK_MAP_FIRST.action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
