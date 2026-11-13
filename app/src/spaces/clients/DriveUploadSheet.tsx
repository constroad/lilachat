import { Pressable, Text, View } from 'react-native';
import { Camera, ChevronRight, FileText, Image as ImageIcon, Video, X } from 'lucide-react-native';
import { DRIVE_UPLOAD_OPTIONS, type DriveUploadOption } from '@lilachat/shared';
import { Sheet } from '../../ui/Sheet';
import { useColores } from '../../ui/tema';

const ICONS = { photo: Camera, video: Video, gallery: ImageIcon, document: FileText } as const;
const TEST_IDS = { photo: 'drive-tomar-foto', video: 'drive-grabar-video', gallery: 'drive-galeria', document: 'drive-documento' } as const;

/** «Subir al Drive» (design drv-03, José 13/11): the four ways in behind ONE button, never four buttons on the screen. */
export function DriveUploadSheet(props: { visible: boolean; onClose: () => void; onPick: (option: DriveUploadOption['id']) => void }) {
  const colors = useColores();
  const pick = (option: DriveUploadOption['id']) => {
    props.onClose();
    props.onPick(option);
  };
  return (
    <Sheet visible={props.visible} onClose={props.onClose} testID="hoja-subir-drive" className="px-4">
      <View className="flex-row items-start gap-3 pb-3 pt-1">
        <View className="min-w-0 flex-1">
          <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">Drive del servicio</Text>
          <Text className="text-[20px] font-bold text-on-surface">Subir al Drive</Text>
        </View>
        <Pressable testID="drive-subir-cerrar" accessibilityLabel="Cerrar" onPress={props.onClose} className="h-11 w-11 items-center justify-center rounded-full border border-outline/15">
          <X size={18} color={colors['on-surface']} />
        </Pressable>
      </View>
      <View className="gap-2">
        {DRIVE_UPLOAD_OPTIONS.map((option) => {
          const Icon = ICONS[option.id];
          return (
            <Pressable key={option.id} testID={TEST_IDS[option.id]} accessibilityRole="button" onPress={() => pick(option.id)} className="min-h-[68px] flex-row items-center gap-3 rounded-xl border border-outline/15 bg-surface px-3 py-2">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-primary/10"><Icon size={20} color={colors.primary} /></View>
              <View className="min-w-0 flex-1">
                <Text className="text-[16px] font-semibold text-on-surface">{option.title}</Text>
                <Text className="text-[13px] text-on-surface-variant" numberOfLines={1}>{option.detail}</Text>
              </View>
              <ChevronRight size={18} color={colors['on-surface-variant']} />
            </Pressable>
          );
        })}
      </View>
      <Pressable testID="drive-subir-cancelar" onPress={props.onClose} className="mt-3 min-h-[52px] items-center justify-center rounded-xl border border-outline/15 bg-background">
        <Text className="text-[15px] font-semibold text-on-surface">Cancelar</Text>
      </Pressable>
    </Sheet>
  );
}
