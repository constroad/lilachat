import { Pressable, ScrollView, Text, View } from 'react-native';
import { RotateCcw, X } from 'lucide-react-native';
import { useMargenes } from '../../ui/useMargenes';
import { useColores } from '../../ui/tema';

const RATIOS: { label: string; aspect: number | null }[] = [
  { label: 'Libre', aspect: null },
  { label: 'Cuadrado', aspect: 1 },
  { label: '4:3', aspect: 4 / 3 },
  { label: '3:4', aspect: 3 / 4 },
  { label: '16:9', aspect: 16 / 9 },
];

/** Cancel, «Restablecer» and the quarter turn, like WhatsApp's crop bar. */
export function CropHeader(props: { onCancel: () => void; onReset: () => void; onRotate: () => void }) {
  const margins = useMargenes();
  return (
    <View className="flex-row items-center px-3 pb-2" style={{ paddingTop: margins.cabecera }}>
      <Pressable testID="btn-cancelar-recorte" accessibilityLabel="Cancelar el recorte" onPress={props.onCancel} className="h-11 w-11 items-center justify-center">
        <X size={24} color="white" />
      </Pressable>
      <Text className="flex-1 text-base font-semibold" style={{ color: 'white' }}>Recortar</Text>
      <Pressable testID="btn-restablecer-recorte" onPress={props.onReset} className="h-11 justify-center px-3">
        <Text className="text-[15px] font-semibold" style={{ color: 'white' }}>Restablecer</Text>
      </Pressable>
      <Pressable testID="btn-girar-foto" accessibilityLabel="Girar a la izquierda" onPress={props.onRotate} className="h-11 w-11 items-center justify-center">
        <RotateCcw size={22} color="white" />
      </Pressable>
    </View>
  );
}

/** Free or a fixed shape for the frame. */
export function RatioBar(props: { aspect: number | null; onPick: (aspect: number | null) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 10 }}>
      {RATIOS.map((ratio) => {
        const chosen = ratio.aspect === props.aspect;
        return (
          <Pressable key={ratio.label} testID={`proporcion-${ratio.label}`} accessibilityState={{ selected: chosen }} onPress={() => props.onPick(ratio.aspect)} className="min-h-[36px] justify-center rounded-full px-4" style={{ backgroundColor: chosen ? 'white' : 'rgba(255,255,255,0.15)' }}>
            <Text className="text-[14px] font-semibold" style={{ color: chosen ? 'black' : 'white' }}>{ratio.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** What is happening, and «Listo». */
export function CropFooter(props: { failed: boolean; busy: boolean; ready: boolean; onDone: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const enabled = props.ready && !props.busy;
  return (
    <View className="flex-row items-center px-4 pt-1" style={{ paddingBottom: margins.pie + 8 }}>
      <Text className="flex-1 text-[13px]" style={{ color: props.failed ? colors.error : 'rgba(255,255,255,0.7)' }}>
        {props.failed ? 'No se pudo recortar. Inténtalo de nuevo.' : props.busy ? 'Recortando…' : 'Arrastra las esquinas para recortar'}
      </Text>
      <Pressable testID="btn-listo-recorte" disabled={!enabled} onPress={props.onDone} className="min-h-[44px] items-center justify-center rounded-full bg-primary px-6" style={{ opacity: enabled ? 1 : 0.6 }}>
        <Text className="text-[15px] font-semibold" style={{ color: colors['on-primary'] }}>Listo</Text>
      </Pressable>
    </View>
  );
}
