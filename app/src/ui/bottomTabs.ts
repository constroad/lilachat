/**
 * The bottom bar's tabs. Personal: Chats · Pendientes · Encuestas · Ajustes.
 * In a company space (design `e-07-lista-espacio`, José 21/10): Chats ·
 * Directorio · Menciones · Ajustes. Four, never five: the fifth gets cut on a
 * phone (design `e-19` draws five).
 */
export type Tab = 'chats' | 'agenda' | 'encuestas' | 'ajustes' | 'directory' | 'mentions';

const OWN_ACCOUNT_TABS: readonly Tab[] = ['chats', 'agenda', 'encuestas', 'ajustes'];
const SPACE_TABS: readonly Tab[] = ['chats', 'directory', 'mentions', 'ajustes'];

export function tabsFor(inSpace: boolean): readonly Tab[] {
  return inSpace ? SPACE_TABS : OWN_ACCOUNT_TABS;
}

/** Switching between personal and a space, a tab the new bar does not have goes back to Chats. */
export function tabAfterModeChange(tab: Tab, inSpace: boolean): Tab {
  return tabsFor(inSpace).includes(tab) ? tab : 'chats';
}
