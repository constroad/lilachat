import type { FormSubmitReply } from './appActions.js';
import type { FormValues } from './appForms.js';
import type { CommandOutcome, CommandResponse } from './botCommands.js';

/**
 * The «Mapa» tab of a service (José 06/11: «si el servicio tiene mapa agrega un tab mapa»). Only
 * Portal's public page draws it, so opening the tab makes a link with Portal's action and shows
 * that page. A short term: it is made again on the next visit, and old ones do not pile up.
 * PURE: the app and the web draw with it.
 */
export const MAP_LINK_DAYS = 1;
export const MAP_LINK_FAILED = 'No se pudo abrir el mapa. Prueba de nuevo.';

/** Portal's report opens on its first page; this is the section with the map (E2E 06/11: `section=map`). */
export const serviceMapPage = (url: string, serviceId: string): string => `${url.includes('/service/') ? url : `${url}/service/${serviceId}`}?section=map`;

const ADMIN_SERVICE_PAGE = /^\/admin\/service-management\/[^/]+\/?$/;

/**
 * Where the streets are drawn today (José 07/11: «dónde se supone que voy a crear el mapa»): the
 * «Mapa» tab of the service in Portal's admin. Only that page draws; any other link gives nothing.
 */
export function portalMapTabUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const page = new URL(url);
    if (page.protocol !== 'https:' || !ADMIN_SERVICE_PAGE.test(page.pathname)) return null;
    page.searchParams.set('tab', 'mapa');
    return page.toString();
  } catch {
    return null;
  }
}

export type ServiceMapResult = { ok: true; url: string } | { ok: false; message: string };
export type ServiceMapDeps = {
  open: () => Promise<{ ok: true; data: CommandOutcome } | { ok: false; message?: string }>;
  submit: (commandId: string, values: FormValues) => Promise<FormSubmitReply>;
  notice: (commandId: string) => Promise<{ response: CommandResponse } | null>;
};

const linkOf = (response: CommandResponse | undefined): ServiceMapResult => {
  const url = response?.card?.link?.url;
  return url?.startsWith('https://') ? { ok: true, url } : { ok: false, message: MAP_LINK_FAILED };
};

async function linkFrom(outcome: CommandOutcome, notice: ServiceMapDeps['notice']): Promise<ServiceMapResult> {
  if (outcome.outcome === 'failed') return { ok: false, message: outcome.message ?? MAP_LINK_FAILED };
  return linkOf(outcome.outcome === 'pending' ? (await notice(outcome.commandId))?.response : outcome.response);
}

/** Runs the link action with its answers already given, without the form the chat would show. */
export async function serviceMapUrl(deps: ServiceMapDeps): Promise<ServiceMapResult> {
  const opened = await deps.open();
  if (!opened.ok) return { ok: false, message: MAP_LINK_FAILED };
  if (opened.data.outcome !== 'form') return linkFrom(opened.data, deps.notice);
  const reply = await deps.submit(opened.data.commandId, { dias: MAP_LINK_DAYS });
  if (!reply.ok) return { ok: false, message: reply.errors?._ ?? Object.values(reply.errors ?? {})[0] ?? reply.message ?? MAP_LINK_FAILED };
  return linkFrom(reply.outcome, deps.notice);
}
