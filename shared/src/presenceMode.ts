/**
 * A presence the person chooses (pending 15, José 20/10): «En línea» follows
 * the app as before; «Ausente» and «Ocupado» show connected with that word;
 * «Invisible» shows disconnected while the app is in use. Apart, whether
 * others see «últ. vez». PURE.
 */
export type PresenceMode = 'auto' | 'away' | 'busy' | 'invisible';
export type PresenceStatus = 'away' | 'busy';

export const PRESENCE_MODES: readonly { mode: PresenceMode; label: string; hint: string }[] = [
  { mode: 'auto', label: 'En línea', hint: 'Te ven conectado mientras usas Lilachat.' },
  { mode: 'away', label: 'Ausente', hint: 'Te ven conectado, pero ausente.' },
  { mode: 'busy', label: 'Ocupado', hint: 'Te ven conectado y ocupado.' },
  { mode: 'invisible', label: 'Invisible', hint: 'Te ven desconectado aunque uses la app. Tu última vez no cambia.' },
];

export const isPresenceMode = (value: unknown): value is PresenceMode => PRESENCE_MODES.some((one) => one.mode === value);

/** What travels with «online»: only away and busy add a word. */
export function broadcastStatus(mode: PresenceMode): PresenceStatus | undefined {
  return mode === 'away' || mode === 'busy' ? mode : undefined;
}

/** The line under a name while connected; null when offline (that line is «últ. vez»). */
export function presenceLine(params: { online: boolean; status?: PresenceStatus }): string | null {
  if (!params.online) return null;
  if (params.status === 'away') return 'Ausente';
  if (params.status === 'busy') return 'Ocupado';
  return 'En línea';
}
