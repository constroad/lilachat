import AsyncStorage from '@react-native-async-storage/async-storage';
import { View } from 'react-native';
import type { ComponentProps } from 'react';
import { EmojiKeyboard, es, useRecentPicksPersistence, type EmojiType } from 'rn-emoji-keyboard';
import { useColores } from '../ui/tema';

const CLAVE_DE_RECIENTES = 'lilachat.emojis.recientes';
const CATEGORY_ORDER: NonNullable<ComponentProps<typeof EmojiKeyboard>['categoryOrder']> = ['recently_used', 'smileys_emotion', 'people_body', 'animals_nature', 'food_drink', 'travel_places', 'activities', 'objects', 'symbols', 'flags'];

/** Los recientes sobreviven al cerrar la app, como en WhatsApp. No son secretos: AsyncStorage alcanza. */
async function leerRecientes() {
  try {
    const guardado = await AsyncStorage.getItem(CLAVE_DE_RECIENTES);
    return guardado ? JSON.parse(guardado) : [];
  } catch {
    return [];
  }
}

/**
 * El panel de emojis (José, 18/10: «no hay un botón de emojis como en
 * WhatsApp»). Ocupa el lugar del teclado: con recientes, categorías y
 * buscador, en los colores del tema. MIT, sin código nativo.
 */
export function PanelDeEmojis({ onElegir }: { onElegir: (emoji: string) => void }) {
  const colores = useColores();
  useRecentPicksPersistence({
    initialization: leerRecientes,
    onStateChange: (recientes) => AsyncStorage.setItem(CLAVE_DE_RECIENTES, JSON.stringify(recientes)).catch(() => undefined),
  });
  return (
    <View testID="panel-emojis" style={{ flex: 1 }}>
      <EmojiKeyboard
        onEmojiSelected={(emoji: EmojiType) => onElegir(emoji.emoji)}
        translation={es}
        enableRecentlyUsed
        // The library puts «recently used» LAST; WhatsApp opens on them (José, 22/10).
        categoryOrder={CATEGORY_ORDER}
        enableSearchBar
        categoryPosition="top"
        disableSafeArea
        // Its columns are width / (2 × size): 28 gave 6 per row, «muy separado»; 22 gives 8, like WhatsApp.
        emojiSize={22}
        styles={{ container: { borderRadius: 0, shadowOpacity: 0, elevation: 0 } }}
        theme={{
          container: colores.surface,
          header: colores['on-surface-variant'],
          category: { icon: colores['on-surface-variant'], iconActive: colores.primary, container: colores.surface, containerActive: colores['surface-variant'] },
          search: { background: colores['surface-variant'], text: colores['on-surface'], placeholder: colores['on-surface-variant'], icon: colores['on-surface-variant'] },
          emoji: { selected: colores['surface-variant'] },
        }}
      />
    </View>
  );
}
