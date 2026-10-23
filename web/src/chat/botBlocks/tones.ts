import type { CardTone } from '@lilachat/shared';

/** A block's tone as theme classes (never a hex from the message): text, soft fill and the bar's color. */
export const TONE: Record<CardTone, { text: string; soft: string; bar: string }> = {
  ok: { text: 'text-en-linea', soft: 'border-en-linea/30 bg-en-linea/10', bar: 'bg-en-linea' },
  warn: { text: 'text-warning', soft: 'border-warning/30 bg-warning/10', bar: 'bg-warning' },
  error: { text: 'text-error', soft: 'border-error/30 bg-error/10', bar: 'bg-error' },
  info: { text: 'text-primary', soft: 'border-primary/30 bg-primary/10', bar: 'bg-primary' },
  neutral: { text: 'text-on-surface-variant', soft: 'border-outline/25 bg-background', bar: 'bg-outline' },
};
