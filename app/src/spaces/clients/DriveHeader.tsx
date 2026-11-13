import { Pressable, ScrollView, Text, View } from 'react-native';
import { LayoutGrid, List, Plus } from 'lucide-react-native';
import { DRIVE_KINDS, DRIVE_UPLOADING, type DriveKind, type DriveLayout } from '@lilachat/shared';
import { useColores } from '../../ui/tema';

const filesLabel = (count: number) => (count === 1 ? '1 archivo' : `${count} archivos`);

/** Design drv-01/02: «DRIVE DEL SERVICIO · 70 archivos», the list / grid switch and ONE «Subir». */
export function DriveHeader(props: { count: number | null; layout: DriveLayout; onLayout: (layout: DriveLayout) => void; sending: boolean; onUpload: () => void }) {
  const colors = useColores();
  const toggle = (layout: DriveLayout, Icon: typeof List, label: string) => {
    const on = props.layout === layout;
    return (
      <Pressable testID={`drive-vista-${layout === 'list' ? 'lista' : 'cuadricula'}`} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={() => props.onLayout(layout)} className={`h-10 w-11 items-center justify-center rounded-lg ${on ? 'bg-primary/10' : ''}`}>
        <Icon size={19} color={on ? colors.primary : colors['on-surface-variant']} />
      </Pressable>
    );
  };
  return (
    <View className="flex-row items-center gap-2">
      <View className="min-w-0 flex-1">
        <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant" numberOfLines={1}>Drive del servicio</Text>
        {props.count !== null ? <Text className="text-[16px] font-bold text-on-surface">{filesLabel(props.count)}</Text> : null}
      </View>
      <View className="flex-row rounded-xl border border-outline/15 bg-surface p-0.5">
        {toggle('list', List, 'Ver como lista')}
        {toggle('grid', LayoutGrid, 'Ver como cuadrícula')}
      </View>
      <Pressable testID="drive-subir" accessibilityRole="button" disabled={props.sending} onPress={props.onUpload} className="h-11 flex-row items-center gap-1.5 rounded-xl bg-primary px-4" style={{ opacity: props.sending ? 0.6 : 1 }}>
        <Plus size={18} color={colors['on-primary']} />
        <Text className="text-[15px] font-bold text-on-primary">{props.sending ? DRIVE_UPLOADING : 'Subir'}</Text>
      </Pressable>
    </View>
  );
}

/** Todo · Fotos · Videos · Documentos. */
export function DriveKindChips(props: { kind: DriveKind; onKind: (kind: DriveKind) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
      {DRIVE_KINDS.map((one) => {
        const on = props.kind === one.kind;
        return (
          <Pressable key={one.kind} testID={`drive-tipo-${one.kind}`} accessibilityState={{ selected: on }} onPress={() => props.onKind(one.kind)} className={`h-9 justify-center rounded-full border px-4 ${on ? 'border-primary bg-primary' : 'border-outline/20 bg-surface'}`}>
            <Text className={`text-[14px] font-semibold ${on ? 'text-on-primary' : 'text-on-surface'}`}>{one.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
