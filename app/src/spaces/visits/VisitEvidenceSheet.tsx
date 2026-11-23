import { Pressable, Text, View } from 'react-native';
import { Camera, Image as ImageIcon, Video, X } from 'lucide-react-native';
import { Sheet } from '../../ui/Sheet';
import { useColores } from '../../ui/tema';

export type VisitEvidenceOption = 'photo' | 'video' | 'gallery';
const OPTIONS: readonly { id: VisitEvidenceOption; title: string; detail: string }[] = [
  { id: 'photo', title: 'Tomar foto', detail: 'Con la hora, el lugar y el GPS' },
  { id: 'video', title: 'Grabar video', detail: 'Con la hora, el lugar y el GPS' },
  { id: 'gallery', title: 'Galería', detail: 'Una foto o un video ya guardado' },
];
const ICONS = { photo: Camera, video: Video, gallery: ImageIcon } as const;
const TEST_IDS = { photo: 'visita-evidencia-foto', video: 'visita-evidencia-video', gallery: 'visita-evidencia-galeria' } as const;

/** «Foto suelta» (Portal 23/11: photo, video or gallery, several at once): the sheet stays open for the next one. */
export function VisitEvidenceSheet(props: { visible: boolean; onClose: () => void; onPick: (option: VisitEvidenceOption) => void }) {
  const colors = useColores();
  return (
    <Sheet visible={props.visible} onClose={props.onClose} testID="hoja-evidencia-visita" className="px-4">
      <View className="flex-row items-start gap-3 pb-3 pt-1">
        <View className="min-w-0 flex-1">
          <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">Visita técnica</Text>
          <Text className="text-[20px] font-bold text-on-surface">Agregar evidencia</Text>
        </View>
        <Pressable testID="visita-evidencia-cerrar" accessibilityLabel="Cerrar" onPress={props.onClose} className="h-11 w-11 items-center justify-center rounded-full border border-outline/15">
          <X size={18} color={colors['on-surface']} />
        </Pressable>
      </View>
      <View className="gap-2">
        {OPTIONS.map((option) => {
          const Icon = ICONS[option.id];
          return (
            <Pressable key={option.id} testID={TEST_IDS[option.id]} accessibilityRole="button" onPress={() => props.onPick(option.id)} className="min-h-[68px] flex-row items-center gap-3 rounded-xl border border-outline/15 bg-surface px-3 py-2">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-primary/10"><Icon size={20} color={colors.primary} /></View>
              <View className="min-w-0 flex-1">
                <Text className="text-[16px] font-semibold text-on-surface">{option.title}</Text>
                <Text className="text-[13px] text-on-surface-variant" numberOfLines={1}>{option.detail}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Pressable testID="visita-evidencia-cancelar" onPress={props.onClose} className="mt-3 min-h-[52px] items-center justify-center rounded-xl border border-outline/15 bg-background">
        <Text className="text-[15px] font-semibold text-on-surface">Listo</Text>
      </Pressable>
    </Sheet>
  );
}
