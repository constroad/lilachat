/**
 * The emoji button's panel opens on the tab used last (José, 21/10): emoji,
 * stickers or winks. A tab the chat does not offer (a secret chat has no
 * stickers, a group without winks) falls back to emoji.
 */
export type PanelTab = 'emoji' | 'stickers' | 'winks';

export function lastPanelTab(stored: string | null | undefined, available: readonly PanelTab[]): PanelTab {
  return available.find((tab) => tab === stored) ?? 'emoji';
}
