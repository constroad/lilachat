import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, X } from 'lucide-react-native';
import type { FormField } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import type { PhotoUpload } from './AppFormFields';

type PhotoList = Extract<FormField, { kind: 'photo' }>;
type Shot = { key: string; uri: string; fileId: string | null };
const THUMB = 84;
/** Native and untouched: `uploadFormPhoto` makes it lighter once (Portal's standard, 28/10). */
const PHOTO_QUALITY = 1;

/**
 * Several photos (José, 24/10: the tank tape and the material receipt): take
 * one, take another, remove any and take it again. Each goes up at once; the
 * form carries the list of ids in the order taken. The web's twin is
 * `PhotoListField` there.
 */
export function PhotoListField(props: { field: PhotoList; error?: string; onChange: (value: unknown) => void; upload: PhotoUpload }) {
  const colors = useColores();
  const [shots, setShots] = useState<Shot[]>([]);
  const [message, setMessage] = useState<string | undefined>();
  const report = (next: Shot[]) => {
    setShots(next);
    const ids = next.map((shot) => shot.fileId).filter((id): id is string => id !== null);
    props.onChange(ids.length ? ids : undefined);
  };
  /** The camera, or the gallery when the app allows it (`x-gallery`: a transfer receipt is a screenshot, E2E 28/10). */
  const take = async (source: 'camera' | 'gallery') => {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return setMessage('Permite la cámara para tomar la foto.');
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ cameraType: ImagePicker.CameraType.back, quality: PHOTO_QUALITY, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: PHOTO_QUALITY, allowsEditing: false });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    const shot: Shot = { key: `${Date.now()}`, uri: asset.uri, fileId: null };
    setMessage(undefined);
    setShots((before) => [...before, shot]);
    const uploaded = await props.upload({ uri: asset.uri, mime: asset.mimeType ?? 'image/jpeg' });
    setShots((before) => {
      const next = uploaded.ok ? before.map((one) => (one.key === shot.key ? { ...one, fileId: uploaded.fileId } : one)) : before.filter((one) => one.key !== shot.key);
      const ids = next.map((one) => one.fileId).filter((id): id is string => id !== null);
      props.onChange(ids.length ? ids : undefined);
      return next;
    });
    if (!uploaded.ok) setMessage(uploaded.message);
  };
  const uploading = shots.some((shot) => shot.fileId === null);
  const full = shots.length >= props.field.max;
  return (
    <View testID={`fotos-${props.field.name}`} className="rounded-2xl border border-outline/15 p-3">
      <Text className="text-[15px] font-semibold text-on-surface">{props.field.label}</Text>
      {props.field.help ? <Text className="text-[13px] text-on-surface-variant">{props.field.help}</Text> : null}
      <Text className="mt-0.5 text-[12px] text-on-surface-variant">{`${shots.length} de ${props.field.max}${props.field.min > 1 ? ` · al menos ${props.field.min}` : ''}`}</Text>
      <View className="mt-2 flex-row flex-wrap gap-2">
        {shots.map((shot, index) => (
          <View key={shot.key} className="overflow-hidden rounded-xl border border-outline/20" style={{ width: THUMB, height: THUMB }}>
            <Image source={{ uri: shot.uri }} style={{ width: THUMB, height: THUMB }} />
            {shot.fileId === null ? <View className="absolute inset-0 items-center justify-center bg-black/40"><ActivityIndicator color="white" /></View> : null}
            <Pressable testID={`quitar-foto-${props.field.name}-${index}`} accessibilityLabel={`Quitar la foto ${index + 1}`} onPress={() => report(shots.filter((one) => one.key !== shot.key))} className="absolute right-1 top-1 h-7 w-7 items-center justify-center rounded-full bg-black/60">
              <X size={15} color="white" />
            </Pressable>
          </View>
        ))}
        {full ? null : (
          <Pressable testID={`campo-${props.field.name}`} accessibilityLabel="Tomar otra foto" disabled={uploading} onPress={() => void take('camera')} className={`items-center justify-center gap-1 rounded-xl border-2 border-dashed border-outline/30 ${uploading ? 'opacity-50' : ''}`} style={{ width: THUMB, height: THUMB }}>
            <Camera size={22} color={colors.primary} />
            <Text className="text-[12px] font-semibold text-primary">{shots.length ? 'Otra' : 'Tomar'}</Text>
          </Pressable>
        )}
        {full || !props.field.gallery ? null : (
          <Pressable testID={`galeria-${props.field.name}`} accessibilityLabel="Elegir de la galería" disabled={uploading} onPress={() => void take('gallery')} className={`items-center justify-center gap-1 rounded-xl border-2 border-dashed border-outline/30 ${uploading ? 'opacity-50' : ''}`} style={{ width: THUMB, height: THUMB }}>
            <ImageIcon size={22} color={colors.primary} />
            <Text className="text-[12px] font-semibold text-primary">Galería</Text>
          </Pressable>
        )}
      </View>
      {message ?? props.error ? <Text className="mt-1 text-[13px] text-error">{message ?? props.error}</Text> : null}
    </View>
  );
}
