import EmojiPicker, { Categories, EmojiStyle, SuggestionMode, Theme } from 'emoji-picker-react';

/** Las categorías en español, como el panel de la app. */
const CATEGORIAS = [
  { category: Categories.SUGGESTED, name: 'Recientes' },
  { category: Categories.SMILEYS_PEOPLE, name: 'Caras y personas' },
  { category: Categories.ANIMALS_NATURE, name: 'Animales y naturaleza' },
  { category: Categories.FOOD_DRINK, name: 'Comida y bebida' },
  { category: Categories.TRAVEL_PLACES, name: 'Viajes y lugares' },
  { category: Categories.ACTIVITIES, name: 'Actividades' },
  { category: Categories.OBJECTS, name: 'Objetos' },
  { category: Categories.SYMBOLS, name: 'Símbolos' },
  { category: Categories.FLAGS, name: 'Banderas' },
];

/**
 * El panel de emojis (W2), con los emojis NATIVOS del sistema: sin imágenes de
 * un CDN. Se carga recién al abrirlo (`lazy` en el Composer): pesa y la
 * mayoría de las visitas no lo usa.
 */
export default function PanelDeEmojis({ onElegir }: { onElegir: (emoji: string) => void }) {
  return (
    <EmojiPicker
      // The page's own theme (the `dark` class), not the system's: in dark mode it was a white box (José, 21/10).
      theme={document.documentElement.classList.contains('dark') ? Theme.DARK : Theme.LIGHT}
      emojiStyle={EmojiStyle.NATIVE}
      categories={CATEGORIAS}
      searchPlaceholder="Buscar emoji"
      suggestedEmojisMode={SuggestionMode.RECENT}
      previewConfig={{ showPreview: false }}
      skinTonesDisabled
      lazyLoadEmojis
      width="100%"
      height={360}
      onEmojiClick={(dato) => onElegir(dato.emoji)}
    />
  );
}
