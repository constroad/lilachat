/** The emojis that match «:word», in a strip over the field (José 30/10). */
export function EmojiSuggestions(props: { options: string[]; active: number; onPick: (emoji: string) => void }) {
  if (props.options.length === 0) return null;
  return (
    <div role="listbox" aria-label="Emojis" data-testid="sugerencias-emoji" className="absolute bottom-full left-0 mb-2 flex gap-1 rounded-xl border border-outline/15 bg-surface p-1 shadow-lg">
      {props.options.map((emoji, index) => (
        <button
          key={emoji}
          type="button"
          role="option"
          aria-selected={index === props.active}
          data-testid={`emoji-sugerido-${emoji}`}
          // mousedown, not click: the click comes after the field's blur.
          onMouseDown={(event) => {
            event.preventDefault();
            props.onPick(emoji);
          }}
          className={`grid h-10 w-10 place-items-center rounded-lg text-2xl ${index === props.active ? 'bg-primary/15' : 'hover:bg-background'}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
