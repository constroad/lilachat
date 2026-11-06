/**
 * The bottom bar of the web on a phone, the APK's (`app/src/ui/bottomTabs.ts`,
 * José 06/11: «debería parecerse más a la versión de la apk en modo mobile»).
 * Personal: Chats · Pendientes · Encuestas · Ajustes. In a company space:
 * Chats · Directorio · Menciones · Ajustes. Four, never five.
 */
export type MobileTab = 'chats' | 'agenda' | 'encuestas' | 'ajustes' | 'directory' | 'mentions';

const OWN_ACCOUNT_TABS: readonly MobileTab[] = ['chats', 'agenda', 'encuestas', 'ajustes'];
const SPACE_TABS: readonly MobileTab[] = ['chats', 'directory', 'mentions', 'ajustes'];

export const mobileTabsFor = (inSpace: boolean): readonly MobileTab[] => (inSpace ? SPACE_TABS : OWN_ACCOUNT_TABS);

/** Which tab the bar lights: the overlay that is open, or Chats. */
export function activeMobileTab(state: { settingsOpen: boolean; overlay: string | null }): MobileTab {
  if (state.settingsOpen) return 'ajustes';
  if (state.overlay === 'agenda') return 'agenda';
  if (state.overlay === 'encuestas') return 'encuestas';
  if (state.overlay === 'directory') return 'directory';
  if (state.overlay === 'mentions') return 'mentions';
  return 'chats';
}
