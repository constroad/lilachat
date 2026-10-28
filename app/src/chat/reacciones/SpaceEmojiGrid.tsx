import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, ToastAndroid, View } from 'react-native';
import { Image } from 'expo-image';
import { Plus } from 'lucide-react-native';
import { customEmojiToken } from '@lilachat/shared';
import { removeCustomEmoji, useSpaceEmojis, type SpaceEmojis } from '../../spaces/customEmojis';
import type { CustomEmoji } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { AddCustomEmojiSheet } from './AddCustomEmojiSheet';

/** Tiles of the space's own emojis on top of the full picker (design c-06). */
const TILE = 52;
/** Two rows show; more scroll inside, so the whole picker still fits. */
const MAX_HEIGHT = 2 * (TILE + 24);

export function SpaceEmojiGrid(props: { onPick: (emoji: string) => void }) {
  const space = useSpaceEmojis();
  const colors = useColores();
  const [adding, setAdding] = useState(false);
  if (!space) return null;
  return (
    <View testID="emojis-del-espacio" className="border-b border-outline/10 px-4 pb-2">
      <View className="min-h-[44px] flex-row items-center">
        <Text className="flex-1 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant" numberOfLines={1}>
          De {space.spaceName} · {space.emojis.length}
        </Text>
        <Pressable testID="btn-agregar-emoji" accessibilityRole="button" onPress={() => setAdding(true)} className="min-h-[44px] flex-row items-center gap-1 px-1">
          <Plus size={16} color={colors.primary} />
          <Text className="text-[14px] font-semibold text-primary">Agregar</Text>
        </Pressable>
      </View>
      {space.emojis.length === 0 ? (
        <Text className="pb-2 text-[13px] text-on-surface-variant">Este espacio todavía no tiene emojis propios.</Text>
      ) : (
        <ScrollView style={{ maxHeight: MAX_HEIGHT }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {space.emojis.map((emoji) => (
            <Pressable key={emoji.id} testID={`emoji-propio-${emoji.name}`} accessibilityLabel={`Reaccionar con :${emoji.name}:`} onPress={() => props.onPick(customEmojiToken(emoji.name))} onLongPress={() => confirmRemove(space, emoji)} className="items-center" style={{ width: TILE }}>
              <View className="items-center justify-center rounded-xl border border-outline/15 bg-surface" style={{ width: TILE, height: TILE }}>
                <Image source={{ uri: emoji.url }} style={{ width: 32, height: 32 }} contentFit="contain" />
              </View>
              <Text className="mt-1 font-mono text-[10px] text-on-surface-variant" numberOfLines={1}>:{emoji.name}:</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <AddCustomEmojiSheet visible={adding} onClose={() => setAdding(false)} />
    </View>
  );
}

/** Long press: take it out of the space. The server decides who may (its author or an admin) and says why not. */
function confirmRemove(space: SpaceEmojis, emoji: CustomEmoji): void {
  Alert.alert(`¿Quitar :${emoji.name}:?`, `Deja de estar en ${space.spaceName}. Las reacciones que ya lo usan muestran su nombre.`, [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Quitar',
      style: 'destructive',
      onPress: () =>
        void removeCustomEmoji(space.jwt, space.spaceId, emoji.id).then(async (removed) => {
          if (!removed.ok) return ToastAndroid.show(removed.message ?? 'No se pudo quitar el emoji.', ToastAndroid.SHORT);
          await space.reload();
        }),
    },
  ]);
}
