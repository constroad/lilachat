import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Camera, ImagePlus } from 'lucide-react-native';
import { ADD_PHOTO_LABEL, afterPhotoAdd, ADDING_PHOTO, photosLabel, type ProgressPhotoResult } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';

type Props = { id: string; photos: number; /** Undefined: the record shows its photos but takes no more. */ add?: () => Promise<ProgressPhotoResult | null> };

/** «Agregar foto» on a record already made (José 28/11): the same camera as «Tomar foto y registrar», then its count. */
export function AddProgressPhoto(props: Props) {
  const colors = useColores();
  const [photos, setPhotos] = useState(props.photos);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = Math.max(photos, props.photos);
  const { add } = props;
  const press = async () => {
    if (!add) return;
    setBusy(true);
    setError(null);
    const added = await add();
    const next = afterPhotoAdd(added, shown);
    setBusy(false);
    setError(next.error);
    setPhotos(next.photos);
  };
  if (!shown && !add) return null;
  return (
    <View className="gap-1">
      <View className="flex-row flex-wrap items-center gap-2">
        {shown ? <View testID={`avance-fotos-${props.id}`} className="flex-row items-center gap-1"><Camera size={14} color={colors['on-surface-variant']} /><Text className="text-[13px] font-semibold text-on-surface">{photosLabel(shown)}</Text></View> : null}
        {add ? (
          <Pressable testID={`agregar-foto-${props.id}`} disabled={busy} onPress={() => void press()} className={`h-11 flex-row items-center gap-1.5 rounded-xl border border-outline/25 px-3 ${busy ? 'opacity-60' : ''}`}>
            <ImagePlus size={16} color={colors['on-surface']} /><Text className="text-[14px] font-semibold text-on-surface">{busy ? ADDING_PHOTO : ADD_PHOTO_LABEL}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text testID={`agregar-foto-error-${props.id}`} accessibilityRole="alert" className="text-[13px] font-semibold text-error">{error}</Text> : null}
    </View>
  );
}
