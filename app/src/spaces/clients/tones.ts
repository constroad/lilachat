import type { ClientServiceStatus, DetailTone } from '@lilachat/shared';

/** The pill of a service's state (design f-03). */
export const STATUS_TONE: Record<ClientServiceStatus, string> = {
  pending: 'border-warning/30 bg-warning/10 text-warning',
  in_progress: 'border-primary/30 bg-primary/10 text-primary',
  completed: 'border-en-linea/30 bg-en-linea/10 text-en-linea',
  rejected: 'border-error/30 bg-error/10 text-error',
};

/** The pill of a pedido, despacho or informe, in Portal's tone. */
export const DETAIL_TONE: Record<DetailTone, string> = {
  ok: STATUS_TONE.completed,
  info: STATUS_TONE.in_progress,
  warn: STATUS_TONE.pending,
  error: STATUS_TONE.rejected,
  neutral: 'border-outline/30 bg-surface-variant text-on-surface-variant',
};
