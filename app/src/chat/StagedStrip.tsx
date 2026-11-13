import { Image } from 'expo-image';
import { Pressable, ScrollView, View } from 'react-native';
import { Play, X } from 'lucide-react-native';
import { useColores } from '../ui/tema';
import type { FotoElegida } from './envioDeFotos';

export type StagedPhotos = {
  items: FotoElegida[];
  remove: (uri: string) => void;
  /** Opens the one preview of the chat (`EnviarFotos`): captions, crop and HD. */
  preview: () => void;
  send: (text: string) => void;
};

const THUMB = 64;

/** José 13/11: the picked photos and videos wait inside the field as thumbnails, like Claude's input. */
export function StagedStrip(props: { staged: StagedPhotos }) {
  const colors = useColores();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} testID="adjuntos-en-espera" contentContainerStyle={{ gap: 8, paddingHorizontal: 10, paddingTop: 10 }} keyboardShouldPersistTaps="handled">
      {props.staged.items.map((shot) => (
        <Pressable key={shot.uri} testID="adjunto-en-espera" accessibilityLabel="Ver antes de enviar" onPress={props.staged.preview} style={{ width: THUMB, height: THUMB }} className="overflow-hidden rounded-xl bg-surface-variant">
          <Image source={{ uri: shot.uri }} style={{ width: THUMB, height: THUMB }} contentFit="cover" />
          {shot.mimeType?.startsWith('video/') ? (
            <View className="absolute inset-0 items-center justify-center">
              <Play size={20} color={colors['on-primary']} fill={colors['on-primary']} />
            </View>
          ) : null}
          <Pressable testID="quitar-adjunto" accessibilityLabel="Quitar" hitSlop={8} onPress={() => props.staged.remove(shot.uri)} className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-on-surface/70">
            <X size={14} color={colors.surface} />
          </Pressable>
        </Pressable>
      ))}
    </ScrollView>
  );
}
