import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Check, Save, Upload, X } from 'lucide-react-native';
import { CUSTOM_EMOJI_MAX_BYTES, customEmojiNameOf } from '@lilachat/shared';
import { addCustomEmoji, useSpaceEmojis } from '../../spaces/customEmojis';
import { Modal } from '../../ui/Modal';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';

type Picked = { uri: string; mimeType: string };
const ACCEPTED = ['image/png', 'image/webp', 'image/gif'];

/** «Agregar emoji» (design c-07): the image, its `:name:`, a preview, and save for the whole space. */
export function AddCustomEmojiSheet(props: { visible: boolean; onClose: () => void }) {
  const space = useSpaceEmojis();
  const colors = useColores();
  const margins = useMargenes();
  const [image, setImage] = useState<Picked | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!props.visible) return;
    setImage(null);
    setName('');
    setError(null);
  }, [props.visible]);
  if (!space) return null;
  const shortName = customEmojiNameOf(name);

  const pick = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false });
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return;
    if (!asset.mimeType || !ACCEPTED.includes(asset.mimeType)) return setError('Elige un PNG, WebP o GIF.');
    if (asset.fileSize && asset.fileSize > CUSTOM_EMOJI_MAX_BYTES) return setError('La imagen pasa de 256 KB. Elige una más liviana.');
    setError(null);
    setImage({ uri: asset.uri, mimeType: asset.mimeType });
  };
  const save = async () => {
    if (!image || !shortName || saving) return;
    setSaving(true);
    const added = await addCustomEmoji(space.jwt, space.spaceId, { name: shortName, ...image });
    setSaving(false);
    if (!added.ok) return setError(added.message);
    await space.reload();
    props.onClose();
  };

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose}>
      <View testID="agregar-emoji" className="flex-1 bg-background" style={{ paddingTop: margins.cabecera, paddingBottom: margins.pie }}>
        <View className="flex-row items-center gap-3 border-b border-outline/10 bg-surface px-3 py-2">
          <Pressable accessibilityLabel="Cerrar" onPress={props.onClose} className="h-11 w-11 items-center justify-center"><X size={22} color={colors['on-surface']} /></Pressable>
          <View className="flex-1">
            <Text className="text-[11px] font-bold uppercase tracking-widest text-primary" numberOfLines={1}>{space.spaceName}</Text>
            <Text className="text-[20px] font-bold text-on-surface">Agregar emoji</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Step title="Paso 1 · Imagen del emoji" done={Boolean(image)}>
            <Pressable testID="btn-elegir-imagen-emoji" onPress={() => void pick()} className="h-40 w-40 items-center justify-center self-center rounded-2xl border-2 border-dashed border-primary/40 bg-surface-variant/40">
              {image ? <Image source={{ uri: image.uri }} style={{ width: 96, height: 96 }} contentFit="contain" /> : <Upload size={32} color={colors.primary} />}
            </Pressable>
            <Pressable onPress={() => void pick()} className="mt-2 min-h-[44px] flex-row items-center justify-center gap-2">
              <Upload size={18} color={colors.primary} />
              <Text className="text-[16px] font-semibold text-primary">{image ? 'Cambiar imagen' : 'Elegir imagen'}</Text>
            </Pressable>
            <Text className="text-center text-[13px] text-on-surface-variant">PNG, WebP o GIF animado · hasta 256 KB · se ve a 128×128</Text>
          </Step>
          <Step title="Paso 2 · Nombre del código" done={Boolean(shortName)}>
            <View className={`min-h-[52px] flex-row items-center rounded-xl border px-4 ${shortName ? 'border-primary' : 'border-outline/30'}`}>
              <TextInput testID="nombre-emoji" value={name} onChangeText={setName} placeholder=":casco-ok:" placeholderTextColor={colors['on-surface-variant']} autoCapitalize="none" autoCorrect={false} className="flex-1 font-mono text-[18px] text-on-surface" />
              {shortName ? <Check size={20} color={colors.primary} /> : null}
            </View>
            <Text className="mt-2 text-[13px] text-on-surface-variant">{shortName ? `Se escribe :${shortName}: en el chat.` : 'Se escribe con dos puntos en el chat. Solo letras, números y guiones.'}</Text>
          </Step>
          {error ? <Text testID="error-emoji" className="text-[14px] text-error">{error}</Text> : null}
        </ScrollView>
        <View className="border-t border-outline/10 bg-surface px-4 pt-3">
          <Pressable testID="btn-guardar-emoji" disabled={!image || !shortName || saving} onPress={() => void save()} className={`min-h-[56px] flex-row items-center justify-center gap-2 rounded-2xl ${image && shortName ? 'bg-primary' : 'bg-primary/40'}`}>
            {saving ? <ActivityIndicator color={colors['on-primary']} /> : <Save size={20} color={colors['on-primary']} />}
            <Text className="text-[17px] font-semibold text-on-primary">Guardar emoji</Text>
          </Pressable>
          <Text className="py-2 text-center text-[13px] text-on-surface-variant">Lo verán todos en {space.spaceName}</Text>
        </View>
      </View>
    </Modal>
  );
}

function Step(props: { title: string; done: boolean; children: ReactNode }) {
  return (
    <View className="rounded-2xl border border-outline/15 bg-surface p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">{props.title}</Text>
        <Text className={`rounded-md px-2 py-0.5 text-[12px] font-bold ${props.done ? 'bg-en-linea/15 text-en-linea' : 'bg-primary/10 text-primary'}`}>{props.done ? 'LISTO' : 'Requerido'}</Text>
      </View>
      {props.children}
    </View>
  );
}
