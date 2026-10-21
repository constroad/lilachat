import { useEffect, useRef, useState } from 'react';

/**
 * A new web version (backlog 32, José 21/10: like the app). A tab left open
 * for days keeps the bundle it loaded; when it comes back to the front, the
 * published `index.html` says which bundle is current. Asked only then, at
 * most every 30 min: no polling.
 */
export const WEB_VERSION_RECHECK_MS = 30 * 60_000;
const BUNDLE = /<script[^>]*type="module"[^>]*src="([^"]*\/assets\/index-[^"]+\.js)"/;

export function bundleOf(html: string): string | null {
  return BUNDLE.exec(html)?.[1] ?? null;
}

/** Only a hashed bundle on both sides counts: a dev server or an error page never claims one. */
export function hasNewBundle(loaded: string | null, publishedHtml: string): boolean {
  const published = bundleOf(publishedHtml);
  return Boolean(loaded && published && published !== loaded);
}

export function shouldRecheckWeb(lastCheckMs: number | null, nowMs: number): boolean {
  return lastCheckMs === null || lastCheckMs > nowMs || nowMs - lastCheckMs >= WEB_VERSION_RECHECK_MS;
}

const loadedBundle = () => document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')?.getAttribute('src') ?? null;

/** Whether a newer version is published, asked when the tab comes back to the front. */
export function useNewWebVersion(): boolean {
  const [available, setAvailable] = useState(false);
  const lastCheck = useRef<number | null>(Date.now());
  useEffect(() => {
    const loaded = loadedBundle();
    if (!loaded) return;
    const check = async () => {
      if (document.hidden || !shouldRecheckWeb(lastCheck.current, Date.now())) return;
      lastCheck.current = Date.now();
      try {
        const response = await fetch('/', { cache: 'no-store' });
        if (response.ok && hasNewBundle(loaded, await response.text())) setAvailable(true);
      } catch (error) {
        console.warn('[version] no se pudo consultar:', error instanceof Error ? error.message : error);
      }
    };
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);
  return available;
}
