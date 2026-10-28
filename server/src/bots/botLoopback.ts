/**
 * Apps on this same machine are called by loopback (agentes, 28/10): from the
 * mini the public hop costs 0.6–0.96 s a request, loopback 0.002 s, and each
 * tap on a command paid it. The ports are the ones Torre gives each app
 * (`torre.apps.json`); in production Torre runs Lilachat with
 * `NODE_ENV=production` on that same mini. If nobody listens there, the call
 * goes by the public address as before. The request is the same, signature
 * included.
 */
const SAME_MACHINE_APPS: ReadonlyMap<string, string> = new Map([['agentes.constroad.com', 'http://127.0.0.1:3012']]);
const NONE: ReadonlyMap<string, string> = new Map();
let override: ReadonlyMap<string, string> | null = null;

/** Tests point a host at their own server. */
export function configureBotLoopback(origins: ReadonlyMap<string, string> | null): void {
  override = origins;
}

export function machineLoopbackOrigins(): ReadonlyMap<string, string> {
  return override ?? (process.env.NODE_ENV === 'production' ? SAME_MACHINE_APPS : NONE);
}

/** The local address of a listed host, with the same path and query; null for any other. */
export function loopbackUrlOf(url: string, origins: ReadonlyMap<string, string>): string | null {
  try {
    const parsed = new URL(url);
    const origin = origins.get(parsed.hostname.toLowerCase());
    return origin ? `${origin}${parsed.pathname}${parsed.search}` : null;
  } catch {
    return null; // not a URL: it goes as it is, and fails as it would
  }
}
