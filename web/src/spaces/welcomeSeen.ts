/** Whether the welcome (design `e-01`) was already shown in this browser: `null` never, `true` done. */
const KEY = 'lilachat.bienvenida-vista';

export function readWelcomeSeen(): true | null {
  try {
    return localStorage.getItem(KEY) === '1' ? true : null;
  } catch {
    // Blocked storage: treated as seen, so it does not show on every visit.
    return true;
  }
}

export function markWelcomeSeen(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // Without storage it cannot be remembered; readWelcomeSeen already treats it as seen.
  }
}
