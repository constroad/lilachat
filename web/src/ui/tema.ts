/**
 * Light, dark or the system's (José, 21/10: «la web no tiene modo oscuro»).
 * The choice lives in this browser (a per-device convenience, like the app's)
 * and becomes the `dark` class on <html>, which swaps the palette of
 * `tailwind.config.js`. `public/tema-inicial.js` applies the same rule before
 * the first paint (the CSP does not allow inline scripts), so the page never
 * flashes white.
 */
export type ThemeChoice = 'light' | 'dark' | 'system';

export const THEME_KEY = 'lilachat.tema';
const CHOICES: readonly ThemeChoice[] = ['light', 'dark', 'system'];

export function readThemeChoice(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): ThemeChoice {
  try {
    const saved = storage?.getItem(THEME_KEY);
    return CHOICES.includes(saved as ThemeChoice) ? (saved as ThemeChoice) : 'system';
  } catch {
    return 'system';
  }
}

export function isDark(choice: ThemeChoice, systemDark: boolean): boolean {
  return choice === 'dark' || (choice === 'system' && systemDark);
}

/** The header button: the opposite of what is on screen, whatever the choice was (also «Sistema»). */
export function toggledTheme(choice: ThemeChoice, systemDark: boolean): 'light' | 'dark' {
  return isDark(choice, systemDark) ? 'light' : 'dark';
}

/** Whether the system asks for dark right now. */
export const systemPrefersDark = (): boolean => Boolean(systemQuery()?.matches);

const systemQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)');

export function applyTheme(choice: ThemeChoice): void {
  document.documentElement.classList.toggle('dark', isDark(choice, Boolean(systemQuery()?.matches)));
}

export function saveThemeChoice(choice: ThemeChoice): void {
  try {
    safeStorage()?.setItem(THEME_KEY, choice);
  } catch {
    // Private mode or blocked storage: the choice lasts until the page closes.
  }
  applyTheme(choice);
}

/** With «Sistema», follow the operating system when it switches. Returns the unsubscribe. */
export function followSystemTheme(): () => void {
  const query = systemQuery();
  if (!query) return () => undefined;
  const onChange = () => applyTheme(readThemeChoice());
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
