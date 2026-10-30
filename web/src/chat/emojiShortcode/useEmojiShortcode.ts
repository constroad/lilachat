import { useState, type KeyboardEvent } from 'react';
import { insertShortcodeEmoji, loadEmojiNames, searchEmojis, shortcodeAt, type EmojiName, type Shortcode } from '@lilachat/shared';

/**
 * «:hug» in the field (José 30/10, like WhatsApp): the matching emojis over
 * the field; arrows move, Enter or Tab puts the chosen one, Escape closes. The
 * name table loads the first time «:» is typed.
 */
export function useEmojiShortcode() {
  const [table, setTable] = useState<EmojiName[] | null>(null);
  const [code, setCode] = useState<Shortcode | null>(null);
  const [active, setActive] = useState(0);
  const options = code && table ? searchEmojis(table, code.query) : [];
  const onChange = (text: string, caret: number) => {
    const next = shortcodeAt(text, caret);
    setCode(next);
    setActive(0);
    if (next && !table) void loadEmojiNames().then(setTable);
  };
  const pick = (text: string, caret: number, emoji: string) => {
    if (!code) return null;
    setCode(null);
    return insertShortcodeEmoji(text, code, caret, emoji);
  };
  const onKey = (event: KeyboardEvent, choose: (emoji: string) => void): boolean => {
    if (options.length === 0) return false;
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step) setActive((before) => (before + step + options.length) % options.length);
    else if (event.key === 'Enter' || event.key === 'Tab') choose(options[active]!);
    else if (event.key === 'Escape') setCode(null);
    else return false;
    event.preventDefault();
    return true;
  };
  return { options, active, onChange, pick, onKey };
}
