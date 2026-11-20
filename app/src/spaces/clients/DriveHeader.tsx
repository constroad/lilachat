import { Pressable, ScrollView, Text, View } from 'react-native';
import { Camera, ClipboardPaste, LayoutGrid, List, Plus } from 'lucide-react-native';
import { DRIVE_KINDS, DRIVE_UPLOADING, type DriveKind, type DriveLayout } from '@lilachat/shared';
import { useColores } from '../../ui/tema';

/** Lista / Cuadrícula at the right of the chips (design cc-05: no «Drive del servicio» heading). */
export function DriveLayoutToggle(props: { layout: DriveLayout; onLayout: (layout: DriveLayout) => void }) {
  const colors = useColores();
  const toggle = (layout: DriveLayout, Icon: typeof List, label: string) => {
    const on = props.layout === layout;
    return (
      <Pressable testID={`drive-vista-${layout === 'list' ? 'lista' : 'cuadricula'}`} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={() => props.onLayout(layout)} className={`h-9 w-10 items-center justify-center rounded-lg ${on ? 'bg-surface' : ''}`}>
        <Icon size={18} color={on ? colors.primary : colors['on-surface-variant']} />
      </Pressable>
    );
  };
  return (
    <View className="flex-row rounded-xl bg-background p-0.5">
      {toggle('list', List, 'Ver como lista')}
      {toggle('grid', LayoutGrid, 'Ver como cuadrícula')}
    </View>
  );
}

/**
 * The Drive's actions (design cc-05): «Pegar», the camera one tap away (José 13/11; stitch-design 5-ter
 * rule 2) and ONE «Subir», at the right; on the APK under the service's bar (no portals in React Native).
 */
export function DriveHeader(props: { sending: boolean; onUpload: () => void; onCamera: () => void; /** «Pegar del portapapeles» (José 19/11, design cc-05). */ onPaste: () => void }) {
  const colors = useColores();
  return (
    <View className="flex-row items-center justify-end gap-2">
      <Pressable testID="drive-pegar" accessibilityRole="button" accessibilityLabel="Pegar del portapapeles" disabled={props.sending} onPress={props.onPaste} className="h-11 w-11 items-center justify-center rounded-xl border border-outline/20 bg-surface" style={{ opacity: props.sending ? 0.6 : 1 }}>
        <ClipboardPaste size={20} color={colors['on-surface']} />
      </Pressable>
      <Pressable testID="drive-camara" accessibilityRole="button" accessibilityLabel="Abrir la cámara" disabled={props.sending} onPress={props.onCamera} className="h-11 w-11 items-center justify-center rounded-xl bg-primary/10" style={{ opacity: props.sending ? 0.6 : 1 }}>
        <Camera size={20} color={colors.primary} />
      </Pressable>
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
    <ScrollView className="flex-1" horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
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
