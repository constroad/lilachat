import { createPrefStore } from '../ui/prefStore';

/** Whether the welcome (design `e-01`) was already shown on this phone: `undefined` while it reads, `null` never. */
const welcomeStore = createPrefStore<boolean | null | undefined>('lilachat.pref.welcomeSeen', (stored) => (stored === '1' ? true : null), undefined, (value) => (value ? '1' : ''));
export const useWelcomeSeen = welcomeStore.use;
export const markWelcomeSeen = () => welcomeStore.set(true);
