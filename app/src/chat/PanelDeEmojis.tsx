import AsyncStorage from '@react-native-async-storage/async-storage';
import { View } from 'react-native';
import { EmojiKeyboard, es, useRecentPicksPersistence, type EmojiType } from 'rn-emoji-keyboard';
import { useColores } from '../ui/tema';

const CLAVE_DE_RECIENTES = 'lilachat.emojis.recientes';

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
        enableSearchBar
        categoryPosition="top"
        disableSafeArea
        emojiSize={28}
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
