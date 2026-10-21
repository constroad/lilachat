import { createPrefStore } from './prefStore';

/** Personal groups as a list, like Slack (José, 21/10; design `s-01`): off by default, WhatsApp's bubbles. */
const groupsAsListStore = createPrefStore<boolean>('lilachat.pref.groupsAsList', (stored) => stored === 'true', false);

export const useGroupsAsList = groupsAsListStore.use;
export const setGroupsAsList = groupsAsListStore.set;
