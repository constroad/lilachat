import { Pressable, Text, View } from 'react-native';

export type CameraMode = 'picture' | 'video';
/** The recording red of designs cam-04/cam-05. */
export const RECORD_RED = '#dc2626';

/** FOTO / VIDEO under the stamp (design cam-04). */
export function ModeSwitch(props: { mode: CameraMode; onMode: (mode: CameraMode) => void }) {
  const option = (mode: CameraMode, label: string) => (
    <Pressable testID={`modo-${mode}`} accessibilityRole="tab" accessibilityState={{ selected: props.mode === mode }} onPress={() => props.onMode(mode)} className="items-center px-4 py-1">
      <Text className="text-[15px] font-bold tracking-widest" style={{ color: 'white', opacity: props.mode === mode ? 1 : 0.55 }}>{label}</Text>
      <View className="mt-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: props.mode === mode ? (mode === 'video' ? RECORD_RED : 'white') : 'transparent' }} />
    </Pressable>
  );
  return (
    <View className="mb-2 flex-row justify-center gap-4">
      {option('picture', 'FOTO')}
      {option('video', 'VIDEO')}
    </View>
  );
}

