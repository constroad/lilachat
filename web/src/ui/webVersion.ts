/** What this tab is running, written at build time (`define` in `vite.config.ts`). */
export type WebBuild = { version: string; commit: string; builtAt: string };

declare const __WEB_VERSION__: WebBuild | undefined;

export const WEB_BUILD: WebBuild = typeof __WEB_VERSION__ === 'undefined' ? { version: 'dev', commit: '', builtAt: '' } : __WEB_VERSION__;

const LIMA_TIME = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** «Lilachat web 0.1.128 · 6914ede · 21/10 21:05» (José, 21/10: show which version the web runs). */
export function webVersionLabel(build: WebBuild): string {
  const built = build.builtAt ? LIMA_TIME.format(new Date(build.builtAt)).replace(',', '') : '';
  return [`Lilachat web ${build.version}`, build.commit, built].filter(Boolean).join(' · ');
}
