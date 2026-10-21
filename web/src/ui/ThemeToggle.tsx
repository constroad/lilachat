import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { readThemeChoice, saveThemeChoice, systemPrefersDark, toggledTheme } from './tema';

/** Whether <html> is dark right now (the choice, the system or Ajustes can change it). */
function useDarkNow(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

/**
 * Light or dark in one click, in the list's header (José, 21/10: «no hay el
 * botón para cambiar el theme»; it was only in Ajustes › Apariencia, which
 * keeps «Sistema»). It shows what it switches to.
 */
export function ThemeToggle() {
  const dark = useDarkNow();
  const label = dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  return (
    <button type="button" data-testid="btn-tema" aria-label={label} title={label} onClick={() => saveThemeChoice(toggledTheme(readThemeChoice(), systemPrefersDark()))} className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-background">
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
