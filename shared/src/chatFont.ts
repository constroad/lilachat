/**
 * The chat's font size (backlog 1, José 20/10; design `f-01-tamano-de-letra`),
 * like WhatsApp: Pequeña · Mediana · Grande. It sizes the bubbles and the bar
 * where you write, on top of the phone's own font size, which is still
 * respected. Stored per device.
 */
export const CHAT_FONT_CHOICES = ['small', 'medium', 'large'] as const;
export type ChatFontChoice = (typeof CHAT_FONT_CHOICES)[number];

/** `size`/`line` in dp (app) and px (web); Mediana is the bubble as it always was. */
export const CHAT_FONT: Record<ChatFontChoice, { size: number; line: number; label: string }> = {
  small: { size: 13, line: 18, label: 'Pequeña' },
  medium: { size: 15, line: 21, label: 'Mediana' },
  large: { size: 17, line: 24, label: 'Grande' },
};

export function parseChatFont(stored: unknown): ChatFontChoice {
  return CHAT_FONT_CHOICES.find((choice) => choice === stored) ?? 'medium';
}
