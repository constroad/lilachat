import { Pressable, ScrollView, Text } from 'react-native';

/** The emojis that match «:word», in a row over the field (José 30/10). */
export function EmojiSuggestions(props: { options: readonly string[]; onPick: (emoji: string) => void }) {
  if (props.options.length === 0) return null;
  return (
    <ScrollView testID="sugerencias-emoji" horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} className="border-t border-outline/10 bg-surface" contentContainerStyle={{ paddingHorizontal: 8, gap: 4 }}>
      {props.options.map((emoji) => (
        <Pressable key={emoji} testID={`emoji-sugerido-${emoji}`} accessibilityLabel={`Poner ${emoji}`} onPress={() => props.onPick(emoji)} className="h-12 w-12 items-center justify-center rounded-xl">
          <Text style={{ fontSize: 26 }}>{emoji}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
