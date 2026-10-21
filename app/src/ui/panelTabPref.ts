import { createPrefStore } from './prefStore';

/** The emoji button's last tab (José, 21/10): emoji, stickers or winks; `lastPanelTab` checks the chat offers it. */
const panelTabStore = createPrefStore<string | null>('lilachat.pref.panelTab', (stored) => stored, null, (value) => value ?? '');

export const useStoredPanelTab = panelTabStore.use;
export const storePanelTab = panelTabStore.set;
