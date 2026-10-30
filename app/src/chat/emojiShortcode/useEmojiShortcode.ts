import { useState } from 'react';
import { insertShortcodeEmoji, loadEmojiNames, searchEmojis, shortcodeAt, type EmojiName, type Shortcode } from '@lilachat/shared';

/**
 * «:hug» in the field (José 30/10, like WhatsApp): the matching emojis over
 * the field, one tap puts the chosen one. The name table loads the first time
 * «:» is typed, so it costs nothing to whoever never uses it.
 */
export function useEmojiShortcode() {
  const [table, setTable] = useState<EmojiName[] | null>(null);
  const [code, setCode] = useState<Shortcode | null>(null);
  const [caret, setCaret] = useState(0);
  const options = code && table ? searchEmojis(table, code.query) : [];
  const onChange = (text: string, nextCaret: number) => {
    const next = shortcodeAt(text, nextCaret);
    setCode(next);
    setCaret(nextCaret);
    if (next && !table) void loadEmojiNames().then(setTable);
  };
  const pick = (text: string, emoji: string) => {
    if (!code) return null;
    setCode(null);
    return insertShortcodeEmoji(text, code, caret, emoji);
  };
  return { options, onChange, pick };
}
