import type { CardTone, NombreDeColor } from '@lilachat/shared';

/** A block's tone as a theme color (never a hex from the message). */
export const TONE_COLOR: Record<CardTone, NombreDeColor> = { ok: 'en-linea', warn: 'warning', error: 'error', info: 'primary', neutral: 'outline' };
/** The same tone as text and soft-fill classes. */
export const TONE_CLASS: Record<CardTone, { text: string; soft: string }> = {
  ok: { text: 'text-en-linea', soft: 'border-en-linea/30 bg-en-linea/10' },
  warn: { text: 'text-warning', soft: 'border-warning/30 bg-warning/10' },
  error: { text: 'text-error', soft: 'border-error/30 bg-error/10' },
  info: { text: 'text-primary', soft: 'border-primary/30 bg-primary/10' },
  neutral: { text: 'text-on-surface-variant', soft: 'border-outline/25 bg-background' },
};
